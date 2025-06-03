// src/ui/render/layout/recursiveBox/ConstraintApplicator.ts

import { layout } from "dagre";
import { LayoutTree } from "../recursiveBox/LayoutTree";
import { exactly, getMin } from "../../../../constraint/propagator/NumericRange";
import { known } from "../../../../constraint/propagator/Propagator";
// Import isNodePortLocation
import { isNode } from "reactflow";
import { determineLayers } from "../../../../utils/LevelOrder";
import { PortBarType } from "../../../components/Nodes/nodeTypes";
import { Constraint } from "./Constraint";
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { ContainerSizeConstraint } from "./constraints/container/ContainerSizeConstraint";
import { SubtreeIntrinsicConstraint } from "./constraints/SubtreeIntrinsicConstraint";
import { SubtreeExtentChildrenConstraint } from "./constraints/SubtreeExtentChildrenConstraint";
import { NodeLayout } from "./NodeLayout";
import { HorizontalSeparationConstraint } from "./constraints/HorizontalSeparationConstraint";
import { NodeId } from "../../../../ir/StringDiagram";
import { VerticalSeparationConstraint } from "./constraints/VerticalSeparationConstraint";
import { VerticalAlignmentConstraint } from "./constraints/VerticalAlignmentConstraint";
import { ParentHorizontalCenteringConstraint } from "./constraints/ParentHorizontalCenteringConstraint";
import { BoundingBox } from "./BoundingBox";
import { DebugBoundingBox } from "./DebugBoundingBox";

export class ConstraintApplicator {
  private _constraints: Constraint[] = [];
  private _debugBoxes: DebugBoundingBox[] = [];

  public processLayout(layoutTree: LayoutTree): void {
    const layouts = layoutTree.nodeLayouts.values()

    const roots = layoutTree.layoutRoots;

    this.horizontalConstraints(layoutTree, roots);

    console.log("Layout Hierarchy Check:");
    layoutTree.logChildren()

    for (const layout of layouts) {
      ConstraintApplicator.debugLeaves(layoutTree, layout.nodeId);

      const nestingChildren = layoutTree.getNestingChildren(layout.nodeId);
      console.log(`Nesting children for ${layout.nodeId}:`, nestingChildren);

      if (nestingChildren.length > 0) {
        this.containerConstraints(layoutTree, layout.nodeId, nestingChildren);
      }

      this.applyConstraint(
        new SubtreeIntrinsicConstraint(layout.nodeId),
        layoutTree
      );

      this.applyConstraint(
        new SubtreeExtentChildrenConstraint(layout.nodeId),
        layoutTree
      );

      const children = layoutTree.getChildren(layout.nodeId);
      this.applyConstraint(
        new VerticalAlignmentConstraint(children),
        layoutTree
      );
      if (children.length > 0) {
        this.verticalConstraints(layoutTree, children, layout.nodeId);
        const childLayouts = children.map(childId => layoutTree.getNodeLayout(childId)).filter((l): l is NonNullable<typeof l> => l != null);
        this.horizontalConstraints(layoutTree, childLayouts);

        const centeringConstraint = new ParentHorizontalCenteringConstraint(layout.nodeId, children);
        this.applyConstraint(centeringConstraint, layoutTree);
      }
    }

    // this.performMinimization(layoutTree);

    layoutTree.debugBoxes = this._debugBoxes;
  }

  private performMinimization(layoutTree: LayoutTree): void {
    const cellsToMinimize = this._constraints
      .flatMap(constraint => constraint.cellsToMinimize())

    const minimizer = new Minimizer(layoutTree.net, cellsToMinimize);
    minimizer.minimize();
  }

  private horizontalConstraints(layoutTree: LayoutTree, adjacent: NodeLayout[]): void {
    for (let i = 0; i < adjacent.length - 1; i++) {
      const left = adjacent[i]!;
      const right = adjacent[i + 1]!;

      this.applyConstraint(
        new HorizontalSeparationConstraint(left.nodeId, right.nodeId),
        layoutTree
      );
    }
  }

  private verticalConstraints(layoutTree: LayoutTree, topNodeIds: NodeId[], bottomNodeId: NodeId): void {
    console.log(`Vertical constraints for ${topNodeIds} and ${bottomNodeId}`);
    for (const topNodeId of topNodeIds) {
      this.applyConstraint(
        new VerticalSeparationConstraint(topNodeId, bottomNodeId),
        layoutTree
      );
    }
  }

  private containerConstraints(layoutTree: LayoutTree, containerId: string, nestedIds: string[]): void {
    const containerLayout = layoutTree.getNodeLayout(containerId);
    if (!containerLayout) {
      console.warn(`Container layout not found for ID: ${containerId}`);
      return;
    }
    const nestedLayouts = nestedIds.map(id => layoutTree.getNodeLayout(id)).filter(layout => layout !== undefined);
    if (nestedLayouts.length === 0) {
      console.warn(`No nested layouts found for IDs: ${nestedIds}`);
      return;
    }

    this.applyConstraint(
      new ContainerSizeConstraint(containerId, nestedIds),
      layoutTree
    );
  }

  private applyConstraint(constraint: Constraint, layoutTree: LayoutTree): void {
    constraint.apply(layoutTree);
    this._constraints.push(constraint);

    this._debugBoxes.push(...constraint.debugBoxes);
  }

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

      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.centerX);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.left);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.right);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.top);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.bottom);
    }
  }
}