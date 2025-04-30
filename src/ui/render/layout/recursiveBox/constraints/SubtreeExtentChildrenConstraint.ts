import { maxRangeListPropagator, minRangeListPropagator, addRangePropagator, addRangeListPropagator, between } from "../../../../../constraint/propagator/NumericRange"; // Added between, addRangeListPropagator
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeId } from "../../../../../ir/StringDiagram";
import { BoundingBox } from "../BoundingBox";
import { runPropagatorRelation } from "../../../../../constraint/propagator/PropagatorLanguage";
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

    runPropagatorRelation(net)`${childrenTotalSpan} = add(${cellsToSumForWidth})`;

    runPropagatorRelation(net)`${parentSubtreeExtent.width} = max(${[parentIntrinsicBox.width, childrenTotalSpan]})`;

    net.addDebugCell(`SubtreeExtent (${this._parentId}): Width (Explicit Calc)`, parentSubtreeExtent.width); // Debug new width calculation

    // --- Position Calculation (Min/Max of the group including parent) ---
    // These define the bounding box based on actual positions
    const boxesToBound: BoundingBox[] = [parentIntrinsicBox, ...childrenLayouts.map(l => l.subtreeExtentBox)];
    const boxesToBoundTops = boxesToBound.map(b => b.top);
    const boxesToBoundBottoms = boxesToBound.map(b => b.bottom);
    const boxesToBoundLefts = boxesToBound.map(b => b.left);
    const boxesToBoundRights = boxesToBound.map(b => b.right);

    runPropagatorRelation(net)`${parentSubtreeExtent.top} = min(${boxesToBoundTops})`;
    runPropagatorRelation(net)`${parentSubtreeExtent.bottom} = max(${boxesToBoundBottoms})`;
    runPropagatorRelation(net)`${parentSubtreeExtent.left} = min(${boxesToBoundLefts})`;
    runPropagatorRelation(net)`${parentSubtreeExtent.right} = max(${boxesToBoundRights})`;

    // // --- Ensure Consistency ---
    // // Link left, width, right using the explicitly calculated width
    // runPropagatorRelation(net)`${parentSubtreeExtent.left} + ${parentSubtreeExtent.width} = ${parentSubtreeExtent.right}`;
  }

  cellsToMinimize(): CellRef[] {
    // No cells to minimize directly from this version
    return [];
  }
}
