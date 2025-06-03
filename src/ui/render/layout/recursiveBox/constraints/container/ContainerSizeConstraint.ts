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
import { BoundingBox } from "../../BoundingBox";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { DebugBoundingBox } from "../../DebugBoundingBox";
import { LayoutTree } from "../../LayoutTree";

// Constrain the size of a nested node based on the contained subgraph, and center the subgraph within the container.
export class ContainerSizeConstraint implements Constraint {
  private readonly _PADDING_HORIZONTAL = 30;
  private readonly _PADDING_VERTICAL = 30;

  private verticalPadding: CellRef | null = null;
  private horizontalPadding: CellRef | null = null;

  private _debugBoxes: DebugBoundingBox[] = [];

  private _containerBox: BoundingBox | null = null;
  private _collectiveBox: BoundingBox | null = null;

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

    this.verticalPadding = net.newCell(`verticalPadding`, known(exactly(this._PADDING_VERTICAL)));
    this.horizontalPadding = net.newCell(`horizontalPadding`, known(exactly(this._PADDING_HORIZONTAL)));

    solver.addRelation`${collectiveLeft} >= ${this.horizontalPadding}`;
    solver.addRelation`${collectiveTop} >= ${this.verticalPadding}`;

    // // Horizontally center the collective bounding box within the container
    // solver.addRelation`${collectiveBoundingBox.centerX} = ${containerBox.centerX}`;
    // // solver.addRelation`${containerBox.width} - ${collectiveBoundingBox.centerX} = ${collectiveLeft}`;

    this.padWith(solver, collectiveRight, containerBox.width, this.horizontalPadding);
    this.padWith(solver, collectiveBottom, containerBox.height, this.verticalPadding);

    const debugLayout = nestedLayouts[nestedLayouts.length-1]!
    this._debugBoxes.push(new DebugBoundingBox(collectiveBoundingBox, '', this._containerId));
    // this._debugBoxes.push(DebugBoundingBox.createFromIntrinsicBox(debugLayout));

    this._containerBox = containerBox;
    this._collectiveBox = collectiveBoundingBox;

    // net.addDebugCell(`[DEBUG]: Container (${this._containerId}): Collective Width`, collectiveBoundingBox.width);
    // net.addDebugCell(`[DEBUG]: Container (${this._containerId}): Collective Height`, collectiveBoundingBox.height);
    // net.addDebugCell(`[DEBUG]: Container (${this._containerId}): Collective Top`, collectiveBoundingBox.top);
    // net.addDebugCell(`[DEBUG]: Container (${this._containerId}): Collective Bottom`, collectiveBoundingBox.bottom);

    // for (const layout of nestedLayouts) {
    //   net.addDebugCell(`[DEBUG]: Subtree top`, layout.subtreeExtentBox.top);
    //   net.addDebugCell(`[DEBUG]: Subtree bottom`, layout.subtreeExtentBox.bottom);
    //   // net.addDebugCell(`[DEBUG]: Subtree left`, layout.subtreeExtentBox.left);
    //   // net.addDebugCell(`[DEBUG]: Subtree right`, layout.subtreeExtentBox.right);
    // }
  }

  cellsToMinimize(): CellRef[] {
    let paddingCellsToMinimize = [
      // this.verticalPadding,
      // this.horizontalPadding,
      // this._containerBox?.width,
      // this._containerBox?.height,
      this._collectiveBox?.width,
      this._collectiveBox?.height,
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

  get debugBoxes(): DebugBoundingBox[] {
    return this._debugBoxes;
  }
}