import { layout } from "dagre";
import { HorizontalCenteringConstraint } from "./constraints/HorizontalCenteringConstraint";
import { HorizontalChildrenPlacementConstraint } from "./constraints/HorizontalChildrenPlacementConstraint";
import { HorizontalSpacingConstraint } from "./constraints/HorizontalSpacingConstraint";
import { SubtreeDimensionConstraint } from "./constraints/subtree/SubtreeDimensionConstraint";
import { VerticalPlacementConstraint } from "./constraints/VerticalPlacementConstraint";
import { VerticalSubtreeConstraint } from "./constraints/VerticalSubtreeConstraint";
import { LayoutTree } from "./LayoutTree";
import { exactly } from "../../../../constraint/propagator/NumericRange";
import { known } from "../../../../constraint/propagator/Propagator";
import { NestedContainmentConstraint } from "./constraints/nesting/NestedContainmentContraint";
import { NestedParentSizeConstraint } from "./constraints/nesting/NestedParentSizeConstaint";

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

  processLayout(layoutTree: LayoutTree): void {
    function traverse(nodeId: string): void {
      ConstraintApplicator.debugLeaves(layoutTree, nodeId);

      const children = layoutTree.getChildren(nodeId);
      const nestingChildren = layoutTree.getNestingChildren(nodeId);

      const subtreeDimsConstraint = new SubtreeDimensionConstraint(nodeId, children);
      subtreeDimsConstraint.apply(layoutTree);

      const horizontalCenteringConstraint = new HorizontalCenteringConstraint(nodeId);
      horizontalCenteringConstraint.apply(layoutTree);

      const verticalSubtreeConstraint = new VerticalSubtreeConstraint(nodeId);
      verticalSubtreeConstraint.apply(layoutTree);

      for (let i = 0; i < children.length - 1; i++) {
        const spacingConstraint = new HorizontalSpacingConstraint(children[i]!, children[i + 1]!);
        spacingConstraint.apply(layoutTree);
      }

      for (const childId of children) {
        const verticalPlacementConstraint = new VerticalPlacementConstraint(nodeId, childId);
        verticalPlacementConstraint.apply(layoutTree);
      }

      for (const childId of children) {
        traverse(childId);
      }

      const horizontalChildrenPlacementConstraint = new HorizontalChildrenPlacementConstraint(nodeId);
      horizontalChildrenPlacementConstraint.apply(layoutTree);

      for (const nestingChildId of nestingChildren) {
        const nestedContainmentConstraint = new NestedContainmentConstraint(nodeId, nestingChildId);
        nestedContainmentConstraint.apply(layoutTree);

        const nestedParentSizeConstraint = new NestedParentSizeConstraint(nodeId, nestingChildId);
        nestedParentSizeConstraint.apply(layoutTree);

        traverse(nestingChildId);
      }

      const nodeLayout = layoutTree.getNodeLayout(nodeId);
      if (nodeLayout) {
        const intrinsicBox = nodeLayout.intrinsicBox;
        const subtreeBox = nodeLayout.subtreeExtentBox;

        layoutTree.net.equalPropagator(
          `CenterXLink: ${nodeId}`,
          intrinsicBox.centerX,
          subtreeBox.centerX
        );
      }
    }

    traverse(layoutTree.rootNodeId);
  }
}
