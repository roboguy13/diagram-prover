import { lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { Constraint } from "../Constraint";
import { BoundingBox } from "../BoundingBox";
import { SpacingMap } from "./SpacingMap";

// Constrain the nested node to be inside the nesting node
export class NestedNodeConstraint implements Constraint {
  private _parentId: string;
  private _childId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(spacingMap: SpacingMap): void {
    // let parentBoundingBox = spacingMap.lookupBoundingBox(this._parentId);
    // let childBoundingBox = spacingMap.lookupBoundingBox(this._childId);

    // this.applyX(spacingMap, parentBoundingBox, childBoundingBox);
    // this.applyY(spacingMap, parentBoundingBox, childBoundingBox);
  }

  private applyX(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    this.applyXMin(spacingMap, parentBoundingBox, childBoundingBox);
    this.applyXMax(spacingMap, parentBoundingBox, childBoundingBox);
  }

  private applyY(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    this.applyYMin(spacingMap, parentBoundingBox, childBoundingBox);
    this.applyYMax(spacingMap, parentBoundingBox, childBoundingBox);
  }

  // parent.minX <= child.minX
  private applyXMin(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint X min`,
      spacingMap.net,
      parentBoundingBox.minX,
      childBoundingBox.minX
    );
  }

  // child.maxX <= parent.maxX
  private applyXMax(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint X max`,
      spacingMap.net,
      childBoundingBox.maxX,
      parentBoundingBox.maxX
    );
  }

  // parent.minY <= child.minY
  private applyYMin(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint Y min`,
      spacingMap.net,
      parentBoundingBox.minY,
      childBoundingBox.minY
    );
  }

  // child.maxY <= parent.maxY
  private applyYMax(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint Y max`,
      spacingMap.net,
      childBoundingBox.maxY,
      parentBoundingBox.maxY
    );
  }
}
