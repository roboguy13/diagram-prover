import { max } from "lodash";
import { addNumericRange, addRangeListPropagator, addRangePropagator, maxRangeListPropagator, maxRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutData } from "./LayoutData";
import { BoundingBox } from "../BoundingBox";

export class SubtreeDimensionConstraint implements Constraint {
  private _parentId: string;
  private _childIds: string[];

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
    this._childIds = childIds;
  }

  public apply(layoutData: LayoutData): void {
    const parentIntrinsicBox = layoutData.lookupIntrinsicBox(this._parentId);
    const parentSubtreeBox = layoutData.lookupSubtreeExtentBox(this._parentId);
    const net = layoutData.net;

    if (this._childIds.length === 0) {
      net.equalPropagator(
        `SubtreeDimensionConstraintW: ${this._parentId}`,
        parentIntrinsicBox.width,
        parentSubtreeBox.width
      );

      net.equalPropagator(
        `SubtreeDimensionConstraintH: ${this._parentId}`,
        parentIntrinsicBox.height,
        parentSubtreeBox.height
      );

      return;
    }

    const childSubtreeBoxes = this._childIds.map((childId) =>
      layoutData.lookupSubtreeExtentBox(childId)
    );

    this.applyHeight(layoutData, parentSubtreeBox, childSubtreeBoxes);
    this.applyWidth(layoutData, parentSubtreeBox, childSubtreeBoxes);
  }

  private applyHeight(layoutData: LayoutData, parentSubtreeBox: BoundingBox, childSubtreeBoxes: BoundingBox[]) {
    const vSpacing = layoutData.standardVSpacing;
    const hSpacing = layoutData.standardHSpacing;
    const net = layoutData.net;

    const childSubtreeHeights = childSubtreeBoxes.map(
      (childSubtreeBox) => childSubtreeBox.height
    );
    const maxChildSubtreeHeight = net.newCell(`maxChildSubtreeHeight`, unknown());

    maxRangeListPropagator(
      `maxChildSubtreeHeight: ${this._parentId}`,
      net,
      childSubtreeHeights,
      maxChildSubtreeHeight
    );

    const heightPlusVSpacing = net.newCell(`heightPlusVSpacing`, unknown());
    addRangePropagator(
      `heightPlusVSpacing: ${this._parentId}`,
      net,
      maxChildSubtreeHeight,
      vSpacing,
      heightPlusVSpacing
    );

    addRangePropagator(
      `SubtreeDimensionConstraintH: ${this._parentId}`,
      net,
      heightPlusVSpacing,
      maxChildSubtreeHeight,
      parentSubtreeBox.height
    );
  }

  private applyWidth(layoutData: LayoutData, parentSubtreeBox: BoundingBox, childSubtreeBoxes: BoundingBox[]) {
    const childrenSubtreeWidths = childSubtreeBoxes.map(
      (childSubtreeBox) => childSubtreeBox.width
    );

    const totalChildWidth = layoutData.net.newCell(`totalChildWidth`, unknown());

    addRangeListPropagator(
      `SubtreeDimensionConstraintW: ${this._parentId}`,
      layoutData.net,
      childrenSubtreeWidths,
      totalChildWidth
    );

    const parentIntrinsicBox = layoutData.lookupIntrinsicBox(this._parentId);
    const parentIntrinsicWidth = parentIntrinsicBox.width;

    maxRangePropagator(
      layoutData.net,
      parentIntrinsicWidth,
      totalChildWidth,
      parentSubtreeBox.width
    );
  }
}
