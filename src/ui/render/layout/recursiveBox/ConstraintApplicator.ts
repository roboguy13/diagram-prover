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
import { HorizontalCenteringConstraint } from "./constraints_old/HorizontalCenteringConstraint";

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
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, subtreeBox.left);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, subtreeBox.right);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, subtreeBox.top);
      layoutTree.net.addDebugCell(prefix + ': ' + nodeId, subtreeBox.bottom);
    }
  }
  private visitedInHierarchyTraversal: Set<string> = new Set();

  public processLayout(layoutTree: LayoutTree): void {
    this.visitedInHierarchyTraversal.clear();
    const net = layoutTree.net;
    const primaryRootId = layoutTree.rootNodeId;
    const allRoots = layoutTree.allRoots;

    console.log(`Applying Inequality Hierarchy Constraints, anchoring ${primaryRootId} fully, others horizontally.`);

    // --- Anchor Roots ---
    console.log("Anchoring roots...");
    let rootIndex = 0;
    const HORIZONTAL_ROOT_GAP = 400; // Adjust as needed

    // First, anchor the primary root fully
    const primaryRootLayout = layoutTree.getNodeLayout(primaryRootId);
    if (primaryRootLayout) {
        console.log(`Anchoring primary root ${primaryRootId} at (0, 0)`);
        net.writeCell( { description: `Anchor Root ${primaryRootId} minX`, inputs:[], outputs:[primaryRootLayout.intrinsicBox.left] }, primaryRootLayout.intrinsicBox.left, known(exactly(0)) );
        net.writeCell( { description: `Anchor Root ${primaryRootId} minY`, inputs:[], outputs:[primaryRootLayout.intrinsicBox.top] }, primaryRootLayout.intrinsicBox.top, known(exactly(0)) );
    } else {
         console.warn(`Could not find layout for primary root node ${primaryRootId} during anchoring.`);
    }

    // Then, anchor other roots horizontally only
    for (const rootId of allRoots) {
         // Skip the primary root, we already anchored it
         if (rootId === primaryRootId) continue;

         const rootLayout = layoutTree.getNodeLayout(rootId);
         if (rootLayout) {
             const intrinsicBox = rootLayout.intrinsicBox;
             // Assign horizontal position based on index, leave vertical float
             const anchorX = rootIndex * HORIZONTAL_ROOT_GAP;
             console.log(`Anchoring non-primary root ${rootId} at minX = ${anchorX}`);
             net.writeCell( { description: `Anchor NonPrimary Root ${rootId} minX`, inputs:[], outputs:[intrinsicBox.left] }, intrinsicBox.left, known(exactly(anchorX)) );
             // DO NOT anchor minY for these roots
             rootIndex++; // Increment index only for non-primary roots to ensure staggering
         } else { console.warn(`Could not find layout for root node ${rootId} during anchoring.`); }
    }

    // --- Hierarchical Traversal Applying Inequalities ---
    console.log("Starting traversal from actual roots:", allRoots);
    for (const currentRoot of allRoots) {
        if (!this.visitedInHierarchyTraversal.has(currentRoot)) {
            // console.log(`Traversing component rooted at: ${currentRoot}`);
            this.traverseAndApplyHierarchyInequalities(currentRoot, layoutTree);
        }
    }
    console.log("Finished applying hierarchy inequality constraints.");
}

// Inequality constraints based on hierarchy (NO CHANGE NEEDED HERE from last step)
private traverseAndApplyHierarchyInequalities(nodeId: string, layoutTree: LayoutTree): void {
   if (this.visitedInHierarchyTraversal.has(nodeId)) return;
    this.visitedInHierarchyTraversal.add(nodeId);
    ConstraintApplicator.debugLeaves(layoutTree, nodeId);

    const hierarchicalChildren = layoutTree.getChildren(nodeId);
    let previousSiblingId: string | null = null;

    for (const childId of hierarchicalChildren) {
        new VerticalOrderingConstraint(nodeId, childId).apply(layoutTree); // Inequality version
        if (previousSiblingId) {
             new HorizontalSpacingConstraint(previousSiblingId, childId).apply(layoutTree); // Inequality version
        }
        previousSiblingId = childId;
        this.traverseAndApplyHierarchyInequalities(childId, layoutTree);
    }
}
}