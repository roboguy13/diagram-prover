import { writeBetweenPropagator } from "../../../../../constraint/propagator/NumericRange";
import { VERTICAL_PADDING } from "../SpacingConstraints";
import { Constraint } from "../Constraint";
import { SpacingMap } from "./SpacingMap";

export class ParentChildConstraint implements Constraint {
  private _parentId: string;
  private _childId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(spacingMap: SpacingMap): void {
    let ySpacing = spacingMap.getYSpacing(this._parentId, this._childId);
    writeBetweenPropagator(spacingMap.net, ySpacing, VERTICAL_PADDING, VERTICAL_PADDING * 1.2);
    // spacingMap.net.writeCell({ description: `ySpacing ∈ []` }, ySpacing, known(between(VERTICAL_PADDING, VERTICAL_PADDING * 1.3)))
  }
}
