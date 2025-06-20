import { PartialSemigroup } from './PartialSemigroup'
import { binaryPropagator, CellRef, known, naryPropagator, PropagatorNetwork, unaryPropagator } from './Propagator'

export type NumericRange =
  | { kind: 'Exact', value: number }
  | { kind: 'Range', min: number, max: number }

const EPSILON = 1

const LOG_EQUALITY_INTERVAL = 100
let equalityCheckCounter = 0

export function numericRangesEqual(a: NumericRange, b: NumericRange): boolean {
  equalityCheckCounter++
  if (equalityCheckCounter % LOG_EQUALITY_INTERVAL === 0) {
    console.log(`[numericRangesEqual DEBUG]: ${printNumericRange(a)} == ${printNumericRange(b)}`)
  }
  if (a.kind !== b.kind) {
    return false
  }
  
  if (a.kind === 'Exact' && b.kind === 'Exact') {
    return Math.abs(a.value - b.value) < EPSILON
  }

  if (a.kind === 'Range' && b.kind === 'Range') {
    const minDiff = (isFinite(a.min) && isFinite(b.min)) ? Math.abs(a.min - b.min) : (a.min === b.min ? 0 : Infinity);
    const maxDiff = (isFinite(a.max) && isFinite(b.max)) ? Math.abs(a.max - b.max) : (a.max === b.max ? 0 : Infinity);
    return minDiff < EPSILON && maxDiff < EPSILON;
  }

  // Kinds don't match
  return false;
}

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
      if (!isFinite(range.min) && !isFinite(range.max)) {
        return 0
      } else if (!isFinite(range.min)) {
        return range.max
      } else if (!isFinite(range.max)) {
        return range.min
      } else {
        return (range.min + range.max) / 2
      }
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

export function selectMin(range: NumericRange): NumericRange {
  switch (range.kind) {
    case 'Exact':
      return range
    case 'Range':
      return exactly(range.min)
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
    if (min > max) {
      throw new Error(`Invalid range: ${min} > ${max}`)
    }
    return { kind: 'Range', min, max }
  }
}

export function lessThan(a: NumericRange): NumericRange {
  return { kind: 'Range', min: -Infinity, max: getMin(a) }
}

export function greaterThan(a: NumericRange): NumericRange {
  return { kind: 'Range', min: getMax(a), max: Infinity }
}

export function splitRange(range: NumericRange): [NumericRange, NumericRange] {
  let min = getMin(range)
  let max = getMax(range)

  // If the range is already exact or invalid (min > max), don't split further
  if (min >= max) {
    return [exactly(min), exactly(max)]; // Or handle invalid range appropriately
  }

  let midpoint = getMidpoint(range);
  console.log(`[splitRange DEBUG]: midpoint: ${midpoint}`);

  // Ensure midpoint doesn't somehow exceed max (due to floating point issues)
  midpoint = Math.min(midpoint, max);
  // Ensure midpoint is not less than min
  midpoint = Math.max(midpoint, min);

  console.log(`[splitRange DEBUG]: clamped midpoint: ${midpoint}`);

  const lower = between(min, midpoint);

  // Calculate the start of the upper range, but ensure it doesn't exceed the original max
  const upperMin = Math.min(midpoint + EPSILON, max);

  // Ensure the upper range's min is not less than its max (can happen if midpoint + EPSILON > max)
  const upper = between(Math.min(upperMin, max), max);

  console.log(`[splitRange DEBUG]: lower: ${printNumericRange(lower)}, upper: ${printNumericRange(upper)}`);

  return [lower, upper];
}

export function printNumericRange(range: NumericRange): string {
  switch (range.kind) {
    case 'Exact':
      return range.value.toString()
    case 'Range':
      return `[${range.min}, ${range.max}]`
  }
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

export function addRangePropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, b: CellRef, result: CellRef): void {
  // a + b = result
  net.binaryPropagator(writer, 'add', a, b, result, (aVal: NumericRange, bVal: NumericRange): NumericRange => {
    return addNumericRange(aVal, bVal)
  })

  // result - a = b
  net.binaryPropagator(writer, 'sub', result, a, b, (resultVal: NumericRange, aVal: NumericRange): NumericRange => {
    return subNumericRange(resultVal, aVal)
  })

  // result - b = a
  net.binaryPropagator(writer, 'sub', result, b, a, (resultVal: NumericRange, bVal: NumericRange): NumericRange => {
    return subNumericRange(resultVal, bVal)
  })
}

export function subtractRangePropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, b: CellRef, result: CellRef): void {
  // a - b = result
  addRangePropagator(writer, net, result, b, a)
}

export function addRangeListPropagator(writer: string, net: PropagatorNetwork<NumericRange>, aList: CellRef[], result: CellRef): void {
  net.foldLeftPropagator(
    `${writer}: addList(aList)->result`,
    'addList',
    aList,
    result,
    (a: CellRef, b: CellRef, result: CellRef): void => {
      addRangePropagator(writer, net, a, b, result)
    }
  )
}

