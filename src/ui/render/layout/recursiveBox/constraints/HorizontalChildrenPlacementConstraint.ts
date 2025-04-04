import { layout } from "dagre";
import { addRangeListPropagator, addRangePropagator, divNumericRangeNumberPropagator, multNumericRangeNumber, multNumericRangeNumberPropagator, subtractRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class HorizontalChildrenPlacementConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string) {
    this._parentId = parentId;
  }

  public apply(layoutTree: LayoutTree): void {
    const childIds = layoutTree.getChildren(this._parentId);

    if (childIds.length === 0) {
      return;
    }

    const parentLayout = layoutTree.getNodeLayout(this._parentId)!
    const childLayouts = childIds.map(childId => layoutTree.getNodeLayout(childId));
    const totalChildSubtreeWidth = layoutTree.net.newCell(`totalChildSubtreeWidth`, unknown());

    // totalChildSubtreeWidth = sum(children.subtree.width)
    addRangeListPropagator(
      `totalChildSubtreeWidth: ${this._parentId}`,
      layoutTree.net,
      childLayouts.map(childLayout => childLayout!.subtreeExtentBox.width),
      totalChildSubtreeWidth
    );

    const totalChildSubtreeWidthWithSpacing = layoutTree.net.newCell(`totalChildSubtreeWidthWithSpacing`, unknown());
    const totalSpacing = layoutTree.net.newCell(`totalSpacing`, unknown());

    // totalSpacing = children.spacing * (children.count - 1)
    multNumericRangeNumberPropagator(
      `totalSpacing: ${this._parentId}`,
      layoutTree.net,
      layoutTree.standardHSpacing,
      childIds.length - 1,
      totalSpacing
    );

    // totalChildSubtreeWidthWithSpacing = totalChildSubtreeWidth + children.spacing
    addRangePropagator(
      `totalChildSubtreeWidthWithSpacing: ${this._parentId}`,
      layoutTree.net,
      totalChildSubtreeWidth,
      totalSpacing,
      totalChildSubtreeWidthWithSpacing
    );

    const parentSubtreeMinusTotalChildWidthWithSpacing = layoutTree.net.newCell(`parentSubtreeMinusTotalChildWidthWithSpacing`, unknown());
    const firstChildLayout = childLayouts[0]!;

    subtractRangePropagator(
      `parentSubtreeMinusTotalChildWidthWithSpacing: ${this._parentId}`,
      layoutTree.net,
      parentLayout.subtreeExtentBox.width,
      totalChildSubtreeWidthWithSpacing,
      parentSubtreeMinusTotalChildWidthWithSpacing
    );


    const placementOffset = layoutTree.net.newCell(`placementOffset`, unknown());
    divNumericRangeNumberPropagator(
      `placementOffset: ${this._parentId}`,
      layoutTree.net,
      parentSubtreeMinusTotalChildWidthWithSpacing,
      2,
      placementOffset
    );

    addRangePropagator(
      `firstChildPlacement: ${this._parentId}`,
      layoutTree.net,
      parentLayout.subtreeExtentBox.left,
      placementOffset,
      firstChildLayout.subtreeExtentBox.left
    )
  }
}
