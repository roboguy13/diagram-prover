import { addRangeListPropagator, addRangePropagator, NumericRange } from "../../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../../constraint/propagator/Propagator";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class SubtreeWidthConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
  }

  // subtreeWidth = sum(children.subtree.width) + sum(child.spacing)
  apply(layoutTree: LayoutTree): void {
    const childIds = layoutTree.getChildren(this._parentId);

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayouts = childIds.map(childId => layoutTree.getNodeLayout(childId));

    if (!parentLayout) {
      return;
    }

    const childWidths = childLayouts.map(childLayout => childLayout!.subtreeExtentBox.width);

    const sumChildWidths = layoutTree.net.newCell(`sumChildWidths`, unknown());
    addRangeListPropagator(
      `sumChildWidths: ${this._parentId}`,
      layoutTree.net,
      childWidths,
      sumChildWidths
    );

    const hSpacing = layoutTree.standardHSpacing;

    const hSpacingPlusParentWidth = layoutTree.net.newCell(`hSpacingPlusParentWidth`, unknown());
    const parentIntrinsicBox = parentLayout.intrinsicBox;
    const parentSubtreeBox = parentLayout.subtreeExtentBox;

    addRangePropagator(
      `hSpacingPlusParentWidth: ${this._parentId}`,
      layoutTree.net,
      parentIntrinsicBox.width,
      hSpacing,
      hSpacingPlusParentWidth
    );

    addRangePropagator(
      `parentWidthPlusChildWidth: ${this._parentId}`,
      layoutTree.net,
      hSpacingPlusParentWidth,
      sumChildWidths,
      parentSubtreeBox.width
    );
  }
}
