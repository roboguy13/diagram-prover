import { maxRangeListPropagator, minRangeListPropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange"; // Add lessThanEqualPropagator
import { CellRef, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { BoundingBox } from "../BoundingBox"; // Ensure imported
import { NodeId } from "../../../../../ir/StringDiagram"; // Assuming NodeId type exists
import { CollectiveBoundingBox } from "../CollectiveBoundingBox";

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
      // This equality constraint is also added by SubtreeIntrinsicConstraint for leaves.
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

    // Define the collective box of children's subtrees
    const collectiveChildrenBox = new CollectiveBoundingBox(net, `${writer} Children Collective`, childrenIds, childSubtreeBoxes);

    // The parent's subtree extent must contain BOTH its own intrinsic box
    // AND the collective extent of its children's subtrees.
    // We achieve this by finding the min/max across the relevant edges.

    // parentSubtree.left = min(parentIntrinsic.left, collectiveChildren.left)
    minRangeListPropagator(`${writer} Subtree Left`, net,
      [parentIntrinsicBox.left, collectiveChildrenBox.left],
      parentSubtreeBox.left
    );

    // parentSubtree.right = max(parentIntrinsic.right, collectiveChildren.right)
    maxRangeListPropagator(`${writer} Subtree Right`,net, 
      [parentIntrinsicBox.right, collectiveChildrenBox.right],
      parentSubtreeBox.right
    );

    // parentSubtree.top = min(parentIntrinsic.top, collectiveChildren.top)
    minRangeListPropagator(`${writer} Subtree Top`,net, 
      [parentIntrinsicBox.top, collectiveChildrenBox.top],
      parentSubtreeBox.top
    );

    // parentSubtree.bottom = max(parentIntrinsic.bottom, collectiveChildren.bottom)
    maxRangeListPropagator(`${writer} Subtree Bottom`,net, 
      [parentIntrinsicBox.bottom, collectiveChildrenBox.bottom],
      parentSubtreeBox.bottom
    );

    // Remove the previous containment constraint as it's now implicitly handled
    // collectiveBox.containedInConstraints(net, parentSubtreeBox); // Ensure this line is removed or commented out

    console.log(`${writer}: Constrained parent subtree box to contain intrinsic box and ${childrenIds.length} children.`);

  }

  cellsToMinimize(): CellRef[] {
    // Consider adding parentSubtreeBox.width and parentSubtreeBox.height here
    // if you want the layout to be as compact as possible.
    // return [parentSubtreeBox.width, parentSubtreeBox.height];
    return [];
  }
}
