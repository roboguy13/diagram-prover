import { addRangePropagator, divNumericRangeNumberPropagator } from "../../../../../constraint/propagator/NumericRange";
import { equalPropagator, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class CenteringConstraint implements Constraint {
  constructor(private _parentId: string, private childIds: string[]) {
    if (childIds.length === 0) {
      throw new Error("CenteringConstraint requires at least one child ID.");
    }
  }

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    if (!parentLayout) {
        console.warn(`CenteringConstraint: Parent layout for ID ${this._parentId} not found.`);
        return;
    }
    const parentBox = parentLayout.intrinsicBox;

    const firstChildLayout = layoutTree.getNodeLayout(this.childIds[0]!);
    if (!firstChildLayout) {
         console.warn(`CenteringConstraint: First child layout (${this.childIds[0]}) not found.`);
    } else {
         const firstChildBox = firstChildLayout.intrinsicBox;
         net.equalPropagator(
             `align_firstChild_${this.childIds[0]}_to_parent_${this._parentId}`,
             firstChildBox.left,
             parentBox.left
         );
         console.log(`Applied first child alignment: ${this.childIds[0]}.left = ${this._parentId}.left`); // LOG
    }
  }
}
