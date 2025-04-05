import { addRangePropagator, exactly, lessThanEqualPropagator, subtractRangePropagator } from "../../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class NestedContainmentConstraint implements Constraint {
  private _parentId: string;
  private _childId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(layoutTree: LayoutTree): void {
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayout = layoutTree.getNodeLayout(this._childId);

    if (!parentLayout || !childLayout) {
      return
    }

    const parentIntrinsicBox = parentLayout.intrinsicBox;
    const childIntrinsicBox = childLayout.intrinsicBox;

    const nestingHSpacing = layoutTree.standardHNestingSpacing;
    const nestingVSpacing = layoutTree.standardVNestingSpacing;

    const parentIntrinsicLeftPlusSpacing = layoutTree.net.newCell(`parentIntrinsicLeftPlusSpacing`, unknown());

    // parent.subtreeExtent.left + nestingHSpacing
    addRangePropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      parentIntrinsicBox.left,
      nestingHSpacing,
      parentIntrinsicLeftPlusSpacing
    );

    // child.intrinsicBox.left >= parent.subtreeExtent.left + nestingHSpacing
    lessThanEqualPropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      childIntrinsicBox.left,
      parentIntrinsicLeftPlusSpacing
    );

    const parentIntrinsicRightMinusSpacing = layoutTree.net.newCell(`parentIntrinsicRightMinusSpacing`, unknown());

    // parent.subtreeExtent.right - nestingHSpacing
    subtractRangePropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      parentIntrinsicBox.right,
      nestingHSpacing,
      parentIntrinsicRightMinusSpacing
    );

    // child.intrinsicBox.right <= parent.subtreeExtent.right - nestingHSpacing
    lessThanEqualPropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      childIntrinsicBox.right,
      parentIntrinsicRightMinusSpacing
    );

    const parentIntrinsicTopPlusSpacing = layoutTree.net.newCell(`parentIntrinsicTopPlusSpacing`, unknown());

    // parent.subtreeExtent.top + nestingVSpacing
    addRangePropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      parentIntrinsicBox.top,
      nestingVSpacing,
      parentIntrinsicTopPlusSpacing
    );

    // child.intrinsicBox.top >= parent.subtreeExtent.top + nestingVSpacing
    lessThanEqualPropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      childIntrinsicBox.top,
      parentIntrinsicTopPlusSpacing
    );

    const parentIntrinsicBottomMinusSpacing = layoutTree.net.newCell(`parentIntrinsicBottomMinusSpacing`, unknown());

    // parent.subtreeExtent.bottom - nestingVSpacing
    subtractRangePropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      parentIntrinsicBox.bottom,
      nestingVSpacing,
      parentIntrinsicBottomMinusSpacing
    );

    // child.intrinsicBox.bottom <= parent.subtreeExtent.bottom - nestingVSpacing
    lessThanEqualPropagator(
      `Nesting:[${this._parentId}]->[${this._childId}]`,
      layoutTree.net,
      childIntrinsicBox.bottom,
      parentIntrinsicBottomMinusSpacing
    );
  }
}
