import { layout } from "dagre";
import { addRangePropagator, exactly, lessThan, lessThanEqualPropagator, subtractRangePropagator } from "../../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";
import { add } from "lodash";

export class ContainerSizeConstraint implements Constraint {
  private readonly _PADDING_HORIZONTAL = 10;
  private readonly _PADDING_VERTICAL = 10;

  constructor(
    private _containerId: string,
    private _nestedIds: string[]
  ) {}

  apply(layoutTree: LayoutTree) {
    const containerLayout = layoutTree.getNodeLayout(this._containerId);
    const horizontalPaddingCell = layoutTree.net.newCell(
      `ContainerSizeConstraint: [horizontal padding] ${this._containerId}`,
      known(exactly(this._PADDING_HORIZONTAL))
    )

    if (!containerLayout) {
      console.warn(`Container layout for ${this._containerId} not found`);
      return;
    }

    const nestedLayouts = this._nestedIds
      .map(id => layoutTree.getNodeLayout(id))
      .filter(layout => layout !== undefined);

    if (nestedLayouts.length === 0) {
      console.warn(`No nested layouts found for container ${this._containerId}`);
      return;
    }

    const collectiveBoundingBox = new CollectiveBoundingBox(
      layoutTree.net,
      'collective intrinsic box',
      this._nestedIds,
      nestedLayouts.map(layout => layout!.intrinsicBox)
    );

    const leftWithPadding = layoutTree.net.newCell(
      `ContainerSizeConstraint: [left] ${this._containerId} with padding`,
      unknown()
    )

    const rightWithPadding = layoutTree.net.newCell(
      `ContainerSizeConstraint: [right] ${this._containerId} with padding`,
      unknown()
    )

    // leftWithPadding = container.left + PADDING_HORIZONTAL
    addRangePropagator(
      `ContainerSizeConstraint: [left] ${this._containerId} with padding`,
      layoutTree.net,
      containerLayout.intrinsicBox.left,
      horizontalPaddingCell,
      leftWithPadding
    );

    // rightWithPadding = container.right - PADDING_HORIZONTAL
    subtractRangePropagator(
      `ContainerSizeConstraint: [right] ${this._containerId} with padding`,
      layoutTree.net,
      containerLayout.intrinsicBox.right,
      horizontalPaddingCell,
      rightWithPadding
    );

    lessThanEqualPropagator(
      `ContainerSizeConstraint: [left] ${this._containerId}`,
      layoutTree.net,
      leftWithPadding,
      collectiveBoundingBox.left
    );

    lessThanEqualPropagator(
      `ContainerSizeConstraint: [right] ${this._containerId}`,
      layoutTree.net,
      collectiveBoundingBox.right,
      rightWithPadding
    );

    // TODO: We should have a different constraint that constrains the vertical spacing of the body relative to the two port bars of the container
    // lessThanEqualPropagator(
    //   `ContainerSizeConstraint: [top] ${this._containerId}`,
    //   layoutTree.net,
    //   containerLayout.intrinsicBox.top,
    //   collectiveBoundingBox.top,
    // );

    console.log(`ContainerSizeConstraint: [minY] ${this._containerId}: ${JSON.stringify(this._nestedIds)}`)
    console.log(`ContainerSizeConstraint: [minY] portBarType=${containerLayout.portBarType}`)

    layoutTree.net.addDebugCell(
      `ContainerSizeConstraint: [minY] ${this._containerId}`,
      collectiveBoundingBox.top
    );
  }
}