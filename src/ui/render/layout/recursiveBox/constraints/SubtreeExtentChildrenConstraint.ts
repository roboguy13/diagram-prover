import { maxRangeListPropagator, minRangeListPropagator, addRangePropagator, addRangeListPropagator, between } from "../../../../../constraint/propagator/NumericRange"; // Added between, addRangeListPropagator
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeId } from "../../../../../ir/StringDiagram";
import { BoundingBox } from "../BoundingBox";
// Removed HorizontalSeparationConstraint import for now

export class SubtreeExtentChildrenConstraint implements Constraint {
  // Removed _VERTICAL_PADDING and verticalPadding as they weren't used for width

  constructor(private _parentId: NodeId) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    if (!parentLayout) throw new Error(`Layout for node ${this._parentId} not found`);

    const childrenIds = layoutTree.getChildren(this._parentId);
    const childrenLayouts = childrenIds.map(id => layoutTree.getNodeLayout(id)).filter((l): l is NonNullable<typeof l> => l != null);

    const parentSubtreeExtent = parentLayout.subtreeExtentBox;
    const parentIntrinsicBox = parentLayout.intrinsicBox;

    if (childrenLayouts.length === 0) {
        parentIntrinsicBox.equalConstraints(net, parentSubtreeExtent);
        net.addDebugCell(`SubtreeLeaf (${this._parentId}): Intrinsic Width After Equal`, parentIntrinsicBox.width);
        net.addDebugCell(`SubtreeLeaf (${this._parentId}): Subtree Width After Equal`, parentSubtreeExtent.width);
        return;
    }

    // --- Explicit Width Calculation ---
    const childSubtreeWidths = childrenLayouts.map(l => l.subtreeExtentBox.width);

    // **Simplification: Use fixed padding values**
    const PADDING_BETWEEN_CHILDREN = 20; // Use the constant from HorizontalSeparationConstraint
    const numPaddings = childrenLayouts.length - 1;
    const totalPaddingWidth = net.newCell("totalPaddingWidth", known(between(PADDING_BETWEEN_CHILDREN * numPaddings, PADDING_BETWEEN_CHILDREN * 3 * numPaddings))); // Estimate range

    const cellsToSumForWidth: CellRef[] = [...childSubtreeWidths, totalPaddingWidth];
    const childrenTotalSpan = net.newCell(`childrenTotalSpan_${this._parentId}`, unknown());
    addRangeListPropagator(
        `childrenTotalSpan_${this._parentId}`,
        net,
        cellsToSumForWidth,
        childrenTotalSpan
    );

    // parentSubtree.width = max(parentIntrinsic.width, childrenTotalSpan)
    maxRangeListPropagator(
        `parentSubtree.width >= max(intrinsic, childrenSpan) for ${this._parentId}`,
        net,
        [parentIntrinsicBox.width, childrenTotalSpan],
        parentSubtreeExtent.width // Constrain the width based on sum
    );
    // We might need an equality constraint here if max isn't sufficient,
    // depending on how minimization interacts. Let's assume max is okay for now.

    net.addDebugCell(`SubtreeExtent (${this._parentId}): Width (Explicit Calc)`, parentSubtreeExtent.width); // Debug new width calculation

    // --- Position Calculation (Min/Max of the group including parent) ---
    // These define the bounding box based on actual positions
    const boxesToBound: BoundingBox[] = [parentIntrinsicBox, ...childrenLayouts.map(l => l.subtreeExtentBox)];

    minRangeListPropagator(`parentSubtree.top <= min(tops) for ${this._parentId}`, net, boxesToBound.map(b => b.top), parentSubtreeExtent.top);
    maxRangeListPropagator(`parentSubtree.bottom >= max(bottoms) for ${this._parentId}`, net, boxesToBound.map(b => b.bottom), parentSubtreeExtent.bottom);
    minRangeListPropagator(`parentSubtree.left <= min(lefts) for ${this._parentId}`, net, boxesToBound.map(b => b.left), parentSubtreeExtent.left);
    maxRangeListPropagator(`parentSubtree.right >= max(rights) for ${this._parentId}`, net, boxesToBound.map(b => b.right), parentSubtreeExtent.right);

    // --- Ensure Consistency ---
    // Link left, width, right using the explicitly calculated width
    addRangePropagator(
        `parentSubtree.right = left + width for ${this._parentId}`,
        net,
        parentSubtreeExtent.left,
        parentSubtreeExtent.width, // Use the width calculated above
        parentSubtreeExtent.right
    );
  }

  cellsToMinimize(): CellRef[] {
    // No cells to minimize directly from this version
    return [];
  }
}
