import { writeAtLeastPropagator, exactly, addNumericRange, addRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { known } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutData } from "./LayoutData";

export class HorizontalSiblingConstraint implements Constraint {
  private _leftSiblingId: string;
  private _rightSiblingId: string;

  constructor(leftSiblingId: string, rightSiblingId: string) {
    this._leftSiblingId = leftSiblingId;
    this._rightSiblingId = rightSiblingId;
  }

  public apply(spacingMap: LayoutData): void {
    const leftSiblingSubtreeBox = spacingMap.lookupSubtreeExtentBox(this._leftSiblingId);
    const rightSiblingIdSubtreeBox = spacingMap.lookupSubtreeExtentBox(this._rightSiblingId);

    const standardHSpacing = spacingMap.standardHSpacing

    const leftSiblingRightEdge = leftSiblingSubtreeBox.maxX;
    const rightSiblingLeftEdge = rightSiblingIdSubtreeBox.minX;

    addRangePropagator(
      `HSibling:[${this._leftSiblingId}]->[${this._rightSiblingId}]`,
      spacingMap.net,
      leftSiblingRightEdge,
      standardHSpacing,
      rightSiblingLeftEdge
    )
  }
}
