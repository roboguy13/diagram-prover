// This is a search strategy to find a minimal configuration for a propagator network that uses `NumericRange`s.

import { cloneElement } from "react";
import { exactly, getMax, getMidpoint, getMin, NumericRange, splitRange } from "./NumericRange";
import { CellRef, InconsistentError, known, PropagatorNetwork } from "./Propagator";

const DEBUG_MINIMIZE = true

// This miminizes the contents of a propagator network based on a set of cells that are to be minimized.
//
// Precondition: All cells in the network are known.
export class Minimizer {
  private _net: PropagatorNetwork<NumericRange>
  private _minimizingCells: CellRef[]
  private readonly MIN_RANGE_SIZE = 125 // or whatever small threshold you want

  constructor(net: PropagatorNetwork<NumericRange>, minimizingCells: CellRef[]) {
    this._net = net
    this._minimizingCells = minimizingCells
  }

  public minimize(): void {
    // Start backtracking at the first cell
    let success = this.minimizeCellsBacktracking(0)
    if (!success) {
      throw new Error("Could not find a consistent minimization.")
    }

    // Optionally verify we ended up with small ranges
    this.verifyMinimized()

    // // Then pick a final single point from each cell’s range:
    // // For example, the minimal boundary or midpoint
    // try {
    //   this._net.updateAllCells(this._minimizingCells, range => exactly(getMin(range)))
    // } catch (err) {
    //   throw new Error("Network is inconsistent after final assignment.")
    // }
  }

  private minimizeCellsBacktracking(index: number): boolean {
    // ----------------------------------
    // (1) Base case: if we've handled all cells, done.
    // ----------------------------------
    if (index >= this._minimizingCells.length) {
      return true
    }

    let cell = this._minimizingCells[index]!
    let range = this._net.readKnownOrError(cell, "minimizeCellsBacktracking")

    // ----------------------------------
    // (2) If this cell’s range is already small enough, move to the next cell.
    // ----------------------------------
    let size = Math.abs(getMax(range) - getMin(range))
    if (size <= this.MIN_RANGE_SIZE) {
      return this.minimizeCellsBacktracking(index + 1)
    }

    // Otherwise, we do one binary split of the cell’s current range
    let [lower, upper] = splitRange(range)

    // ----------------------------------
    // (3) Try setting the cell to the lower sub‐range
    // ----------------------------------
    this._net.checkpoint()
    try {
      this._net.writeCell(cell, known(lower))
      // If that leads to a consistent (and recursively minimized) solution,
      // then we keep it. We do not revert unless there's a failure.
      if (this.minimizeCellsBacktracking(index)) {
        // If we want to keep splitting the same cell further (to get it smaller),
        // we can do so in a loop until it’s under MIN_RANGE_SIZE, or just let
        // the next recursion call handle it. For simplicity, let's just return
        // success here.
        return true
      }
    } catch (err) {
      // If we got an InconsistentError, the lower half won't work
      // We'll revert below
    }
    this._net.revert()

    // ----------------------------------
    // (4) Try setting the cell to the upper sub‐range
    // ----------------------------------
    this._net.checkpoint()
    try {
      this._net.writeCell(cell, known(upper))
      if (this.minimizeCellsBacktracking(index)) {
        return true
      }
    } catch (err) {
      // same logic as lower half
    }
    this._net.revert()

    // ----------------------------------
    // (5) If neither subrange worked, revert the cell to its original range.
    //     Then either skip it or declare total failure.
    //     We’ll do a “skip” approach here:
    // ----------------------------------
    this._net.checkpoint()
    this._net.writeCell(cell, known(range))
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
