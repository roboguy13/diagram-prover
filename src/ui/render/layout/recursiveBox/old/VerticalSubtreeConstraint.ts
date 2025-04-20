import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class VerticalSubtreeConstraint implements Constraint {
  private _nodeId: string;

  constructor(nodeId: string) {
    this._nodeId = nodeId;
  }

  apply(layoutTree: LayoutTree): void {
    const nodeLayout = layoutTree.getNodeLayout(this._nodeId);

    if (!nodeLayout) {
      return;
    }

    const intrinsicBox = nodeLayout.intrinsicBox;
    const subtreeBox = nodeLayout.subtreeExtentBox;

    // node.subtreeExtent.top = node.intrinsicBox.top
    layoutTree.net.equalPropagator(
      `VerticalSubtreeConstraint: ${this._nodeId}`,
      intrinsicBox.top,
      subtreeBox.top
    );
  }
}
