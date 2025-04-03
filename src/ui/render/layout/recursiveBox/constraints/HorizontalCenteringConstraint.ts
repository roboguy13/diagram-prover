import { Constraint } from '../Constraint';
import { LayoutTree } from '../LayoutTree';

// Center a node within its subtree extent
export class HorizontalCenteringConstraint implements Constraint {
  private _nodeId: string;

  constructor(nodeId: string) {
    this._nodeId = nodeId;
  }

  public apply(layoutTree: LayoutTree): void {
    const nodeLayout = layoutTree.getNodeLayout(this._nodeId);

    if (!nodeLayout) {
      return;
    }

    const intrinsicBox = nodeLayout.intrinsicBox;
    const subtreeBox = nodeLayout.subtreeExtentBox;

    // node.intrinsicBox.centerX = node.subtreeExtent.centerX
    layoutTree.net.equalPropagator(
      `HorizontalCenteringConstraint: ${this._nodeId}`,
      intrinsicBox.centerX,
      subtreeBox.centerX
    );
  }
}