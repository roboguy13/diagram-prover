import {
  addRangePropagator,
  subtractRangePropagator,
  lessThanEqualPropagator,
  exactly,
  atLeast,
  between
} from "../../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { equal } from "../../../../../../constraint/propagator/PropagatorExpr";
import { PropagatorInterpreter, } from "../../../../../../constraint/propagator/PropagatorLanguage";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

// Constrain the size of a nested node based on the contained subgraph, and center the subgraph within the container.
export class ContainerSizeConstraint implements Constraint {
  private readonly _PADDING_HORIZONTAL = 30;
  private readonly _PADDING_VERTICAL = 30;

  private verticalPadding: CellRef | null = null;
  private horizontalPadding: CellRef | null = null;

  constructor(
    private _containerId: string,
    private _nestedIds: string[]
  ) {}

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net;
    const solver = new PropagatorInterpreter(net, 'ContainerSizeConstraint');

    const containerLayout = layoutTree.getNodeLayout(this._containerId);

    if (!containerLayout) {
      console.warn(`Container layout not found for ID: ${this._containerId}`);
      return;
    }

    const nestedLayouts = this._nestedIds.map(id => layoutTree.getNodeLayout(id)).filter(layout => layout !== undefined);

    const nestedBoundingBoxes = nestedLayouts.map(layout => layout.subtreeExtentBox);
    const collectiveBoundingBox = new CollectiveBoundingBox(
      net,
      "Container",
      this._nestedIds,
      nestedBoundingBoxes
    );

    const containerBox = containerLayout.intrinsicBox;

    const collectiveLeft = collectiveBoundingBox.left;
    const collectiveTop = collectiveBoundingBox.top;
    const collectiveBottom = collectiveBoundingBox.bottom;
    const collectiveRight = collectiveBoundingBox.right;

    this.verticalPadding = net.newCell(`verticalPadding`, known(between(this._PADDING_VERTICAL, this._PADDING_VERTICAL * 3)));
    this.horizontalPadding = net.newCell(`horizontalPadding`, known(between(this._PADDING_HORIZONTAL, this._PADDING_HORIZONTAL * 3)));

    solver.addRelation`${collectiveLeft} = ${this.horizontalPadding}`;
    solver.addRelation`${collectiveTop} = ${this.verticalPadding}`;

    this.padWith(solver, collectiveRight, containerBox.width, this.horizontalPadding);
    this.padWith(solver, collectiveBottom, containerBox.height, this.verticalPadding);
  }

  cellsToMinimize(): CellRef[] {
    let paddingCellsToMinimize = [
      this.verticalPadding,
      this.horizontalPadding,
    ].filter(cell => cell !== undefined && cell !== null) as CellRef[];

    console.log(`Padding cells to minimize: ${paddingCellsToMinimize.map(cell => cell.toString())}`);

    return paddingCellsToMinimize
  }

  private padWith(
    solver: PropagatorInterpreter,
    smallerEdge: CellRef,
    largerEdge: CellRef,
    padding: CellRef
  ): void {
    // console.log(`padWith: Relating smallerEdge (${layoutTree.net.cellDescription(smallerEdge)}), largerEdge (${layoutTree.net.cellDescription(largerEdge)}), padding (${layoutTree.net.cellDescription(padding)})`);

    solver.addRelation`${padding} = ${largerEdge} - ${smallerEdge}`;
  }
}