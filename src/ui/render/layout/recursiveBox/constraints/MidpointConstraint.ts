import { exactly, atMost, negateNumericRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { known } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { SpacingMap } from "./SpacingMap";

export class MidpointConstraint implements Constraint {
  private _parentId: string;
  private _childIds: string[];
  private _rootId: string;

  constructor(rootId: string, parentId: string, childIds: string[]) {
    this._rootId = rootId;
    this._parentId = parentId;
    this._childIds = childIds;
  }

  public apply(spacingMap: SpacingMap): void {
    if (this._childIds.length === 0) {
      return; // No children, nothing to do
    }

    if (this._childIds.length === 1) {
      // Single child: Align horizontally (same as Experiment 1, but just for one child)
      let singleChildId = this._childIds[0]!;
      let xSpacing = spacingMap.getXSpacing(this._parentId, singleChildId);
      spacingMap.net.writeCell(
        { description: `single child ${singleChildId} X centered under parent ${this._parentId}`, inputs: [xSpacing], outputs: [] },
        xSpacing,
        known(exactly(0))
      );
      return;
    }

    // --- Multi-child case (more than 1 child) ---
    let leftmostChild = this._childIds[0]!;
    let rightmostChild = this._childIds[this._childIds.length - 1]!;

    let parentToRightSpacing = spacingMap.getXSpacing(this._parentId, rightmostChild);
    let parentToLeftSpacing = spacingMap.getXSpacing(this._parentId, leftmostChild);

    spacingMap.net.writeCell(
      {
        description: `parentToRightSpacing for ${this._parentId} to ${rightmostChild}`,
        inputs: [],
        outputs: [parentToLeftSpacing],
      },
      parentToRightSpacing,
      known(atMost(100)) // TODO: How can I automatically compute an appropriate value for this
    );

    // Constraint 1: Enforce Symmetry
    // This forces Parent.X_relative_to_L = - (Parent.X_relative_to_R).
    // This effectively centers the parent horizontally between the 
    // reference points (e.g., minX or centerX) of the leftmost and rightmost children.
    negateNumericRangePropagator(
      `midpoint symmetry for ${this._parentId}`,
      spacingMap.net,
      parentToLeftSpacing,
      parentToRightSpacing
    );

    // Constraint 2: Minimum Distance (REMOVED / COMMENTED OUT)
    // We suspect this might have been forcing the layout too wide.
    // Let's rely on sibling constraints and the symmetry above to determine width.
    // writeAtLeastPropagator(spacingMap.net, parentToRightSpacing, HORIZONTAL_PADDING / 2); 
  }
}
