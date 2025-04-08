// src/ui/render/layout/recursiveBox/ConstraintApplicator.ts

import { layout } from "dagre";
import { LayoutTree } from "./LayoutTree";
import { exactly } from "../../../../constraint/propagator/NumericRange";
import { known } from "../../../../constraint/propagator/Propagator";
// Import isNodePortLocation
import { Connection, isNodePortLocation } from "../../../../ir/StringDiagram";
import { VerticalOrderingConstraint } from "./constraints/VerticalOrderingConstraint";
import { HorizontalSpacingConstraint } from "./constraints/HorizontalSpacingConstraint";
import { isNode } from "reactflow";
import { determineLayers } from "../../../../utils/LevelOrder";
import { Constraint } from "@lume/kiwi";
import { RootGroundingConstraint } from "./constraints/RootGroundingConstraint";
import { LeftAlignConstraint } from "./constraints/LeftAlignConstraint";
import { NodeLayout } from "./NodeLayout";
import { NodeId } from "../../../../engine/Term";
import { ContainerSizeConstraint } from "./constraints/ContainerSizeConstraint";
import { HorizontalCenteringConstraint } from "./constraints/HorizontalCenteringConstraint";
import { PortBarVerticalConstraint } from "./constraints/PortBarVerticalConstraint";

export class ConstraintApplicator {
  private static debugLeaves(layoutTree: LayoutTree, nodeId: string): void {
    if (layoutTree.getChildren(nodeId).length === 0) {
      ConstraintApplicator.debugNode('leaf', layoutTree, nodeId);
    } else {
      ConstraintApplicator.debugNode('non-leaf', layoutTree, nodeId)
    }
  }

