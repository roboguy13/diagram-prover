import { addRangePropagator, writeBetweenPropagator } from "../../../../../constraint/propagator/NumericRange";
import { Constraint } from "../Constraint";
import { LayoutData } from "./LayoutData";

export class VerticalPlacementConstraint implements Constraint {
  private _parentId: string;
  private _childId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(spacingMap: LayoutData): void {
    const parentNodeBox = spacingMap.lookupIntrinsicBox(this._parentId);
    const childSubtreeBox = spacingMap.lookupSubtreeExtentBox(this._childId);

    const standardVSpacing = spacingMap.standardVSpacing

    const parentBottom = parentNodeBox.maxY;
    const childTop = childSubtreeBox.minY;

    addRangePropagator(
      `VPlace:[${this._parentId}]->[${this._childId}]`,
      spacingMap.net,
      parentBottom,
      standardVSpacing,
      childTop
    );
  }
}
