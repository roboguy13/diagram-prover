import { addRangePropagator, atLeast, exactly } from "../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { NodeId } from "../../../../../ir/StringDiagram";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

// Separate adjacent nodes by their subtree extents
export class HorizontalSeparationConstraint implements Constraint {
  private readonly _PADDING = 20
  private paddingCell: CellRef | null = null;

  constructor(
    private _leftNodeId: NodeId,
    private _rightNodeId: NodeId,
  ) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;

    const leftLayout = layoutTree.nodeLayouts.get(this._leftNodeId);
    const rightLayout = layoutTree.nodeLayouts.get(this._rightNodeId);

    if (!leftLayout || !rightLayout) {
      throw new Error(`Layout for node ${this._leftNodeId} or ${this._rightNodeId} not found`);
    }

    const leftBox = leftLayout.subtreeExtentBox;
    const rightBox = rightLayout.subtreeExtentBox;

    this.paddingCell = net.newCell(`padding`, known(atLeast(this._PADDING)));

    // leftBox.right + this.paddingCell = rightBox.left
    addRangePropagator(
      `HorizontalSeparationConstraint`,
      net,
      leftBox.right,
      this.paddingCell,
      rightBox.left,
    )
  }

  cellsToMinimize(): CellRef[] {
    return [this.paddingCell]
      .filter(cell => cell !== null) as CellRef[];
  }
}