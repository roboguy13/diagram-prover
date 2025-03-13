import { PartialSemigroup } from './PartialSemigroup'

export type NumericRange =
  | { kind: 'Exact', value: number }
  | { kind: 'Range', min?: number, max?: number }

export function addNumericRange(a: NumericRange, b: NumericRange): NumericRange {
  switch (a.kind) {
    case 'Exact':
      switch (b.kind) {
        case 'Exact':
          return { kind: 'Exact', value: a.value + b.value }
        case 'Range':
          return { kind: 'Range', min: (b.min || -Infinity) + a.value, max: (b.max || Infinity) + a.value }
      }
    case 'Range':
      switch (b.kind) {
        case 'Exact':
          return { kind: 'Range', min: (a.min || -Infinity) + b.value, max: (a.max || Infinity) + b.value }
        case 'Range':
          return { kind: 'Range', min: (a.min || -Infinity) + (b.min || -Infinity), max: (a.max || Infinity) + (b.max || Infinity) }
      }
  }
}

export function getMidpoint(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      if (!range.min) {
        if (!range.max) {
          return 0
        } else {
          return range.max
        }
      }

      if (!range.max) {
        return range.min
      }

      return range.min + range.max / 2
  }
}

export function getMin(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      return range.min || -Infinity
  }
}

export function getMax(range: NumericRange): number {
  switch (range.kind) {
    case 'Exact':
      return range.value
    case 'Range':
      return range.max || Infinity
  }
}

export function exactly(value: number): NumericRange {
  return { kind: 'Exact', value }
}

export function atLeast(min: number): NumericRange {
  return { kind: 'Range', min }
}

export function atMost(max: number): NumericRange {
  return { kind: 'Range', max }
}

export function between(min: number, max: number): NumericRange {
  return { kind: 'Range', min, max }
}

export function partialSemigroupNumericRange(): PartialSemigroup<NumericRange> {
  return {
    combine: (a, b) => {
      if (a.kind === 'Exact' && b.kind === 'Exact') {
        if (a.value === b.value) {
          return a
        } else {
          return null
        }
      }
      if (a.kind === 'Exact' && b.kind === 'Range') {
        if ((!b.min || a.value >= b.min) && (!b.max || a.value <= b.max)) {
          return a
        } else {
          return null
        }
      }
      if (a.kind === 'Range' && b.kind === 'Exact') {
        if ((!a.min || b.value >= a.min) && (!a.max || b.value <= a.max)) {
          return b
        } else {
          return null
        }
      }
      if (a.kind === 'Range' && b.kind === 'Range') {
        let min = Math.max(a.min || -Infinity, b.min || -Infinity)
        let max = Math.min(a.max || Infinity, b.max || Infinity)
        if (min <= max) {
          return { kind: 'Range', min, max }
        } else {
          return null
        }
      }
      return null
    }
  }
}
