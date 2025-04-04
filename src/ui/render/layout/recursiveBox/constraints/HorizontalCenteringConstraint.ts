import { addRangeListPropagator, addRangePropagator, divNumericRangeNumberPropagator } from '../../../../../constraint/propagator/NumericRange';
import { unknown } from '../../../../../constraint/propagator/Propagator';
import { Constraint } from '../Constraint';
import { LayoutTree } from '../LayoutTree';

// Center a node
export class HorizontalCenteringConstraint implements Constraint {
  private _nodeId: string;

  constructor(nodeId: string) {
    this._nodeId = nodeId;
  }

  public apply(layoutTree: LayoutTree): void {
    const nodeLayout = layoutTree.getNodeLayout(this._nodeId);

    if (!nodeLayout) {
      return;
    }

    const intrinsicBox = nodeLayout.intrinsicBox;
    const subtreeBox = nodeLayout.subtreeExtentBox;

    const children = layoutTree.getChildren(this._nodeId);

    if (children.length === 0) {
      layoutTree.net.equalPropagator(
          `HorizontalCenteringConstraintLeaf: ${this._nodeId}`,
          intrinsicBox.centerX,
          subtreeBox.centerX // For leaves, subtreeBox=intrinsicBox
      );
      return;
    }

    const firstChildLayout = layoutTree.getNodeLayout(children[0]!);
    const lastChildLayout = layoutTree.getNodeLayout(children[children.length - 1]!);

    if (!firstChildLayout || !lastChildLayout) {
      return;
    }

    const centerSum = layoutTree.net.newCell(`${this._nodeId} centerSum`, unknown());

    // centerSum = intrinsicBox.left + subtreeBox.width
    addRangePropagator(
      `centerSum: ${this._nodeId}`,
      layoutTree.net,
      firstChildLayout.intrinsicBox.centerX,
      lastChildLayout.intrinsicBox.centerX,
      centerSum
    );

    // centerSumDiv2 = centerSum / 2
    divNumericRangeNumberPropagator(
      `centerSumDiv2: ${this._nodeId}`,
      layoutTree.net,
      centerSum,
      2,
      intrinsicBox.centerX
    );
  }
}