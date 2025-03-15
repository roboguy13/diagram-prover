import { PartialSemigroup } from './PartialSemigroup'

export type NumericRange =
  | { kind: 'Exact', value: number }
  | { kind: 'Range', min: number, max: number }

export function addNumericRange(a: NumericRange, b: NumericRange): NumericRange {
  let aMin = getMin(a)
  let aMax = getMax(a)
  let bMin = getMin(b)
  let bMax = getMax(b)

  return between(aMin + bMin, aMax + bMax)
}

export function divNumericRangeNumber(a: NumericRange, b: number): NumericRange {
  if (b === 0) {
    throw new Error('Division by zero')
  } else {
    let aMin = getMin(a)
    let aMax = getMax(a)

    return between(aMin / b, aMax / b)
  }
}

export function subNumericRange(a: NumericRange, b: NumericRange): NumericRange {
  let aMin = getMin(a)
  let aMax = getMax(a)
  let bMin = getMin(b)
  let bMax = getMax(b)
  let theMin = aMin - bMax
  let theMax = aMax - bMin

  return between(theMin, theMax)
}

export function getMidpoint(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      if (!range.min) {
        if (!range.max) {
          return -Infinity
        } else {
          return range.max
        }
      }

      if (!range.max) {
        return range.min
      }

      return (range.min + range.max) / 2
  }
}

export function getMin(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      return range.min
  }
}

export function getMax(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      return range.max
  }
}

export function exactly(value: number): NumericRange {
  return { kind: 'Exact', value }
}

export function atLeast(min: number): NumericRange {
  return { kind: 'Range', min, max: Infinity }
}

export function atMost(max: number): NumericRange {
  return { kind: 'Range', min: -Infinity, max }
}

export function between(min: number, max: number): NumericRange {
  if (min === max) {
    return { kind: 'Exact', value: min }
  } else {
    return { kind: 'Range', min, max }
  }
}

export function lessThan(a: NumericRange): NumericRange {
  return { kind: 'Range', min: -Infinity, max: getMin(a) }
}

export function greaterThan(a: NumericRange): NumericRange {
  return { kind: 'Range', min: getMax(a), max: Infinity }
}

export function partialSemigroupNumericRange(): PartialSemigroup<NumericRange> {
  return {
    combine: (a, b) => {
      let aMin = getMin(a)
      let aMax = getMax(a)
      let bMin = getMin(b)
      let bMax = getMax(b)

      let theMin = Math.max(aMin, bMin)
      let theMax = Math.min(aMax, bMax)

      if (theMin === theMax) {
        return { kind: 'Exact', value: theMin }
      } else if (theMin < theMax) {
        return { kind: 'Range', min: theMin, max: theMax }
      } else {
        return null
      }
    }
  }
}
