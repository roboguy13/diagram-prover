import { addRangePropagator, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class HorizontalSpacingConstraint implements Constraint {
  private _leftNodeId: string;
  private _rightNodeId: string;

  constructor(leftNodeId: string, rightNodeId: string) {
      this._leftNodeId = leftNodeId;
      this._rightNodeId = rightNodeId;
  }

  public apply(layoutTree: LayoutTree): void {
      const leftNodeLayout = layoutTree.getNodeLayout(this._leftNodeId);
      const rightNodeLayout = layoutTree.getNodeLayout(this._rightNodeId);

      // Check if layouts exist (important!)
      if (!leftNodeLayout || !rightNodeLayout) {
          console.warn(`HorizontalSpacingConstraint: Could not find layout for ${this._leftNodeId} or ${this._rightNodeId}`);
          return;
      }

      const leftNodeBox = leftNodeLayout.intrinsicBox;  // Use intrinsicBox
      const rightNodeBox = rightNodeLayout.intrinsicBox; // Use intrinsicBox
      const standardHSpacing = layoutTree.standardHSpacing;
      const net = layoutTree.net;

      // Create intermediate cell for leftNodeBox.right + standardHSpacing
      const leftRightPlusSpacing = net.newCell(
           `temp_${this._leftNodeId}.right+${net.cellDescription(standardHSpacing)}`,
           unknown()
       );

      // Calculate leftRightPlusSpacing = leftNodeBox.right + standardHSpacing
      addRangePropagator(
          `calc_${net.cellDescription(leftRightPlusSpacing)}`,
          net,
          leftNodeBox.right, // Use intrinsicBox.right
          standardHSpacing,
          leftRightPlusSpacing
      );

      // Enforce leftRightPlusSpacing <= rightNodeBox.left
      // (Ensures right node is at least spacing away from the left node)
      lessThanEqualPropagator(
          `${net.cellDescription(leftRightPlusSpacing)} <= ${this._rightNodeId}.left`,
          net,
          leftRightPlusSpacing, // source.right + spacing
          rightNodeBox.left     // target.left
      );
  }
}