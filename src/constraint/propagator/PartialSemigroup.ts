export interface PartialSemigroup<T> {
  combine(a: T, b: T): T | null;
}

export function totalSemigroup<T>(semigroup: PartialSemigroup<T>, a: T, b: T): T | null {
  return semigroup.combine(a, b);
}

export function eqPartialSemigroup<T>(): PartialSemigroup<T> {
  return {
    combine: (a, b) => {
      if (a === b) {
        return a;
      } else {
        return null;
      }
    }
  }
}