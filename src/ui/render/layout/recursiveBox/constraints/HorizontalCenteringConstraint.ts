import { addRangePropagator, divNumericRangeNumberPropagator, exactly, subtractRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";


export class HorizontalCenteringConstraint implements Constraint {
  constructor(private _parentId: string, private _childId: string) {}

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    const childLayout = layoutTree.getNodeLayout(this._childId);

    if (!parentLayout || !childLayout) {
      console.warn(`HorizontalCenteringConstraint: Layout not found for parent (${this._parentId}) or child (${this._childId})`);
      return;
    }

    const parentBox = parentLayout.intrinsicBox;
    const childBox = childLayout.intrinsicBox;

    // We want: child.minX = parent.minX + (parent.width - child.width) / 2

    // 1. Calculate deltaWidth = parent.width - child.width
    const deltaWidth = net.newCell(`deltaWidth_${this._parentId}_${this._childId}`, unknown());
    subtractRangePropagator(
        `calc_deltaWidth_${this._parentId}_${this._childId}`,
        net,
        parentBox.width,
        childBox.width,
        deltaWidth
    );

    // 2. Calculate halfDeltaWidth = deltaWidth / 2
    const halfDeltaWidth = net.newCell(`halfDeltaWidth_${this._parentId}_${this._childId}`, unknown());
    divNumericRangeNumberPropagator(
        `calc_halfDeltaWidth_${this._parentId}_${this._childId}`,
        net,
        deltaWidth,
        2,
        halfDeltaWidth
    );

    // 3. Calculate parentMinXPlusHalfDelta = parent.minX + halfDeltaWidth
    const parentMinXPlusHalfDelta = net.newCell(`parentMinXPlusHalfDelta_${this._parentId}_${this._childId}`, unknown());
     addRangePropagator(
        `calc_parentMinXPlusHalfDelta_${this._parentId}_${this._childId}`,
        net,
        parentBox.left, // parent.minX
        halfDeltaWidth,
        parentMinXPlusHalfDelta
     );

    // 4. Constrain child.minX = parentMinXPlusHalfDelta
    // Use addRangePropagator for equality: child.minX - parentMinXPlusHalfDelta = 0
    // Or simply use equalPropagator if you trust its implementation now
     addRangePropagator(
        `center_${this._childId}_in_${this._parentId}`, // Renamed description
        net,
        parentMinXPlusHalfDelta, // a
        childBox.left,           // result = child.minX
        net.newCell(`zero_${this._parentId}_${this._childId}`, known(exactly(0))) // b = 0
        // Effectively: parentMinXPlusHalfDelta + 0 = child.minX
     );

    // // Alternative using equalPropagator (if it exists and is reliable)
    // net.equalPropagator(
    //    `center_${this._childId}_in_${this._parentId}`,
    //    childBox.left, // child.minX
    //    parentMinXPlusHalfDelta
    // );

    console.log(`Applied Horizontal Centering (Corrected): ${this._childId}.minX = ${this._parentId}.minX + (${this._parentId}.width - ${this._childId}.width) / 2`);
  }
}

// export class HorizontalCenteringConstraint implements Constraint {
//   constructor(private _parentId: string, private _childId: string) { }

//   apply(layoutTree: LayoutTree): void {
//     const net = layoutTree.net;
//     const parentLayout = layoutTree.getNodeLayout(this._parentId);
//     const childLayout = layoutTree.getNodeLayout(this._childId);

//     if (!parentLayout || !childLayout) {
//       console.warn(`HorizontalCenteringConstraint: Parent or child layout not found.`);
//       return;
//     }

//     net.equalPropagator(
//       `h_center_${this._childId} = ${this._parentId}`,
//       childLayout.intrinsicBox.centerX,
//       parentLayout.intrinsicBox.centerX
//     );
//   }
// }
