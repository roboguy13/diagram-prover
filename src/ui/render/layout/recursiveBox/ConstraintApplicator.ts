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
  processLayout(layoutTree: LayoutTree): void {
    function traverse(nodeId: string): void {
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
    }

    traverse(layoutTree.rootNodeId);
  }
}
