import { Dimensions } from "./BoxNode";
import { addNumericRange, atLeast, atMost, exactly, getMax, getMidpoint, getMin, NumericRange } from "../../../../constraint/propagator/NumericRange";
import { Cell, naryPropagator, unaryPropagator } from "../../../../constraint/propagator/Propagator";

export type BoundingBox = { x: number; y: number; dimensions: Dimensions; };

export function getBoundingBox(constraint: BoundingBoxConstraint): BoundingBox {
  let x = constraint.x.readKnownOrError('bounding box x')
  let y = constraint.y.readKnownOrError('bounding box y')
  let width = constraint.width.readKnownOrError('bounding box width')
  let height = constraint.height.readKnownOrError('bounding box height')

  return {
    x: getMidpoint(x),
    y: getMidpoint(y),
    dimensions: {
      width: getMin(width),
      height: getMin(height)
    }
  }
}

// (0,0) is the top left corner
export type BoundingBoxConstraint = {
  x: Cell<NumericRange>;
  y: Cell<NumericRange>;
  width: Cell<NumericRange>;
  height: Cell<NumericRange>;
}

export function contains(padding: number, outer: BoundingBoxConstraint, inners: BoundingBoxConstraint[]): void {
  naryPropagator(
    inners.map((inner: BoundingBoxConstraint) => inner.width),
    outer.width,
    (innerWidths: NumericRange[]) =>
      addNumericRange(exactly(padding), addNumericRangeList(innerWidths))
  )

  naryPropagator(
    inners.map((inner: BoundingBoxConstraint) => inner.height),
    outer.height,
    (innerHeights: NumericRange[]) =>
      addNumericRange(exactly(padding), addNumericRangeList(innerHeights))
  )
}

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

export function toTheLeftOf(padding: number, left: BoundingBoxConstraint, right: BoundingBoxConstraint): void {
  // TODO: use width?
  unaryPropagator(
    right.x,
    left.x,
    (rightX: NumericRange) =>
      atMost(getMin(rightX) - padding)
  )

  unaryPropagator(
    left.x,
    right.x,
    (leftX: NumericRange) =>
      atLeast(getMax(leftX) + padding)
  )
}

export function above(padding: number, top: BoundingBoxConstraint, bottom: BoundingBoxConstraint): void {
  // TODO: use height?
  unaryPropagator(
    bottom.y,
    top.y,
    (bottomY: NumericRange) =>
      atMost(getMin(bottomY) - padding)
  )

  unaryPropagator(
    top.y,
    bottom.y,
    (topY: NumericRange) =>
      atLeast(getMax(topY) + padding)
  )
}
