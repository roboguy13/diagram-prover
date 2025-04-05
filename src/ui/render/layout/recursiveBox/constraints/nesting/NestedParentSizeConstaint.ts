import { lessThan, lessThanEqualPropagator } from "../../../../../../constraint/propagator/NumericRange";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class NestedParentSizeConstraint implements Constraint {
  private _parentId: string;

  constructor(parentId: string, childId: string) {
    this._parentId = parentId;
    this._childId = childId;
  }

  public apply(layoutTree: LayoutTree): void {
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayouts = layoutTree.getNestingChildren(this._parentId);

    if (!parentLayout || !childLayouts) {
      return
    }
  }
}