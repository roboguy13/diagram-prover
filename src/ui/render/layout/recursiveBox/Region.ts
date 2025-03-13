import { Dimensions } from "./BoxNode";
import { addNumericRange, atLeast, atMost, exactly, getMax, getMidpoint, getMin, greaterThan, lessThan, NumericRange, subNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Cell, Content, known, naryPropagator, unaryPropagator, unaryPropagatorBind } from "../../../../constraint/propagator/Propagator";
import { clamp } from "lodash";
import { XYPosition } from "@xyflow/react";

export function getRegionPosition(constraint: RegionConstraint): XYPosition {
  let x = constraint.x.readKnownOrError('bounding box x')
  let y = constraint.y.readKnownOrError('bounding box y')

  return {
    x: getMidpoint(x),
    y: getMidpoint(y),
  }
}

// (0,0) is the top left corner
export type RegionConstraint = {
  x: Cell<NumericRange>;
  y: Cell<NumericRange>;
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

export class RegionConstraintCalculator {
  private widthBoundLimits: NumericRange
  private heightBoundLimits: NumericRange
  private verticalPadding: number
  private horizontalPadding: number


  constructor(widthBoundLimits: NumericRange, heightBoundLimits: NumericRange, verticalPadding: number, horizontalPadding: number) {
    this.widthBoundLimits = widthBoundLimits
    this.heightBoundLimits = heightBoundLimits
    this.verticalPadding = verticalPadding
    this.horizontalPadding = horizontalPadding
  }

  toTheLeftOf(left: RegionConstraint, right: RegionConstraint): void {
    // TODO: use width?
    unaryPropagatorBind(
      right.x,
      left.x, // Output
      (rightX: NumericRange) => {
        // console.log('here')
        return this.clampWidthToContent(subNumericRange(
          lessThan(rightX),
          exactly(this.horizontalPadding)
        ))
      }
      // atMost(getMin(rightX) - padding)
    )

    unaryPropagatorBind(
      left.x,
      right.x, // Output
      (leftX: NumericRange) => {
        // console.log('here')
        return this.clampWidthToContent(addNumericRange(
          greaterThan(leftX),
          exactly(this.horizontalPadding)
        ))
        // atLeast(getMax(leftX) + padding)
      }
    )
  }

  above(top: RegionConstraint, bottom: RegionConstraint): void {
    // TODO: use height?
    unaryPropagatorBind(
      bottom.y,
      top.y, // Output
      (bottomY: NumericRange) => {
        return this.clampHeightToContent(subNumericRange(
          lessThan(bottomY),
          exactly(this.verticalPadding)
        ))
        // console.log('bottomY', bottomY, 'top.height', top.height, 'padding', padding)
        // return atMost(getMin(bottomY) - top.height - padding)
      }
    )

    unaryPropagatorBind(
      top.y,
      bottom.y, // Output
      (topY: NumericRange) =>
        this.clampHeightToContent(addNumericRange(
          greaterThan(topY),
          exactly(this.verticalPadding)
        ))
      // atLeast(getMax(topY) + top.height + padding)
    )
  }

  private clampWidth(r: NumericRange): NumericRange {
    return { kind: 'Range', min: Math.max(getMin(r), getMin(this.widthBoundLimits)), max: Math.min(getMax(r), getMax(this.widthBoundLimits)) }
  }

  private clampHeight(r: NumericRange): NumericRange {
    return { kind: 'Range', min: Math.max(getMin(r), getMin(this.heightBoundLimits)), max: Math.min(getMax(r), getMax(this.heightBoundLimits)) }
  }

  private clampWidthToContent(r: NumericRange): Content<NumericRange> {
    return known(r)
    // let clamped = this.clampWidth(r)
    // if (getMin(clamped) > getMax(clamped)) {
    //   return { kind: 'Unknown' }
    // } else {
    //   return { kind: 'Known', value: clamped }
    // }
  }

  private clampHeightToContent(r: NumericRange): Content<NumericRange> {
    return known(r)
    // let clamped = this.clampHeight(r)
    // if (getMin(clamped) > getMax(clamped)) {
    //   return { kind: 'Unknown' }
    // } else {
    //   return { kind: 'Known', value: clamped }
    // }
  }
}
