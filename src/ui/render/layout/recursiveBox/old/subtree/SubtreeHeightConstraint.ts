import { addRangePropagator, maxRangeListPropagator, NumericRange } from "../../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../../constraint/propagator/Propagator";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class SubtreeHeightConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
  }

  // subtree.height = max(children.subtree.height) + vSpacing + parent.height
  apply(layoutTree: LayoutTree): void {
    const childIds = layoutTree.getChildren(this._parentId);
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayouts = childIds.map(childId => layoutTree.getNodeLayout(childId));

    if (!parentLayout) {
      return;
    }

    const childSubtreeHeights = childLayouts.map(childLayout => childLayout!.subtreeExtentBox.height);

    const maxChildSubtreeHeight = layoutTree.net.newCell(`maxChildSubtreeHeight`, unknown());

    // maxChildSubtreeHeight = max(children.subtree.height)
    maxRangeListPropagator(
      `maxChildSubtreeHeight: ${this._parentId}`,
      layoutTree.net,
      childSubtreeHeights,
      maxChildSubtreeHeight
    );

    const vSpacing = layoutTree.standardVSpacing;

    const vSpacingPlusParentHeight = layoutTree.net.newCell(`vSpacingPlusParentHeight`, unknown());
    const parentIntrinsicBox = parentLayout.intrinsicBox;
    const parentSubtreeBox = parentLayout.subtreeExtentBox;

    // vSpacingPlusParentHeight = parent.intrinsicBox.height + vSpacing
    addRangePropagator(
      `vSpacingPlusParentHeight: ${this._parentId}`,
      layoutTree.net,
      parentIntrinsicBox.height,
      vSpacing,
      vSpacingPlusParentHeight
    );

    // parent.subtree.height = max(children.subtree.height) + vSpacing + parent.height
    addRangePropagator(
      `parentHeightPlusChildHeight: ${this._parentId}`,
      layoutTree.net,
      vSpacingPlusParentHeight,
      maxChildSubtreeHeight,
      parentSubtreeBox.height
    );
  }
}
