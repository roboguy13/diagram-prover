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
    // Handle cases with 0 or 1 child where spacing logic is different/not needed
    if (childIds.length <= 1) {
      // If 0 children, this constraint might not need to do anything specific
      // regarding child placement or spacing.

      // If 1 child, totalSpacing is 0.
      // You might need specific logic to center the single child.
      // For example, constrain child.subtreeExtentBox.centerX = parent.intrinsicBox.centerX
      if (childIds.length === 1) {
        const parentLayout = layoutTree.getNodeLayout(this._parentId)!;
        const childLayout = layoutTree.getNodeLayout(childIds[0]!)!;
        // Example: Center the single child within the parent's intrinsic box
        layoutTree.net.equalPropagator(
          `CenterSingleChild: ${this._parentId}`,
          parentLayout.intrinsicBox.centerX,
          childLayout.subtreeExtentBox.centerX
        );

        // Ensure child left is >= parent left? Add necessary constraints.
        // Maybe link child.subtree.left directly relative to parent.subtree.left or parent.intrinsic.centerX?
        // E.g. child.subtree.left = parent.intrinsic.centerX - child.subtree.width / 2
        const halfChildWidth = layoutTree.net.newCell(`halfChildWidth_${childIds[0]}`, unknown());
        divNumericRangeNumberPropagator(
          `halfChildWidthCalc_${childIds[0]}`,
          layoutTree.net,
          childLayout.subtreeExtentBox.width,
          2,
          halfChildWidth
        );
        subtractRangePropagator(
          `placeSingleChildLeft_${childIds[0]}`,
          layoutTree.net,
          parentLayout.intrinsicBox.centerX, // Or parentLayout.subtreeExtentBox.centerX if CenterXLink is used
          halfChildWidth,
          childLayout.subtreeExtentBox.left
        );
      }
      return
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
