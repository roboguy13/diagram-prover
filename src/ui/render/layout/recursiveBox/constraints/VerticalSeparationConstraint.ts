import { addRangePropagator, between, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";

export class VerticalSeparationConstraint  implements Constraint {
  private readonly _PADDING = 20;
  private _paddingCell: CellRef | null = null;

  constructor(
    private _topNodeId: string,
    private _bottomNodeId: string,
  ) {}

  apply(layoutTree: any): void {
    const net = layoutTree.net;

    const topLayout = layoutTree.nodeLayouts.get(this._topNodeId);
    const bottomLayout = layoutTree.nodeLayouts.get(this._bottomNodeId);

    if (!topLayout || !bottomLayout) {
      throw new Error(`Layout for node ${this._topNodeId} or ${this._bottomNodeId} not found`);
    }

    const topBox = topLayout.intrinsicBox;
    const bottomBox = bottomLayout.intrinsicBox;

    this._paddingCell = net.newCell(`padding`, known(between(this._PADDING, this._PADDING*3)));

    const requiredBottomBoxTop = net.newCell(`requiredBottomBoxTop`, unknown());

    // requiredBottomBoxTop = topBox.bottom + paddingCell
    addRangePropagator(
      `VerticalSeparationConstraint`,
      net,
      topBox.bottom,
      this._paddingCell!,
      requiredBottomBoxTop,
    );

    // requireBottomBoxTop <= bottomBox.top
    lessThanEqualPropagator(
      `VerticalSeparationConstraint`,
      net,
      requiredBottomBoxTop,
      bottomBox.top,
    );
  }

  cellsToMinimize(): CellRef[] {
    return [this._paddingCell].filter(cell => cell !== null) as CellRef[];
  }
}
