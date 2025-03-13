import { Dimensions } from "./BoxNode";
import { addNumericRange, atLeast, atMost, exactly, getMax, getMidpoint, getMin, greaterThan, lessThan, NumericRange, subNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Cell, Content, naryPropagator, unaryPropagator, unaryPropagatorBind } from "../../../../constraint/propagator/Propagator";
import { clamp } from "lodash";

export type BoundingBox = { x: number; y: number; dimensions: Dimensions; };

export function getBoundingBox(constraint: BoundingBoxConstraint): BoundingBox {
  let x = constraint.x.readKnownOrError('bounding box x')
  let y = constraint.y.readKnownOrError('bounding box y')
  // let width = constraint.width.readKnownOrError('bounding box width')
  // let height = constraint.height.readKnownOrError('bounding box height')

  return {
    x: getMidpoint(x),
    y: getMidpoint(y),
    dimensions: {
      width: constraint.width, //getMin(width),
      height: constraint.height, //getMin(height)
    }
  }
}

// (0,0) is the top left corner
export type BoundingBoxConstraint = {
  x: Cell<NumericRange>;
  y: Cell<NumericRange>;
  width: number;
  height: number;
}

function leftSideX(cornerX: number, width: number): number {
  return cornerX
}

function rightSideX(cornerX: number, width: number): number {
  return cornerX + width
}

function topSideY(cornerY: number, height: number): number {
  return cornerY
}

function bottomSideY(cornerY: number, height: number): number {
  return cornerY + height
}

// export function contains(padding: number, outer: BoundingBoxConstraint, inners: BoundingBoxConstraint[]): void {
//   naryPropagator(
//     inners.map((inner: BoundingBoxConstraint) => inner.width),
//     outer.width,
//     (innerWidths: NumericRange[]) =>
//       addNumericRange(exactly(padding), addNumericRangeList(innerWidths))
//   )

//   naryPropagator(
//     inners.map((inner: BoundingBoxConstraint) => inner.height),
//     outer.height,
//     (innerHeights: NumericRange[]) =>
//       addNumericRange(exactly(padding), addNumericRangeList(innerHeights))
//   )
// }

function addNumericRangeList(xs: NumericRange[]): NumericRange {
  if (xs.length == 0) {
    return { kind: 'Range', min: 0, max: 0 }
  }

  let sum = xs[0]!

  for (let i = 1; i < xs.length; i++) {
    sum = addNumericRange(sum, xs[i]!)
  }

  return sum
}

export class BoundingConstraintCalculator {
  widthBoundLimits: NumericRange
  heightBoundLimits: NumericRange

  constructor(widthBoundLimits: NumericRange, heightBoundLimits: NumericRange) {
    this.widthBoundLimits = widthBoundLimits
    this.heightBoundLimits = heightBoundLimits
  }

  toTheLeftOf(padding: number, left: BoundingBoxConstraint, right: BoundingBoxConstraint): void {
    // First set up the right box based on the left box
    unaryPropagatorBind(
      left.x,
      right.x, // Output
      (leftX: NumericRange) => {
        // Right should be positioned to the right of left + width + padding
        const minRightPos = getMin(leftX) + left.width + padding;
        return this.clampWidthToContent(exactly(minRightPos));
      }
    );
  
    // Then set the left box based on the right box
    unaryPropagatorBind(
      right.x,
      left.x, // Output
      (rightX: NumericRange) => {
        // Left should be positioned to the left of right - width - padding
        const maxLeftPos = getMin(rightX) - left.width - padding;
        // But should be at least 0
        const safeLeftPos = Math.max(0, maxLeftPos);
        return this.clampWidthToContent(exactly(safeLeftPos));
      }
    );
  }
  
  above(padding: number, top: BoundingBoxConstraint, bottom: BoundingBoxConstraint): void {
    // First set up the bottom box based on the top box
    unaryPropagatorBind(
      top.y,
      bottom.y, // Output
      (topY: NumericRange) => {
        // Bottom should be positioned below top + height + padding
        const minBottomPos = getMin(topY) + top.height + padding;
        return this.clampHeightToContent(exactly(minBottomPos));
      }
    );
  
    // Then set the top box based on the bottom box
    unaryPropagatorBind(
      bottom.y,
      top.y, // Output
      (bottomY: NumericRange) => {
        // Top should be positioned above bottom - height - padding
        const maxTopPos = getMin(bottomY) - top.height - padding;
        // But should be at least 0
        const safeTopPos = Math.max(0, maxTopPos);
        return this.clampHeightToContent(exactly(safeTopPos));
      }
    );
  }

  // toTheLeftOf(padding: number, left: BoundingBoxConstraint, right: BoundingBoxConstraint): void {
  //   // TODO: use width?
  //   unaryPropagatorBind(
  //     right.x,
  //     left.x, // Output
  //     (rightX: NumericRange) => {
  //       // console.log('here')
  //       return this.clampWidthToContent(subNumericRange(
  //         exactly(getMax(rightX)),
  //         exactly(left.width + padding)
  //       ))
  //     }
  //     // atMost(getMin(rightX) - padding)
  //   )

  //   unaryPropagatorBind(
  //     left.x,
  //     right.x, // Output
  //     (leftX: NumericRange) => {
  //       // console.log('here')
  //       return this.clampWidthToContent(addNumericRange(
  //         exactly(getMin(leftX)),
  //         exactly(left.width + padding)
  //       ))
  //       // atLeast(getMax(leftX) + padding)
  //     }
  //   )
  // }

  // above(padding: number, top: BoundingBoxConstraint, bottom: BoundingBoxConstraint): void {
  //   // TODO: use height?
  //   unaryPropagatorBind(
  //     bottom.y,
  //     top.y, // Output
  //     (bottomY: NumericRange) => {
  //       return this.clampHeightToContent(subNumericRange(
  //         lessThan(bottomY),
  //         exactly(top.height + padding)
  //       ))
  //       // console.log('bottomY', bottomY, 'top.height', top.height, 'padding', padding)
  //       // return atMost(getMin(bottomY) - top.height - padding)
  //     }
  //   )

  //   unaryPropagatorBind(
  //     top.y,
  //     bottom.y, // Output
  //     (topY: NumericRange) =>
  //       this.clampHeightToContent(addNumericRange(
  //         greaterThan(topY),
  //         exactly(top.height + padding)
  //       ))
  //     // atLeast(getMax(topY) + top.height + padding)
  //   )
  // }

  private clampWidth(r: NumericRange): NumericRange {
    return { kind: 'Range', min: Math.max(getMin(r), getMin(this.widthBoundLimits)), max: Math.min(getMax(r), getMax(this.widthBoundLimits)) }
  }

  private clampHeight(r: NumericRange): NumericRange {
    return { kind: 'Range', min: Math.max(getMin(r), getMin(this.heightBoundLimits)), max: Math.min(getMax(r), getMax(this.heightBoundLimits)) }
  }

  private clampWidthToContent(r: NumericRange): Content<NumericRange> {
    let clamped = this.clampWidth(r)
    if (getMin(clamped) > getMax(clamped)) {
      return { kind: 'Unknown' }
    } else {
      return { kind: 'Known', value: clamped }
    }
  }

  private clampHeightToContent(r: NumericRange): Content<NumericRange> {
    let clamped = this.clampHeight(r)
    if (getMin(clamped) > getMax(clamped)) {
      return { kind: 'Unknown' }
    } else {
      return { kind: 'Known', value: clamped }
    }
  }
}
