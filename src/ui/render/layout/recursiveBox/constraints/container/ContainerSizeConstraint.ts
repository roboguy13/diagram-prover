import { layout } from "dagre";
import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, subtractRangePropagator } from "../../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";
import { add } from "lodash";

export class ContainerSizeConstraint implements Constraint {
  private readonly _PADDING_HORIZONTAL = 30;
  private readonly _PADDING_VERTICAL = 30;

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

    console.log(`nestedLayouts.length = ${nestedLayouts.length}`)

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

    // // leftWithPadding = container.left + PADDING_HORIZONTAL
    // addRangePropagator(
    //   `ContainerSizeConstraint: [left] ${this._containerId} with padding`,
    //   layoutTree.net,
    //   containerLayout.intrinsicBox.left,
    //   horizontalPaddingCell,
    //   leftWithPadding
    // );

    // // rightWithPadding = container.right - PADDING_HORIZONTAL
    // subtractRangePropagator(
    //   `ContainerSizeConstraint: [right] ${this._containerId} with padding`,
    //   layoutTree.net,
    //   containerLayout.intrinsicBox.right,
    //   horizontalPaddingCell,
    //   rightWithPadding
    // );

    // lessThanEqualPropagator(
    //   `ContainerSizeConstraint: [left] ${this._containerId}`,
    //   layoutTree.net,
    //   leftWithPadding,
    //   collectiveBoundingBox.left
    // );

    // lessThanEqualPropagator(
    //   `ContainerSizeConstraint: [right] ${this._containerId}`,
    //   layoutTree.net,
    //   collectiveBoundingBox.right,
    //   rightWithPadding
    // );

    // TODO: We should have a different constraint that constrains the vertical spacing of the body relative to the two port bars of the container
    // lessThanEqualPropagator(
    //   `ContainerSizeConstraint: [top] ${this._containerId}`,
    //   layoutTree.net,
    //   containerLayout.intrinsicBox.top,
    //   collectiveBoundingBox.top,
    // );

    const leftSpacingCell = layoutTree.net.newCell(
      `ContainerSizeConstraint: [left spacing] ${this._containerId}`,
      known(exactly(this._PADDING_HORIZONTAL))
    )

    const rightSpacingCell = layoutTree.net.newCell(
      `ContainerSizeConstraint: [right spacing] ${this._containerId}`,
      known(exactly(this._PADDING_HORIZONTAL))
    )

    const firstNestedLayout = nestedLayouts[0];

    subtractRangePropagator(
      `ContainerSizeConstraint: [left spacing] ${this._containerId}`,
      layoutTree.net,
      collectiveBoundingBox.left,
      containerLayout.intrinsicBox.left,
      leftSpacingCell
    );

    subtractRangePropagator(
      `ContainerSizeConstraint: [right spacing] ${this._containerId}`,
      layoutTree.net,
      containerLayout.intrinsicBox.right,
      collectiveBoundingBox.right,
      rightSpacingCell
    );

    layoutTree.net.equalPropagator(
      `ContainerSizeConstraint: [equal spacing] ${this._containerId}`,
      leftSpacingCell,
      rightSpacingCell
    );

    layoutTree.net.addDebugCell(
      `debug: leftSpacingCell`,
      leftSpacingCell
    );

    layoutTree.net.addDebugCell(
      `debug: rightSpacingCell`,
      rightSpacingCell
    );


    // layoutTree.net.equalPropagator(
    //   `ContainerSizeConstraint: [centerX] ${this._containerId}`,
    //   containerLayout.intrinsicBox.centerX,
    //   firstNestedLayout!.intrinsicBox.centerX
    // );

    layoutTree.net.addDebugCell(`ContainerConstraint Debug ${this._containerId}: Parent Top`, containerLayout.intrinsicBox.top);
    layoutTree.net.addDebugCell(`ContainerConstraint Debug ${this._containerId}: Parent Bottom`, containerLayout.intrinsicBox.bottom);
    layoutTree.net.addDebugCell(`ContainerConstraint Debug ${this._containerId}: Collective Top`, collectiveBoundingBox.top);
    layoutTree.net.addDebugCell(`ContainerConstraint Debug ${this._containerId}: Collective Bottom`, collectiveBoundingBox.bottom);

    console.log(`ContainerSizeConstraint: [minY] ${this._containerId}: ${JSON.stringify(this._nestedIds)}`)
    console.log(`ContainerSizeConstraint: [minY] portBarType=${containerLayout.portBarType}`)

    layoutTree.net.addDebugCell(
      `ContainerSizeConstraint: [minY] ${this._containerId}`,
      collectiveBoundingBox.top
    );
  }
}