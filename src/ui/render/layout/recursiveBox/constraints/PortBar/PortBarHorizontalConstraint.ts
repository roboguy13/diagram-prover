import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class PortBarHorizontalConstraint implements Constraint {
  constructor(
    private _nodeId: string,
    private _nestingParentId: string,
  ) {}

  apply(layoutTree: LayoutTree): void {
    const nodeLayout = layoutTree.getNodeLayout(this._nodeId);

    if (!nodeLayout) {
      console.warn(`Node layout for ${this._nodeId} not found`);
      return;
    }

    const parentLayout = layoutTree.getNodeLayout(this._nestingParentId);

    if (!parentLayout) {
      console.warn(`Parent layout for ${this._nestingParentId} not found`);
      return;
    }

    layoutTree.net.equalPropagator(
      `PortBarHorizontalConstraint: [left] ${this._nodeId}`,
      nodeLayout.intrinsicBox.left,
      parentLayout.intrinsicBox.left,
    );
  }
}