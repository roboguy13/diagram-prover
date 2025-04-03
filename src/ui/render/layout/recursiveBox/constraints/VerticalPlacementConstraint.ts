import { addRangePropagator, exactly, NumericRange } from "../../../../../constraint/propagator/NumericRange";
import { known, PropagatorNetwork } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class VerticalPlacementConstraint implements Constraint {
  private _parentId: string;
  private _childId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(layoutTree: LayoutTree): void {
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayout = layoutTree.getNodeLayout(this._childId);

    if (parentLayout && childLayout) {
      const parentIntrinsicBox = parentLayout.intrinsicBox;
      const childSubtreeBox = childLayout.subtreeExtentBox;

      console.log(`======= VerticalPlacementConstraint: ${this._parentId} -> ${this._childId}`);

      // child.subtreeExtent.top = parent.intrinsicBox.bottom + standardVSpacing
      addRangePropagator(
        `VPlace:[${this._parentId}]->[${this._childId}]`,
        layoutTree.net,
        parentIntrinsicBox.bottom,
        layoutTree.standardVSpacing,
        childSubtreeBox.top
      );
    }
  }
}
