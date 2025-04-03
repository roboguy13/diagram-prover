import { exactly, atMost, negateNumericRangePropagator, addNumericRange, addRangePropagator, divNumericRangeNumberPropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutData } from "./LayoutData";

export class CenterChildrenConstraint implements Constraint {
  private _parentId: string;
  private _childIds: string[];

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
    this._childIds = childIds;
  }

  public apply(spacingMap: LayoutData): void {
    if (this._childIds.length === 0) {
      return; // No children, nothing to do
    }

    const parentNodeBox = spacingMap.lookupIntrinsicBox(this._parentId);
    const parentCentertX = parentNodeBox.centerX;

    const leftmostChildId = this._childIds[0]!;
    const rightmostChildId = this._childIds[this._childIds.length - 1]!;

    const leftmostChildSubtreeBox = spacingMap.lookupSubtreeExtentBox(leftmostChildId);
    const rightmostChildSubtreeBox = spacingMap.lookupSubtreeExtentBox(rightmostChildId);

    const childrenBlockLeft = leftmostChildSubtreeBox.minX;
    const childrenBlockRight = rightmostChildSubtreeBox.maxX;

    const childrenBlockCenterSum = spacingMap.net.newCell("childrenBlockCenterSum", unknown())
    const childrenBlockCenterX = spacingMap.net.newCell("childrenBlockCenterX", unknown())

    // childrenBlockCenterSum = childrenBlockLeft + childrenBlockRight
    addRangePropagator(
      `childrenBlockCenterSum`,
      spacingMap.net,
      childrenBlockLeft,
      childrenBlockRight,
      childrenBlockCenterSum
    );

    // childrenBlockCenterX = childrenBlockCenterSum / 2
    divNumericRangeNumberPropagator(
      `childrenBlockCenterX`,
      spacingMap.net,
      childrenBlockCenterSum,
      2,
      childrenBlockCenterX
    );

    // parentCentertX = childrenBlockCenterX
    spacingMap.net.equalPropagator(
      `parentCentertX`,
      parentCentertX,
      childrenBlockCenterX
    );
  }
}