  private static debugNode(prefix: string, layoutTree: LayoutTree, nodeId: string): void {
    const nodeLayout = layoutTree.getNodeLayout(nodeId);
    if (nodeLayout) {
      const intrinsicBox = nodeLayout.intrinsicBox;
      const subtreeBox = nodeLayout.subtreeExtentBox;

      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, intrinsicBox.centerX);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, intrinsicBox.left);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, intrinsicBox.right);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, intrinsicBox.top);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, intrinsicBox.bottom);
    }
  }

  public processLayout(layoutTree: LayoutTree): void {
    const getChildren = (nodeId: string) => layoutTree.getChildren(nodeId);
    const { layers, nodeLayer } = determineLayers(layoutTree.allRoots, getChildren);

    const rootGroundingConstraint = new RootGroundingConstraint()
    rootGroundingConstraint.apply(layoutTree)

    for (const root of layoutTree.allRoots) {
      this.traverseComponent(root, layoutTree);
    }

    this.applyVerticalConstraints(layoutTree);
    this.applyHorizontalConstraints(layers, layoutTree);

    this.applyContainerSizing(layoutTree)
  }

  private applyHorizontalConstraints(layers: Map<number, string[]>, layoutTree: LayoutTree): void {
    console.log("Applying horizontal constraints...");
    for (const [layerIndex, layer] of layers.entries()) {
      console.log(`Layer ${layerIndex}: [${layer.join(', ')}]`);
      if (layerIndex === 0) {
        console.log("  Skipping horizontal constraints for Layer 0 (roots layer).");
        continue;
      }
      if (layer.length <= 1) {
        console.log(`  Skipping layer ${layerIndex} - only ${layer.length} node(s).`);
        continue;
      }
      for (let i = 0; i < layer.length - 1; i++) {
        const nodeId1 = layer[i]!;
        const nodeId2 = layer[i + 1]!;
        console.log(`  Applying HSpacing between ${nodeId1} and ${nodeId2}`); // LOG
        const constraint = new HorizontalSpacingConstraint(nodeId1, nodeId2);
        constraint.apply(layoutTree);
      }
    }
    console.log("Finished applying horizontal constraints.");
  }

  private applyVerticalConstraints(layoutTree: LayoutTree): void {
    // Need a way to track visited nodes during traversal to avoid infinite loops
    // if getChildren could somehow form a cycle (shouldn't with spanning forest)
    // or re-applying constraints unnecessarily.
    const visitedForVertical = new Set<string>();
    for (const rootId of layoutTree.allRoots) {
      this.applyVerticalConstraintsRecursive(rootId, layoutTree, visitedForVertical);
    }
  }

  private applyVerticalConstraintsRecursive(
    nodeId: string,
    layoutTree: LayoutTree,
    visited: Set<string>
  ): void {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    const children = layoutTree.getChildren(nodeId);
    const allRootsSet = new Set(layoutTree.allRoots); // Create a Set for efficient lookup

    for (const childId of children) {
      // Skip applying vertical constraint if BOTH parent and child are roots
      if (allRootsSet.has(nodeId) && allRootsSet.has(childId)) {
        console.log(`Skipping vertical constraint between roots: ${nodeId} -> ${childId}`);
        // Still need to recurse to handle children of the child root
        this.applyVerticalConstraintsRecursive(childId, layoutTree, visited);
        continue; // Skip applying the constraint for this edge
      }


      const childLayout = layoutTree.getNodeLayout(childId);
      if (childLayout?.portBarType) {
        const portBarConstraint = new PortBarVerticalConstraint(nodeId, childLayout.portBarType);
        portBarConstraint.apply(layoutTree);
      } else {
        // Apply constraint for non-root-to-root or root-to-non-root edges
        const constraint = new VerticalOrderingConstraint(nodeId, childId);
        constraint.apply(layoutTree);
      }

      // Recurse down the tree
      this.applyVerticalConstraintsRecursive(childId, layoutTree, visited);
    }
  }

  private applyContainerSizing(layoutTree: LayoutTree): void {
    const potentialContainers = new Map<string, NodeLayout>();
    const nestedChildrenMap = new Map<string, NodeLayout[]>(); // Map containerId to its nested children

    // First pass: Identify containers and group their nested children (same as before)
    for (const nodeLayout of layoutTree.nodeLayouts.values()) {
      if (nodeLayout.nestingParentId !== null) {
        const parentId = nodeLayout.nestingParentId;
        const parentLayout = layoutTree.getNodeLayout(parentId);

        if (parentLayout) {
          if (!potentialContainers.has(parentId)) {
            console.log(`Found potential container with label: ${parentId}, ${parentLayout?.label}`);
            potentialContainers.set(parentId, parentLayout);
          }
          if (!nestedChildrenMap.has(parentId)) {
            nestedChildrenMap.set(parentId, []);
          }
          nestedChildrenMap.get(parentId)!.push(nodeLayout);
        }
      }
    }

    // Second pass: Apply constraints for each container
    for (const [containerId, containerLayout] of potentialContainers) { // Use containerLayout if needed later

      // 1. Apply the overall container sizing constraint (which now includes padding logic)
      const containerSizeConstraint = new ContainerSizeConstraint(containerId);
      containerSizeConstraint.apply(layoutTree); // This handles container size based on children + padding

      // 2. Find and Center the Nested Port Bars
      const nestedChildren = nestedChildrenMap.get(containerId) ?? [];
      for (const childLayout of nestedChildren) {
        // Check if the nested child is a port bar
        if (childLayout.kind === 'PortBarNode') { // Use the correct kind check
          // Apply horizontal centering: container.centerX = portBar.centerX
          const hCenterConstraint = new HorizontalCenteringConstraint(containerId, childLayout.nodeId);
          hCenterConstraint.apply(layoutTree);
          // No need to apply padding constraints here anymore - ContainerSizeConstraint handles it.
        }
        // TODO: Apply positioning/ordering constraints for other nested content (body) if necessary
      }
    }
  }

  // private applyContainerSizing(layoutTree: LayoutTree): void {
  //   const potentialContainers = new Map<string, NodeLayout>();

  //   for (const nodeLayout of layoutTree.nodeLayouts.values()) {
  //     if (nodeLayout.nestingParentId !== null) {
  //       // Mark the parent
  //       const parentLayout = layoutTree.getNodeLayout(nodeLayout.nestingParentId);

  //       if (parentLayout && !potentialContainers.has(parentLayout.nodeId)) {
  //         console.log(`Found potential container with label: ${parentLayout.nodeId}, ${parentLayout?.label}`);
  //         potentialContainers.set(parentLayout.nodeId, parentLayout);
  //       }
  //     }
  //   }

  //   for (const [containerId, containerLayout] of potentialContainers) {
  //     const containerConstraint = new ContainerSizeConstraint(containerId);
  //     containerConstraint.apply(layoutTree);
  //   }
  // }

  private traverseComponent(nodeId: string, layoutTree: LayoutTree): void {
    const children = layoutTree.getChildren(nodeId);

    if (children.length > 0) {
      const centeringConstraint = new LeftAlignConstraint(nodeId, children);
      centeringConstraint.apply(layoutTree);
    }

    for (const childId of children) {
      ConstraintApplicator.debugLeaves(layoutTree, nodeId);

      const childLayout = layoutTree.getNodeLayout(childId);

      if (childLayout?.nestingParentId !== nodeId) {
        const verticalOrderingConstraint = new VerticalOrderingConstraint(nodeId, childId);
        verticalOrderingConstraint.apply(layoutTree);
      }

      this.traverseComponent(childId, layoutTree);
    }
  }
}