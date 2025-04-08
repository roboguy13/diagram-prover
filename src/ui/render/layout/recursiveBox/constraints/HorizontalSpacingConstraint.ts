import { addRangePropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class HorizontalSpacingConstraint implements Constraint {
  constructor(private _nodeId1: string, private _nodeId2: string) {
  }

  // node1.right + horizontalSpacing <= node2.left
  apply(layoutTree: LayoutTree): void {
    const nodeLayout1 = layoutTree.getNodeLayout(this._nodeId1)!;
    const nodeLayout2 = layoutTree.getNodeLayout(this._nodeId2)!;

    const net = layoutTree.net;
    const horizontalSpacing = layoutTree.standardHSpacing;
    const node1IntrinsicBox = nodeLayout1.intrinsicBox;
    const node2IntrinsicBox = nodeLayout2.intrinsicBox;

    if (nodeLayout1.portBarType || nodeLayout2.portBarType) {
      console.warn(`HorizontalSpacingConstraint: Cannot apply constraint with port bars involved.`);
      return;
    }

    // node1.right + horizontalSpacing
    const node1RightPlusSpacing = net.newCell(
      `temp_${this._nodeId1}.right+${net.cellDescription(horizontalSpacing)}`,
      unknown()
    );

    addRangePropagator(
      `calc_${net.cellDescription(node1RightPlusSpacing)}`,
      net,
      node1IntrinsicBox.right,
      horizontalSpacing,
      node1RightPlusSpacing
    );

    // node1.right + horizontalSpacing <= node2.left
    lessThanEqualPropagator(
      `${net.cellDescription(node1RightPlusSpacing)} <= ${this._nodeId2}.left`,
      net,
      node1RightPlusSpacing,
      node2IntrinsicBox.left
    );
  }
}
