import { maxRangeListPropagator, minRangeListPropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange"; // Add lessThanEqualPropagator
import { CellRef, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { BoundingBox } from "../BoundingBox"; // Ensure imported
import { NodeId } from "../../../../../ir/StringDiagram"; // Assuming NodeId type exists

export class SubtreeExtentChildrenConstraint implements Constraint {
  constructor(private _parentId: NodeId) {} // Use NodeId type

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    const parentId = this._parentId;
    const writer = `SubtreeExtentChildrenConstraint(${parentId})`;

    const parentLayout = layoutTree.getNodeLayout(parentId);
    if (!parentLayout) {
      console.error(`${writer}: Layout for node ${parentId} not found`);
      throw new Error(`Layout for node ${parentId} not found`);
    }

    const parentSubtreeBox = parentLayout.subtreeExtentBox;
    const parentIntrinsicBox = parentLayout.intrinsicBox;

    const childrenIds = layoutTree.getChildren(parentId);

    if (childrenIds.length === 0) {
      // Node is a leaf in the layout hierarchy.
      // Its subtree extent is just its intrinsic extent.
      console.log(`${writer}: Node ${parentId} has no layout children. Setting subtree extent = intrinsic extent.`);
      parentIntrinsicBox.equalConstraints(net, parentSubtreeBox);
      return;
    }

    console.log(`${writer}: Applying for parent ${parentId} with layout children [${childrenIds.join(', ')}]`);

    const childLayouts = childrenIds.map(id => layoutTree.getNodeLayout(id)).filter((l): l is NonNullable<typeof l> => l != null);
    if (childLayouts.length !== childrenIds.length) {
       console.error(`${writer}: Could not find layouts for all children of ${parentId}`);
       throw new Error(`Could not find layouts for all children of ${parentId}`);
    }

    const childSubtreeBoxes = childLayouts.map(layout => layout.subtreeExtentBox);

    // Combine the parent's intrinsic box and children's subtree boxes
    const allBoxes: BoundingBox[] = [parentIntrinsicBox, ...childSubtreeBoxes];

    // Get lists of corresponding edges
    const lefts = allBoxes.map(b => b.left);
    const tops = allBoxes.map(b => b.top);
    const rights = allBoxes.map(b => b.right);
    const bottoms = allBoxes.map(b => b.bottom);

    // --- Calculate required collective bounds using temporary cells ---
    const collectiveMinLeft = net.newCell(`${writer} collectiveMinLeft`, unknown());
    const collectiveMinTop = net.newCell(`${writer} collectiveMinTop`, unknown());
    const collectiveMaxRight = net.newCell(`${writer} collectiveMaxRight`, unknown());
    const collectiveMaxBottom = net.newCell(`${writer} collectiveMaxBottom`, unknown());

    minRangeListPropagator(`${writer}: min(lefts)`, net, lefts, collectiveMinLeft);
    minRangeListPropagator(`${writer}: min(tops)`, net, tops, collectiveMinTop);
    maxRangeListPropagator(`${writer}: max(rights)`, net, rights, collectiveMaxRight);
    maxRangeListPropagator(`${writer}: max(bottoms)`, net, bottoms, collectiveMaxBottom);

    // --- Apply inequality constraints ---
    // parentSubtreeBox.left <= collectiveMinLeft
    lessThanEqualPropagator(`${writer}: parent.left <= collective.left`, net, parentSubtreeBox.left, collectiveMinLeft);
    // parentSubtreeBox.top <= collectiveMinTop
    lessThanEqualPropagator(`${writer}: parent.top <= collective.top`, net, parentSubtreeBox.top, collectiveMinTop);
    // parentSubtreeBox.right >= collectiveMaxRight (equiv. collectiveMaxRight <= parentSubtreeBox.right)
    lessThanEqualPropagator(`${writer}: collective.right <= parent.right`, net, collectiveMaxRight, parentSubtreeBox.right);
    // parentSubtreeBox.bottom >= collectiveMaxBottom (equiv. collectiveMaxBottom <= parentSubtreeBox.bottom)
    lessThanEqualPropagator(`${writer}: collective.bottom <= parent.bottom`, net, collectiveMaxBottom, parentSubtreeBox.bottom);

    console.log(`${writer}: Constrained parent subtree box to contain intrinsic box and ${childrenIds.length} children.`);

    // Optional: Add horizontal separation between children
    // ...
  }

  cellsToMinimize(): CellRef[] {
    // If you want the subtree box to be as small as possible while satisfying constraints,
    // you might minimize its width and height, or maximize left/top and minimize right/bottom.
    // However, start without minimization here to isolate the inconsistency.
    return [];
  }
}
