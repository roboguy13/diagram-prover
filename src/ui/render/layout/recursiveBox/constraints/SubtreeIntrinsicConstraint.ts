import { CellRef } from "../../../../../constraint/propagator/Propagator";
import { NodeId } from "../../../../../ir/StringDiagram";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

// Relate the subtree extent box to the intrinsic box of a node.
export class SubtreeIntrinsicConstraint implements Constraint {
  constructor(
    private _nodeId: NodeId
  ) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;

    const layout = layoutTree.nodeLayouts.get(this._nodeId);

    if (!layout) {
      throw new Error(`Layout for node ${this._nodeId} not found`);
    }

    const subtreeExtentBox = layout.subtreeExtentBox
    const intrinsicBox = layout.intrinsicBox

    const children = layoutTree.getChildren(this._nodeId);

    if (children.length === 0) {
      console.log(`SubtreeIntrinsicConstraint: Node ${this._nodeId} is a leaf. Applying equalConstraints.`);
      intrinsicBox.equalConstraints(net, subtreeExtentBox);
    } else {
      console.log(`SubtreeIntrinsicConstraint: Node ${this._nodeId} is non-leaf with children [${children.join(', ')}]. Applying containedInConstraints.`);
      intrinsicBox.containedInConstraints(net, subtreeExtentBox);
    }
  }

  public cellsToMinimize(): CellRef[] {
    return [];
  }
}