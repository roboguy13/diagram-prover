import {
  addRangePropagator,
  subtractRangePropagator,
  lessThanEqualPropagator,
  exactly,
  atLeast,
  between
} from "../../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

// Constrain the size of a nested node based on the contained subgraph, and center the subgraph within the container.
export class ContainerSizeConstraint implements Constraint {
  private readonly _PADDING_HORIZONTAL = 20;
  private readonly _PADDING_VERTICAL = 20;

  private verticalPadding: CellRef | null = null;
  private horizontalPadding: CellRef | null = null;

  constructor(
    private _containerId: string,
    private _nestedIds: string[]
  ) {}

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net;

    const containerLayout = layoutTree.getNodeLayout(this._containerId);

    console.log(`ContainerSizeConstraint: Applying for container ${this._containerId}`);

    if (!containerLayout) {
      console.warn(`Container layout not found for ID: ${this._containerId}`);
      return;
    }

    const nestedChildrenIds = this._nestedIds
    const nestedLayouts = this._nestedIds.map(id => layoutTree.getNodeLayout(id)).filter(layout => layout !== undefined);

    if (nestedLayouts.length === 0) {
      console.warn(`No nested layouts found for IDs: ${this._nestedIds}`);
      return;
    }

    const nestedBoundingBoxes = nestedLayouts.map(layout => layout.subtreeExtentBox);
    const collectiveBoundingBox = new CollectiveBoundingBox(
      net,
      "Container",
      this._nestedIds,
      nestedBoundingBoxes
    );

    console.log(`ContainerSizeConstraint: Container ${this._containerId} has nested children [${nestedChildrenIds.join(', ')}]`);

    const containerBox = containerLayout.intrinsicBox;

    const collectiveLeft = collectiveBoundingBox.left;
    const collectiveRight = collectiveBoundingBox.right;
    const collectiveTop = collectiveBoundingBox.top;
    const collectiveBottom = collectiveBoundingBox.bottom;

    this.verticalPadding = net.newCell(`verticalPadding`, known(between(this._PADDING_VERTICAL, this._PADDING_VERTICAL * 3)));
    this.horizontalPadding = net.newCell(`horizontalPadding`, known(between(this._PADDING_HORIZONTAL, this._PADDING_HORIZONTAL * 3)));

    net.equalPropagator(
      `Collective left = horizontalPadding`,
      collectiveLeft,
      this.horizontalPadding,
    );

    net.equalPropagator(
      `Collective top = verticalPadding`,
      collectiveTop,
      this.verticalPadding,
    );

    console.log(`ContainerSizeConstraint: Applying padWith for container ${this._containerId} and ${nestedChildrenIds.length} children.`);
    this.padWith(layoutTree, collectiveRight, containerBox.width, this.horizontalPadding);
    this.padWith(layoutTree, collectiveBottom, containerBox.height, this.verticalPadding);

    net.addDebugCell(
      `vertical padding`,
      this.verticalPadding
    );

    net.addDebugCell(
      `horizontal padding`,
      this.horizontalPadding
    );
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
    layoutTree: LayoutTree,
    smallerEdge: CellRef,
    largerEdge: CellRef,
    padding: CellRef
  ): void {
    const net = layoutTree.net;
    console.log(`padWith: Relating smallerEdge (${layoutTree.net.cellDescription(smallerEdge)}), largerEdge (${layoutTree.net.cellDescription(largerEdge)}), padding (${layoutTree.net.cellDescription(padding)})`);

    subtractRangePropagator(
      `Larger edge - smaller edge = padding`,
      net,
      largerEdge,
      smallerEdge,
      padding
    );
  }
}