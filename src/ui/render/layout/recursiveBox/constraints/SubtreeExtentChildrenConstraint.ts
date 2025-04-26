import { maxRangeListPropagator, minRangeListPropagator, lessThanEqualPropagator, addRangePropagator, between } from "../../../../../constraint/propagator/NumericRange"; // Add lessThanEqualPropagator
import { CellRef, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeId } from "../../../../../ir/StringDiagram";
import { CollectiveBoundingBox } from "../CollectiveBoundingBox";
import { BoundingBox } from "../BoundingBox";

export class SubtreeExtentChildrenConstraint implements Constraint {
  private readonly _VERTICAL_PADDING = 20;
  private verticalPadding: CellRef | null = null;

  constructor(private _parentId: NodeId) {}

  apply(layoutTree: LayoutTree): void {

    const net = layoutTree.net;
    const parentLayout = layoutTree.getNodeLayout(this._parentId);

    if (!parentLayout) {
      throw new Error(`Layout for node ${this._parentId} not found`);
    }

    const childrenIds = layoutTree.getChildren(this._parentId);
    const childrenLayouts = childrenIds.map(id => layoutTree.getNodeLayout(id)).filter((l): l is NonNullable<typeof l> => l != null);

    const parentSubtreeExtent = parentLayout.subtreeExtentBox;
    const parentIntrinsicBox = parentLayout.intrinsicBox;

    // List of boxes to be contained within the parent's subtree extent
    const boxesToContain: BoundingBox[] = [parentIntrinsicBox];

    if (childrenLayouts.length > 0) {
        boxesToContain.push(...childrenLayouts.map(l => l.subtreeExtentBox));
    } else {
        // If no children, subtree extent is just the intrinsic box
        parentIntrinsicBox.equalConstraints(net, parentSubtreeExtent);
        return;
    }

    // Define parent's subtree extent based on the min/max of contained boxes
    // parentSubtree.top = min(box1.top, box2.top, ...)
    minRangeListPropagator(
        `parentSubtree.top <= min(contained tops) for ${this._parentId}`,
        net,
        boxesToContain.map(b => b.top),
        parentSubtreeExtent.top
    );

    // parentSubtree.bottom = max(box1.bottom, box2.bottom, ...)
    maxRangeListPropagator(
        `parentSubtree.bottom >= max(contained bottoms) for ${this._parentId}`,
        net,
        boxesToContain.map(b => b.bottom),
        parentSubtreeExtent.bottom
    );

    // parentSubtree.left = min(box1.left, box2.left, ...)
    minRangeListPropagator(
        `parentSubtree.left <= min(contained lefts) for ${this._parentId}`,
        net,
        boxesToContain.map(b => b.left),
        parentSubtreeExtent.left
    );

    // parentSubtree.right = max(box1.right, box2.right, ...)
    maxRangeListPropagator(
        `parentSubtree.right >= max(contained rights) for ${this._parentId}`,
        net,
        boxesToContain.map(b => b.right),
        parentSubtreeExtent.right
    );
  }

  cellsToMinimize(): CellRef[] {
    return [this.verticalPadding].filter(cell => cell !== null) as CellRef[];
  }
}
