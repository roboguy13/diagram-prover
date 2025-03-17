import { PartialSemigroup } from './PartialSemigroup'
import { binaryPropagator, Cell, known, naryPropagator, unaryPropagator } from './Propagator'

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

export function addNumericRangeList(aList: NumericRange[]): NumericRange {
  if (aList.length === 0) {
    return exactly(0)
  }

  let result = aList[0]!
  for (let i = 0; i < aList.length; i++) {
    result = addNumericRange(result, aList[i]!)
  }
  return result
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

export function addRangePropagator(a: Cell<NumericRange>, b: Cell<NumericRange>, result: Cell<NumericRange>): void {
  // a + b = result
  binaryPropagator(a, b, result, (aVal: NumericRange, bVal: NumericRange): NumericRange => {
    return addNumericRange(aVal, bVal)
  })

  // result - a = b
  binaryPropagator(result, a, b, (resultVal: NumericRange, aVal: NumericRange): NumericRange => {
    return subNumericRange(resultVal, aVal)
  })

  // result - b = a
  binaryPropagator(result, b, a, (resultVal: NumericRange, bVal: NumericRange): NumericRange => {
    return subNumericRange(resultVal, bVal)
  })
}

export function addRangeListPropagator(aList: Cell<NumericRange>[], result: Cell<NumericRange>): void {
  // a1 + a2 + ... + an = result
  naryPropagator(aList, result, (aListVals: NumericRange[]): NumericRange => {
    let result = aListVals[0]!

    for (let i = 0; i < aListVals.length; i++) {
      result = addNumericRange(result, aListVals[i]!)
    }

    return result
  })

  for (let i = 0; i < aList.length; i++) {
    // result - (a1 + ... + a(i-1) + a(i+1) + ... + an) = ai
    let contentsBeforeIx = aList.slice(0, i)
    let contentsAfterIx = aList.slice(i + 1)

    naryPropagator([result, ...contentsBeforeIx, ...contentsAfterIx], aList[i]!, (theRanges: NumericRange[]): NumericRange => {
      let result = theRanges[0]!
      let otherRanges = theRanges.slice(1)

      return subNumericRange(result, addNumericRangeList(otherRanges))
    })
  }
}

export function divNumericRangeNumberPropagator(a: Cell<NumericRange>, b: number, result: Cell<NumericRange>): void {
  // a / b = result
  unaryPropagator(a, result, (aVal: NumericRange): NumericRange => {
    return divNumericRangeNumber(aVal, b)
  })

  // result * b = a
  unaryPropagator(result, a, (resultVal: NumericRange): NumericRange => {
    return addNumericRange(resultVal, exactly(b))
  })
}

export function negateNumericRangePropagator(a: Cell<NumericRange>, result: Cell<NumericRange>): void {
  // -a = result
  unaryPropagator(a, result, (aVal: NumericRange): NumericRange => {
    return { kind: 'Range', min: -getMax(aVal), max: -getMin(aVal) }
  })

  // -result = a
  unaryPropagator(result, a, (resultVal: NumericRange): NumericRange => {
    return { kind: 'Range', min: -getMax(resultVal), max: -getMin(resultVal) }
  })
}

export function makeZeroCell(): Cell<NumericRange> {
  return new Cell<NumericRange>(partialSemigroupNumericRange(), known(exactly(0)))
}
