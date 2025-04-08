import { addRangePropagator, divNumericRangeNumberPropagator, exactly } from "../../../../../constraint/propagator/NumericRange";
import { equalPropagator, known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { ContainerSizeConstraint } from "./ContainerSizeConstraint";

export class LeftAlignConstraint implements Constraint {
  constructor(private _parentId: string, private childIds: string[]) {
    if (childIds.length === 0) {
      throw new Error("LeftAlignConstraint: requires at least one child ID.");
    }
  }

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    if (!parentLayout) {
      console.warn(`LeftAlignConstraint: Parent layout for ID ${this._parentId} not found.`);
      return;
    }
    const parentBox = parentLayout.intrinsicBox;

    const firstChildLayout = layoutTree.getNodeLayout(this.childIds[0]!);
    if (!firstChildLayout) {
      console.warn(`LeftAlignConstraint: First child layout (${this.childIds[0]}) not found.`);
    } else {

      // Don't apply the constraint on a nested node
      if (firstChildLayout.nestingParentId !== null) {
        console.warn(`LeftAlignConstraint: First child (${this.childIds[0]}) is not a direct child of the parent (${this._parentId}).`);
        return;
      }

      const firstChildBox = firstChildLayout.intrinsicBox;

      const paddingLeftCell = net.newCell(
        `paddingLeft_${this.childIds[0]}_to_parent_${this._parentId}`,
        // known(exactly(ContainerSizeConstraint._PADDING_LEFT))
        known(exactly(10)) // TODO
      );

      addRangePropagator(
        `align_firstChild_${this.childIds[0]}_to_parent_${this._parentId}`,
        net,
        paddingLeftCell,
        parentBox.left,
        firstChildBox.left,
      );

        //  net.equalPropagator(
        //      `align_firstChild_${this.childIds[0]}_to_parent_${this._parentId}`,
        //      firstChildBox.left,
        //      parentBox.left
        //  );

        console.log(`Applied first child alignment: ${this.childIds[0]}.left = ${this._parentId}.left`);
    }
  }
}
