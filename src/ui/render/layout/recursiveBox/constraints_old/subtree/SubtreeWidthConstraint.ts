import { layout } from "dagre";
import { addRangeListPropagator, addRangePropagator, maxRangeListPropagator, maxRangePropagator, multNumericRangeNumberPropagator, NumericRange } from "../../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../../constraint/propagator/Propagator";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class SubtreeWidthConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
  }

  apply(layoutTree: LayoutTree): void {
    const childIds = layoutTree.getChildren(this._parentId);

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayouts = childIds.map(childId => layoutTree.getNodeLayout(childId));

    if (!parentLayout) {
      return;
    }

    const childWidths = childLayouts.map(childLayout => childLayout!.subtreeExtentBox.width);

    if (childWidths.length === 1) {
      return
    }

    const sumChildWidths = layoutTree.net.newCell(`sumChildWidths`, unknown());

    // sumChildWidths = sum(children.subtree.width)
    addRangeListPropagator(
      `sumChildWidths: ${this._parentId}`,
      layoutTree.net,
      childWidths,
      sumChildWidths
    );

    // if (this._parentId === "term-1") {
    //   for (const childWidth of childWidths) {
    //     layoutTree.net.addDebugCell(this._parentId, childWidth);
    //   }

    //   layoutTree.net.addDebugCell(this._parentId, sumChildWidths);
    // }

    const totalSpacing = layoutTree.net.newCell(`totalSpacing`, unknown());

    // totalSpacing = children.spacing * (children.count - 1)
    multNumericRangeNumberPropagator(
      `totalSpacing: ${this._parentId}`,
      layoutTree.net,
      layoutTree.standardHSpacing,
      childIds.length - 1,
      totalSpacing
    );

    const totalCombinedChildWidth = layoutTree.net.newCell(`totalCombinedChildWidth`, unknown());

    // totalCombinedChildWidth = sumChildWidths + totalSpacing
    addRangePropagator(
      `totalCombinedChildWidth: ${this._parentId}`,
      layoutTree.net,
      sumChildWidths,
      totalSpacing,
      totalCombinedChildWidth
    );

    const parentIntrinsicBox = parentLayout.intrinsicBox;
    const parentSubtreeBox = parentLayout.subtreeExtentBox;

    // parent.subtree.width = max(parent.intrinsic.width, totalCombinedChildWidth)
    maxRangePropagator(
      `parentWidth: ${this._parentId}`,
      layoutTree.net,
      parentIntrinsicBox.width,
      totalCombinedChildWidth,
      parentSubtreeBox.width
    );
  }
}
