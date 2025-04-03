import { addRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class HorizontalSpacingConstraint implements Constraint {
  private _leftNodeId: string;
  private _rightNodeId: string;

  constructor(leftNodeId: string, rightNodeId: string) {
    this._leftNodeId = leftNodeId;
    this._rightNodeId = rightNodeId;
  }

  public apply(layoutTree: LayoutTree): void {
    const leftNodeLayout = layoutTree.getNodeLayout(this._leftNodeId);
    const rightNodeLayout = layoutTree.getNodeLayout(this._rightNodeId);

    const leftNodeBox = leftNodeLayout!.intrinsicBox
    const rightSubtreeBox = rightNodeLayout!.subtreeExtentBox

    const standardHSpacing = layoutTree.standardHSpacing;

    // rightNode.subtreeExtent.left = leftNode.intrinsicBox.right + standardHSpacing
    addRangePropagator(
      `HPlace:[${this._leftNodeId}]->[${this._rightNodeId}]`,
      layoutTree.net,
      leftNodeBox.right,
      standardHSpacing,
      rightSubtreeBox.left
    );
  }
}