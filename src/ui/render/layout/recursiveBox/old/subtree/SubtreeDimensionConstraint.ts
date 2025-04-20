import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";
import { NodeLayout } from "../../NodeLayout";
import { SubtreeHeightConstraint } from "./SubtreeHeightConstraint";
import { SubtreeWidthConstraint } from "./SubtreeWidthConstraint";

export class SubtreeDimensionConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string, childIds: string[]) {
    this._parentId = parentId;
  }

  public apply(layoutTree: LayoutTree): void {
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childIds = layoutTree.getChildren(this._parentId);

    if (!parentLayout) {
      return;
    }

    if (childIds.length === 0) {
      this.applyNoChildren(layoutTree, parentLayout);
      return;
    }

    const heightConstraint = new SubtreeHeightConstraint(this._parentId, childIds);
    const widthConstraint = new SubtreeWidthConstraint(this._parentId, childIds);

    heightConstraint.apply(layoutTree);
    widthConstraint.apply(layoutTree);
  }

  private applyNoChildren(layoutTree: LayoutTree, parentLayout: NodeLayout): void {
    const parentIntrinsicBox = parentLayout.intrinsicBox;
    const parentSubtreeBox = parentLayout.subtreeExtentBox;

    // parent.subtree.width = parent.intrinsicBox.width
    layoutTree.net.equalPropagator(
      `SubtreeDimensionConstraintW: ${this._parentId}`,
      parentIntrinsicBox.width,
      parentSubtreeBox.width
    );

    // parent.subtree.height = parent.intrinsicBox.height
    layoutTree.net.equalPropagator(
      `SubtreeDimensionConstraintH: ${this._parentId}`,
      parentIntrinsicBox.height,
      parentSubtreeBox.height
    );
  }

}