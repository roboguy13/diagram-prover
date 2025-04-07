import { addRangePropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class VerticalOrderingConstraint implements Constraint {
  constructor(private _parentNodeId: string, private _childNodeId: string) {
    console.log(`VerticalOrderingConstraint created for parent: ${_parentNodeId}, child: ${_childNodeId}`);
  }

  apply(layoutTree: LayoutTree): void {
    const parentNodeLayout = layoutTree.getNodeLayout(this._parentNodeId)!;
    const childNodeLayout = layoutTree.getNodeLayout(this._childNodeId)!;
    const net = layoutTree.net;

    const verticalSpacing = layoutTree.standardVSpacing;

    const parentBottomPlusSpacing = net.newCell(
      `temp_${this._parentNodeId}.bottom+${net.cellDescription(verticalSpacing)}`,
      unknown()
    );

    // parentBottomPlusSpacing = parent.intrinsicBox.bottom + verticalSpacing
    addRangePropagator(
      `calc_${net.cellDescription(parentBottomPlusSpacing)}`,
      net,
      parentNodeLayout.intrinsicBox.bottom,
      verticalSpacing,
      parentBottomPlusSpacing
    );

    // parentBottomPlusSpacing <= child.intrinsicBox.top
    lessThanEqualPropagator(
      `${net.cellDescription(parentBottomPlusSpacing)} <= ${this._childNodeId}.top`,
      net,
      parentBottomPlusSpacing,
      childNodeLayout.intrinsicBox.top
    );
  }
}