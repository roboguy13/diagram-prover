import { maxRangeListPropagator, minRangeListPropagator, addRangePropagator, addRangeListPropagator, between } from "../../../../../constraint/propagator/NumericRange"; // Added between, addRangeListPropagator
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeId } from "../../../../../ir/StringDiagram";
import { BoundingBox } from "../BoundingBox";
import { PropagatorInterpreter } from "../../../../../constraint/propagator/PropagatorLanguage";
import { DebugBoundingBox } from "../DebugBoundingBox";

export class SubtreeExtentChildrenConstraint implements Constraint {

  constructor(private _parentId: NodeId) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    const solver = new PropagatorInterpreter(net, 'SubtreeExtentChildrenConstraint');

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

    const childSubtreeWidths = childrenLayouts.map(l => l.subtreeExtentBox.width);

    const PADDING_BETWEEN_CHILDREN = 20;
    const numPaddings = childrenLayouts.length - 1;
    const totalPaddingWidth = net.newCell("totalPaddingWidth", known(between(PADDING_BETWEEN_CHILDREN * numPaddings, PADDING_BETWEEN_CHILDREN * 3 * numPaddings)));

    const cellsToSumForWidth: CellRef[] = [...childSubtreeWidths, totalPaddingWidth];
    const childrenTotalSpan = net.newCell(`childrenTotalSpan_${this._parentId}`, unknown());

    net.addDebugCell(`SubtreeExtent (${this._parentId}): Width (Explicit Calc)`, parentSubtreeExtent.width);

    const boxesToBound: BoundingBox[] = [parentIntrinsicBox, ...childrenLayouts.map(l => l.subtreeExtentBox)];
    const boxesToBoundTops = boxesToBound.map(b => b.top);
    const boxesToBoundBottoms = boxesToBound.map(b => b.bottom);
    const boxesToBoundLefts = boxesToBound.map(b => b.left);
    const boxesToBoundRights = boxesToBound.map(b => b.right);

    solver.addRelation`${childrenTotalSpan} = add(${cellsToSumForWidth})`;
    solver.addRelation`${parentSubtreeExtent.width} = max(${[parentIntrinsicBox.width, childrenTotalSpan]})`;

    solver.addRelation`${parentSubtreeExtent.top} = min(${boxesToBoundTops})`;
    solver.addRelation`${parentSubtreeExtent.bottom} = max(${boxesToBoundBottoms})`;
    solver.addRelation`${parentSubtreeExtent.left} = min(${boxesToBoundLefts})`;
    solver.addRelation`${parentSubtreeExtent.right} = max(${boxesToBoundRights})`;
  }

  cellsToMinimize(): CellRef[] {
    return [];
  }

  get debugBoxes(): DebugBoundingBox[] {
    return [];
  }
}