export function multNumericRangeNumber(a: NumericRange, b: number): NumericRange {
  let aMin = getMin(a)
  let aMax = getMax(a)

  return between(aMin * b, aMax * b)
}

export function divNumericRangeNumberPropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, b: number, result: CellRef): void {
  // a / b = result
  net.unaryPropagator(writer, `/${b}`, a, result, (aVal: NumericRange): NumericRange => {
    return divNumericRangeNumber(aVal, b)
  })

  // result * b = a
  net.unaryPropagator(writer, `*${b}`, result, a, (resultVal: NumericRange): NumericRange => {
    return multNumericRangeNumber(resultVal, b)
  })
}

export function multNumericRangeNumberPropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, b: number, result: CellRef): void {
  // a * b = result
  net.unaryPropagator(writer, `*${b}`, a, result, (aVal: NumericRange): NumericRange => {
    return multNumericRangeNumber(aVal, b)
  })

  // result / b = a
  net.unaryPropagator(writer, `/${b}`, result, a, (resultVal: NumericRange): NumericRange => {
    return divNumericRangeNumber(resultVal, b)
  })
}

export function negateNumericRangePropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, result: CellRef): void {
  // -a = result
  net.unaryPropagator(writer, `negate`, a, result, (aVal: NumericRange): NumericRange => {
    return { kind: 'Range', min: -getMax(aVal), max: -getMin(aVal) }
  })

  // -result = a
  net.unaryPropagator(writer, `negate`, result, a, (resultVal: NumericRange): NumericRange => {
    return { kind: 'Range', min: -getMax(resultVal), max: -getMin(resultVal) }
  })
}

export function lessThanEqualPropagator(writer: string, net: PropagatorNetwork<NumericRange>, a: CellRef, b: CellRef): void {
  const atMostZero = net.newCell(writer, known(atMost(0)))

  // a <= b is equivalent to a - b <= 0
  subtractRangePropagator(writer, net, a, b, atMostZero)
}

export function writeBetweenPropagator(net: PropagatorNetwork<NumericRange>, cell: CellRef, min: number, max: number): void {
  net.writeCell({ description: `cell ∈ [${min}, ${max}]`, inputs: [], outputs: [cell] }, cell, known(between(min, max)))
}

export function writeAtLeastPropagator(net: PropagatorNetwork<NumericRange>, cell: CellRef, min: number): void {
  net.writeCell({ description: `cell ∈ [${min}, ∞)`, inputs: [], outputs: [cell] }, cell, known(atLeast(min)))
}

export function maxNumericRange(a: NumericRange, b: NumericRange): NumericRange {
  let aMin = getMin(a)
  let aMax = getMax(a)
  let bMin = getMin(b)
  let bMax = getMax(b)

  return between(Math.max(aMin, bMin), Math.max(aMax, bMax))
}

export function minNumericRange(a: NumericRange, b: NumericRange): NumericRange {
  let aMin = getMin(a)
  let aMax = getMax(a)
  let bMin = getMin(b)
  let bMax = getMax(b)

  return between(Math.min(aMin, bMin), Math.min(aMax, bMax))
}

export function maxRangePropagator(
  writer: string,
  net: PropagatorNetwork<NumericRange>,
  a: CellRef,
  b: CellRef,
  result: CellRef
){
  // max(a, b) = result
  net.binaryPropagator(`${writer}: max(a,b)->result`, 'max', a, b, result, maxNumericRange)

  // a <= result
  lessThanEqualPropagator(`${writer}: a<=result`, net, a, result)

  // b <= result
  lessThanEqualPropagator(`${writer}: b<=result`, net, b, result)
}

export function minRangePropagator(
  writer: string,
  net: PropagatorNetwork<NumericRange>,
  a: CellRef,
  b: CellRef,
  result: CellRef
){
  // min(a, b) = result
  net.binaryPropagator(`${writer}: min(a,b)->result`, 'min', a, b, result, minNumericRange)

  // result <= a
  lessThanEqualPropagator(`${writer}: result<=a`, net, result, a)

  // result <= b
  lessThanEqualPropagator(`${writer}: result<=b`, net, result, b)
}

export function maxRangeListPropagator(
  writer: string,
  net: PropagatorNetwork<NumericRange>,
  aList: CellRef[],
  result: CellRef
){
  net.foldLeftPropagator(
    `${writer}: maxList(aList)->result`,
    'maxList',
    aList,
    result,
    (a: CellRef, b: CellRef, result: CellRef): void => {
      maxRangePropagator(writer, net, a, b, result)
    }
  )
}


export function minRangeListPropagator(
  writer: string,
  net: PropagatorNetwork<NumericRange>,
  aList: CellRef[],
  result: CellRef
){
  net.foldLeftPropagator(
    `${writer}: minList(aList)->result`,
    'minList',
    aList,
    result,
    (a: CellRef, b: CellRef, result: CellRef): void => {
      minRangePropagator(writer, net, a, b, result)
    }
  )
}
