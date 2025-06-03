import { addRangePropagator, between, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { PropagatorInterpreter, } from "../../../../../constraint/propagator/PropagatorLanguage";
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
    const solver = new PropagatorInterpreter(net, 'VerticalSeparationConstraint');

    const topLayout = layoutTree.nodeLayouts.get(this._topNodeId);
    const bottomLayout = layoutTree.nodeLayouts.get(this._bottomNodeId);

    if (!topLayout || !bottomLayout) {
      throw new Error(`Layout for node ${this._topNodeId} or ${this._bottomNodeId} not found`);
    }

    const topBox = topLayout.intrinsicBox;
    const bottomBox = bottomLayout.intrinsicBox;

    this._paddingCell = net.newCell(`padding`, known(between(this._PADDING, this._PADDING*3)));

    if (!this._paddingCell) {
      throw new Error(`Padding cell not found`);
    }

    solver.addRelation`${topBox.bottom} + ${this._paddingCell} <= ${bottomBox.top}`;
  }

  cellsToMinimize(): CellRef[] {
    return [this._paddingCell].filter(cell => cell !== null) as CellRef[];
  }

  get debugBoxes() {
    return [];
  }
}
