import { CellRef, PropagatorNetwork, unknown, known } from "../../../../../constraint/propagator/Propagator";
// Remove CollectiveBoundingBox import if no longer needed for width
// import { CollectiveBoundingBox } from "../CollectiveBoundingBox";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
// Import necessary propagator functions from NumericRange
import { divNumericRangeNumberPropagator, subtractRangePropagator, addRangeListPropagator, between } from "../../../../../constraint/propagator/NumericRange";

export class ParentHorizontalCenteringConstraint implements Constraint {
  constructor(
    private _parentId: string,
    private _childrenIds: string[]
  ) { }

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net;

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    if (!parentLayout) throw new Error(`Layout for node ${this._parentId} not found`);

    const childrenLayouts = this._childrenIds.map(id => layoutTree.getNodeLayout(id)).filter((l): l is NonNullable<typeof l> => l != null);
    if (childrenLayouts.length === 0) return;

    const parentBox = parentLayout.intrinsicBox;
    // Use subtreeExtentBox widths for children
    const childSubtreeWidths = childrenLayouts.map(l => l.subtreeExtentBox.width);

    // --- Explicitly Calculate Collective Width (including padding) ---
    const PADDING_BETWEEN_CHILDREN = 20; // Use the constant from HorizontalSeparationConstraint
    const numPaddings = childrenLayouts.length - 1;
    // Use constant for padding estimate
    const totalPaddingWidth = net.newCell('totalPaddingWidth', known(between(PADDING_BETWEEN_CHILDREN * numPaddings, PADDING_BETWEEN_CHILDREN * 3 * numPaddings)));

    const cellsToSumForWidth: CellRef[] = [...childSubtreeWidths];
    // Only add padding if there's more than one child
    if (numPaddings > 0) {
        cellsToSumForWidth.push(totalPaddingWidth);
    }

    const collectiveWidth = net.newCell(`collectiveWidth_${this._parentId}`, unknown());
    addRangeListPropagator(
        `collectiveWidth_${this._parentId}`,
        net,
        cellsToSumForWidth,
        collectiveWidth
    );
    // --- End Explicit Calculation ---


    // --- Position the first child to center the group ---
    const firstChildLayout = childrenLayouts[0]!;
    const firstChildIntrinsicBox = firstChildLayout.intrinsicBox; // We position the node's own box

    // --- START DEBUG LOGGING ---
    const debugPrefix = `ParentHCenter (${this._parentId} -> ${firstChildLayout.nodeId},...)`;
    net.addDebugCell(`${debugPrefix}: Parent CenterX`, parentBox.centerX);
    net.addDebugCell(`${debugPrefix}: Collective Width (Explicit)`, collectiveWidth); // Debug the explicitly calculated width
    childSubtreeWidths.forEach((widthCell, i) => {
        net.addDebugCell(`${debugPrefix}: Child ${i} Subtree Width`, widthCell);
    });
    net.addDebugCell(`${debugPrefix}: First Child Left (Before)`, firstChildIntrinsicBox.left);
    // --- END DEBUG LOGGING ---


    // Calculate halfCollectiveWidth = collectiveWidth / 2
    const halfCollectiveWidth = net.newCell(`halfCollectiveWidth_${this._parentId}`, unknown());
    divNumericRangeNumberPropagator(
        `halfCollectiveWidth_${this._parentId}`,
        net,
        collectiveWidth, // Use explicitly calculated width
        2,
        halfCollectiveWidth
    );
    net.addDebugCell(`${debugPrefix}: Half Collective Width`, halfCollectiveWidth);

    // Calculate targetFirstChildLeft = parentBox.centerX - halfCollectiveWidth
    const targetFirstChildLeft = net.newCell(`targetFirstChildLeft_${firstChildLayout.nodeId}`, unknown());
    subtractRangePropagator(
        `targetFirstChildLeft_${firstChildLayout.nodeId}`,
        net,
        parentBox.centerX,
        halfCollectiveWidth,
        targetFirstChildLeft
    );
    net.addDebugCell(`${debugPrefix}: Target First Child Left`, targetFirstChildLeft);

    // Constrain the actual left edge of the first child's intrinsic box
    net.equalPropagator(
        `ParentHCenterAnchor: ${firstChildLayout.nodeId}.left = target`,
        firstChildIntrinsicBox.left,
        targetFirstChildLeft
    );

    net.addDebugCell(`${debugPrefix}: First Child Left (After)`, firstChildIntrinsicBox.left);
  }

  cellsToMinimize(): CellRef[] {
    // If using estimated padding, no cells to minimize here.
    return [];
  }
}
