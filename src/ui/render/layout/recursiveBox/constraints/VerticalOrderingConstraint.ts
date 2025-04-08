import { addRangePropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class VerticalOrderingConstraint implements Constraint {
  constructor(private _parentNodeId: string, private _childNodeId: string) {
  }

  apply(layoutTree: LayoutTree): void {
    const parentNodeLayout = layoutTree.getNodeLayout(this._parentNodeId)!;
    const childNodeLayout = layoutTree.getNodeLayout(this._childNodeId)!;

    if (childNodeLayout.nestingParentId === this._parentNodeId) {
      return;
    }

    if (childNodeLayout.portBarType) {
      console.warn(`VerticalOrderingConstraint: Cannot apply constraint with port bars involved.`);
      return;
    }

    console.log(`VerticalOrderingConstraint created for parent: ${this._parentNodeId}(${parentNodeLayout.label}), child: ${this._childNodeId}(${childNodeLayout.label})`,
      `nestingParentId: ${childNodeLayout.nestingParentId}`
    );
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