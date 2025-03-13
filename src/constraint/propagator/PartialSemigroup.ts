export interface PartialSemigroup<T> {
  combine(a: T, b: T): T | null;
}

export function totalSemigroup<T>(semigroup: PartialSemigroup<T>, a: T, b: T): T | null {
  return semigroup.combine(a, b);
}
