// This is a search strategy to approximate a minimal configuration for a
// propagator network that uses `NumericRange`s.

import { cloneElement } from "react";
import { exactly, getMax, getMidpoint, getMin, NumericRange, splitRange } from "./NumericRange";
import { CellRef, InconsistentError, known, PropagatorNetwork } from "./Propagator";

const DEBUG_MINIMIZE = true

const LOG_MIN_STEPS = true

// This miminizes the contents of a propagator network based on a set of cells
// that are to be minimized.
// 
// Precondition: All cells in the network are known.
export class Minimizer {
  private _net: PropagatorNetwork<NumericRange>
  private _minimizingCells: CellRef[]
  private readonly MIN_RANGE_SIZE = 1
  private _minSteps = 0

  constructor(net: PropagatorNetwork<NumericRange>, minimizingCells: CellRef[]) {
    this._net = net
    this._minimizingCells = minimizingCells
  }

  public minimize(): void {
    const conflictHandlersOriginallyEnabled = this._net.conflictHandlersEnabled
    this._net.disableConflictHandlers()
    try {
      let success = this.minimizeCellsBacktracking(0)
      if (!success) {
        throw new Error("Could not find a consistent minimization.")
      }

      if (DEBUG_MINIMIZE) {
        this.verifyMinimized()
      }

      if (LOG_MIN_STEPS) {
        console.log(`Minimized in ${this._minSteps} steps.`)
      }
    } finally {
      if (conflictHandlersOriginallyEnabled) {
        this._net.enableConflictHandlers()
      }
    }
  }

  private minimizeCellsBacktracking(index: number): boolean {
    ++this._minSteps
    if (index >= this._minimizingCells.length) {
      // We minimized all the cells
      return true
    }

    let cell = this._minimizingCells[index]!
    let range = this._net.readKnownOrError(cell, "minimizeCellsBacktracking")

    let size = Math.abs(getMax(range) - getMin(range))
    if (size <= this.MIN_RANGE_SIZE) {
      // If the range is small enough, we move on to the next cell
      return this.minimizeCellsBacktracking(index + 1)
    }

    let [lower, upper] = splitRange(range)

    // Try the lower subrange
    this._net.checkpoint()
    try {
      this._net.writeCell({ description: `∈ ${lower}`, inputs: [], outputs: [cell] }, cell, known(lower))

      // Keep splitting
      if (this.minimizeCellsBacktracking(index)) {
        return true
      }
    } catch (err) {
      // Ignore any inconsistency error, we revert after this.
    }
    this._net.revert()

    // Try the upper subrange
    this._net.checkpoint()
    try {
      this._net.writeCell({ description: `∈ ${upper}`, inputs: [], outputs: [cell] }, cell, known(upper))

      // Keep splitting
      if (this.minimizeCellsBacktracking(index)) {
        return true
      }
    } catch (err) {
      // Ignore any inconsistency error, we revert after this.
    }
    this._net.revert()

    this._net.checkpoint()
    this._net.writeCell({ description: `∈ ${range}`, inputs: [], outputs: [cell] }, cell, known(range))
    let success = this.minimizeCellsBacktracking(index + 1)

    if (!success) {
      this._net.revert()
    }

    return success
  }

  private verifyMinimized(): void {
    for (let cell of this._minimizingCells) {
      let range = this._net.readKnownOrError(cell, "verifyMinimized")
      let size = Math.abs(getMax(range) - getMin(range))
      if (size > this.MIN_RANGE_SIZE) {
        throw new Error(
          `Cell is not minimized enough (${size} > ${this.MIN_RANGE_SIZE}): ${JSON.stringify(range)}`
        )
      }
    }
  }
}
