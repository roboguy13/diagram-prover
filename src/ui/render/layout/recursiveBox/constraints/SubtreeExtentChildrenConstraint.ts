import { CellRef } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

// A subtree extent should account for all of the (hierarchical) children of a node.
export class SubtreeExtentChildrenConstraint implements Constraint {
  constructor(
    private _nodeId: string
  ) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;

    const layout = layoutTree.nodeLayouts.get(this._nodeId);

    if (!layout) {
      throw new Error(`Layout for node ${this._nodeId} not found`);
    }

    const subtreeExtentBox = layout.subtreeExtentBox;
    const intrinsicBox = layout.intrinsicBox;

    const children = layoutTree.getChildren(this._nodeId);

    const childrenLayouts = children.map(id => layoutTree.nodeLayouts.get(id)).filter(layout => layout !== undefined);

    for (const childLayout of childrenLayouts) {
      const childBox = childLayout.intrinsicBox;

      // Ensure the subtree extent box contains the intrinsic box of each child
      subtreeExtentBox.containedInConstraints(net, childBox);
    }
  }

  cellsToMinimize(): CellRef[] {
    return [];
  }
}
