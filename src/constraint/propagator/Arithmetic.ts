import { Cell, binaryPropagator } from './Propagator'

export function addPropagator(input1: Cell<number>, input2: Cell<number>, output: Cell<number>) {
  binaryPropagator(input1, input2, output, (a, b) => a + b)
}

export function subtractPropagator(input1: Cell<number>, input2: Cell<number>, output: Cell<number>) {
  binaryPropagator(input1, input2, output, (a, b) => a - b)
}
