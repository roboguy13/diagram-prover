import { addRangePropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class VerticalOrderingConstraint implements Constraint {
  constructor(
    private _sourceNodeId: string,
    private _targetNodeId: string) {
  }

  public apply(layoutTree: LayoutTree): void {
    const sourceNodeLayout = layoutTree.getNodeLayout(this._sourceNodeId)!;
    const targetNodeLayout = layoutTree.getNodeLayout(this._targetNodeId)!;
    const net = layoutTree.net;

    const verticalSpacing = layoutTree.standardVSpacing;

    const sourceBottomPlusSpacing = net.newCell(
      `temp_${this._sourceNodeId}.bottom+${net.cellDescription(verticalSpacing)}`,
      unknown()
    );

    // sourceBottomPlusSpacing = source.intrinsicBox.bottom + verticalSpacing
    addRangePropagator(
      `calc_${net.cellDescription(sourceBottomPlusSpacing)}`,
      net,
      sourceNodeLayout.intrinsicBox.bottom,
      verticalSpacing,
      sourceBottomPlusSpacing
    );

    // sourceBottomPlusSpacing <= target.intrinsicBox.top
    lessThanEqualPropagator(
      `${net.cellDescription(sourceBottomPlusSpacing)} <= ${this._targetNodeId}.top`,
      net,
      sourceBottomPlusSpacing,
      targetNodeLayout.intrinsicBox.top
    );
  }
}