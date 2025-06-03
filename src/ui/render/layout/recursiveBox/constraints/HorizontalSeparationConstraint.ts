import { addRangePropagator, atLeast, between, exactly, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { NodeId } from "../../../../../ir/StringDiagram";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeLayout } from "../NodeLayout";
import { BoundingBox } from "../BoundingBox";
import { lessThanEqual, add } from "../../../../../constraint/propagator/PropagatorExpr";
import { PropagatorInterpreter, } from "../../../../../constraint/propagator/PropagatorLanguage";
import { DebugBoundingBox } from "../DebugBoundingBox";

// Separate adjacent nodes by their subtree extents
export class HorizontalSeparationConstraint implements Constraint {
  private readonly _PADDING = 20
  private paddingCell: CellRef | null = null;

  constructor(
    private _leftNodeId: NodeId,
    private _rightNodeId: NodeId,
  ) { }

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    const solver = new PropagatorInterpreter(net, 'HorizontalSeparationConstraint');

    const leftLayout = layoutTree.nodeLayouts.get(this._leftNodeId);
    const rightLayout = layoutTree.nodeLayouts.get(this._rightNodeId);

    if (!leftLayout || !rightLayout) {
      throw new Error(`Layout for node ${this._leftNodeId} or ${this._rightNodeId} not found`);
    }

    const leftBox = this.getBox(leftLayout);
    const rightBox = this.getBox(rightLayout);

    this.paddingCell = net.newCell(`padding`, known(between(this._PADDING, this._PADDING * 3)));

    solver.addRelation`${leftBox.right} + ${this.paddingCell} = ${rightBox.left}`;
  }

  cellsToMinimize(): CellRef[] {
    return [this.paddingCell]
      .filter(cell => cell !== null) as CellRef[];
  }

  get debugBoxes(): DebugBoundingBox[] {
    return []
  }

  private getBox(layout: NodeLayout): BoundingBox {
    if (!layout.nestingParentId) {
      return layout.intrinsicBox;
    } else {
      return layout.subtreeExtentBox;
    }
  }
}