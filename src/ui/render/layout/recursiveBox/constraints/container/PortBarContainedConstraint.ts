import { addRangePropagator, exactly, lessThanEqualPropagator, subtractRangePropagator } from "../../../../../../constraint/propagator/NumericRange";
import { CellRef, known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { CollectiveBoundingBox } from "../../CollectiveBoundingBox";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

// The body nodes should be vertically "contained" between the two port bars.
export class PortBarContainedConstraint implements Constraint {
  private readonly _PADDING_VERTICAL = 30;

  constructor(
    private _nestedIds: string[],
    private _parameterPortBarId: string,
    private _resultPortBarId: string
  ) { }

  apply(layoutTree: LayoutTree) {
    const parameterPortBarLayout = layoutTree.getNodeLayout(this._parameterPortBarId);
    const resultPortBarLayout = layoutTree.getNodeLayout(this._resultPortBarId);

    const verticalPaddingCell = layoutTree.net.newCell(
      `PortBarContainedConstraint: [vertical padding] ${this._parameterPortBarId} and ${this._resultPortBarId}`,
      known(exactly(this._PADDING_VERTICAL))
    );

    if (!parameterPortBarLayout || !resultPortBarLayout) {
      console.warn(`Port bar layouts for ${this._parameterPortBarId} or ${this._resultPortBarId} not found`);
      return;
    }

    const nestedLayouts = this._nestedIds
      .map(id => layoutTree.getNodeLayout(id))
      .filter(layout => layout !== undefined && !layout.portBarType);

    if (nestedLayouts.length === 0) {
      console.warn(`No nested layouts found for port bar contained constraint`);
      return;
    }

    const collectiveBoundingBox = new CollectiveBoundingBox(
      layoutTree.net,
      'collective intrinsic box',
      this._nestedIds,
      nestedLayouts.map(layout => layout!.intrinsicBox)
    );

    const topWithPadding = layoutTree.net.newCell(
      `PortBarContainedConstraint: [top] ${this._parameterPortBarId} with padding`,
      unknown()
    );

    const bottomWithPadding = layoutTree.net.newCell(
      `PortBarContainedConstraint: [bottom] ${this._resultPortBarId} with padding`,
      unknown()
    );

    subtractRangePropagator(
      `PortBarContainedConstraint: [top] ${this._resultPortBarId} with padding`,
      layoutTree.net,
      resultPortBarLayout.intrinsicBox.top,
      verticalPaddingCell,
      topWithPadding
    );

    addRangePropagator(
      `PortBarContainedConstraint: [bottom] ${this._parameterPortBarId} with padding`,
      layoutTree.net,
      parameterPortBarLayout.intrinsicBox.bottom,
      verticalPaddingCell,
      bottomWithPadding
    );

    lessThanEqualPropagator(
      `PortBarContainedConstraint: [top, <=] ${this._resultPortBarId} with padding`,
      layoutTree.net,
      collectiveBoundingBox.bottom,
      topWithPadding,
    );

    lessThanEqualPropagator(
      `PortBarContainedConstraint: [bottom, <=] ${this._parameterPortBarId} with padding`,
      layoutTree.net,
      bottomWithPadding,
      collectiveBoundingBox.top,
    );
  }

  cellsToMinimize(): CellRef[] {
    return []
  }
}