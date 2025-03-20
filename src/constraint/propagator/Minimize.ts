// This is a search strategy to find a minimal configuration for a propagator network that uses `NumericRange`s.

import { cloneElement } from "react";
import { exactly, getMax, getMidpoint, getMin, NumericRange, splitRange } from "./NumericRange";
import { CellRef, known, PropagatorNetwork } from "./Propagator";

const DEBUG_MINIMIZE = true

// This miminizes the contents of a propagator network based on a set of cells that are to be minimized.
//
// Precondition: All cells in the network are known.
export class Minimizer {
  private _net: PropagatorNetwork<NumericRange>
  private _minimizingCells: CellRef[]
  private readonly MIN_RANGE_SIZE = 1 // TODO: Is this a good value?

  constructor(net: PropagatorNetwork<NumericRange>, minimizingCells: CellRef[]) {
    this._net = net
    this._minimizingCells = minimizingCells
    console.log('Minimizer: cell count: ', this._minimizingCells.length)
  }

  public minimize(): void {
    if (!this.minimizeCellsBacktracking(0)) {
      throw new Error('Minimizer.minimize: Could not find a consistent minimization')
    }

    if (DEBUG_MINIMIZE) {
      this.verifyMinimized()
    }

    try {
      this._net.updateAllCells(this._minimizingCells, (range) => exactly(getMin(range)))
    } catch (e) {
      throw new Error('Minimizer: Network is inconsistent after minimization')
    }
  }

  private minimizeCellsBacktracking(index: number): boolean {
    // Base case
    if (index >= this._minimizingCells.length) {
      return true;
    }
  
    // Get the current cell's known range
    const cell = this._minimizingCells[index]!;
    const range = this._net.readKnownOrError(cell, "min step");
    // If the range is already small enough, just move on
    const size = Math.abs(getMax(range) - getMin(range));
    if (size <= this.MIN_RANGE_SIZE) {
      return this.minimizeCellsBacktracking(index + 1);
    }
  
    const [lowerRange, upperRange] = splitRange(range);
  
    //
    // 1) Try narrowing to the lower half
    //
    this._net.checkpoint();
    try {
      this._net.writeCell(cell, known(lowerRange));
      // Now see if we can minimize the rest of the cells
      if (this.minimizeCellsBacktracking(index + 1)) {
        return true; // success, so keep the narrower half
      }
    } catch (err) {
      // conflict -> revert
    }
    this._net.revert();
  
    //
    // 2) Try narrowing to the upper half
    //
    this._net.checkpoint();
    try {
      this._net.writeCell(cell, known(upperRange));
      if (this.minimizeCellsBacktracking(index + 1)) {
        return true;
      }
    } catch (err) {
      // conflict -> revert
    }
    this._net.revert();
  
    //
    // 3) If both splits failed, leave it as is, or skip
    //    (but "as is" might still be the original big range!)
    //
    // If you truly want to keep subdividing until the range
    // is below MIN_RANGE_SIZE, you can *loop* here.
    // Or you could do deeper nesting of splits.
    //
    // If you do not want to skip, you can do:
    this._net.writeCell(cell, known(range));
    return this.minimizeCellsBacktracking(index + 1);
  }

  // private minimizeCellsBacktracking(index: number): boolean {
  //   if (index >= this._minimizingCells.length) {
  //     return true; // All cells processed successfully
  //   }
  
  //   const cell = this._minimizingCells[index]!;
  //   let range = this._net.readKnownOrError(cell, 'Minimizer.minimizeCellsBacktracking');
  //   console.log('Minimizer.minimizeCellsBacktracking: ', index, this._net.cellDescription(this._minimizingCells[index]!))
  //   console.log('Minimizer.minimizeCellsBacktracking: range: ', range)
  
  //   // If range is already small enough, move to next cell
  //   if (Math.abs(getMax(range) - getMin(range)) < this.MIN_RANGE_SIZE) {
  //     return this.minimizeCellsBacktracking(index + 1);
  //   }
  
  //   const [lowerRange, upperRange] = splitRange(range);
  //   this._net.checkpoint();
  
  //   // Try lower range first (prefer smaller values)
  //   try {
  //     this._net.writeCell(cell, known(lowerRange));
  //     if (this.minimizeCellsBacktracking(index)) {
  //       return true; // Lower range worked, proceed
  //     }
  //   } catch (e) {
  //     // Inconsistency detected, will try upper range
  //   }
  
  //   this._net.revert();
  //   this._net.checkpoint();
  
  //   // Try upper range if lower fails
  //   try {
  //     this._net.writeCell(cell, known(upperRange));
  //     if (this.minimizeCellsBacktracking(index)) {
  //       return true; // Upper range worked, proceed
  //     }
  //   } catch (e) {
  //     // Upper range also inconsistent
  //   }
  
  //   this._net.revert();
  //   return false; // Neither range worked, backtrack
  // }

  // private minimizeCellsBacktracking(index: number): boolean {
  //   if (index >= this._minimizingCells.length) {
  //     // We've successfully minimized all cells
  //     return true
  //   }

  //   const cell = this._minimizingCells[index]!

  //   this._net.checkpoint()

  //   try {
  //     if (this.minimizeCell(cell)) {
  //       // Minimizing cell succeeded, next we try to minimize the next cell
  //       if (this.minimizeCellsBacktracking(index + 1)) {
  //         return true
  //       }
  //     }
  //   } catch (e) {
  //   }

  //   this._net.revert()

  //   return this.minimizeCellsBacktracking(index + 1)
  // }

  private verifyMinimized(): void {
    for (let cell of this._minimizingCells) {
      let range = this._net.readKnownOrError(cell, 'Minimizer.verifyMinimized')

      console.log('Minimizer.verifyMinimized: ', range)

      if (Math.abs(getMax(range) - getMin(range)) > this.MIN_RANGE_SIZE) {
        throw new Error('Minimizer.verifyMinimized: Cell is not minimized ' + JSON.stringify(range))
      }
    }
  }

  // public minimize(): void {
  //   for (let cell of this._minimizingCells) {
  //     if (!this.minimizeCell(cell)) {
  //       throw new Error('Minimizer.minimize: Could not minimize cell: ' + this._net.cellDescription(cell))
  //     }
  //   }

  //   if (DEBUG_MINIMIZE) {
  //     this.verifyMinimized()
  //   }

  //   try {
  //     this._net.updateAllCells(this._minimizingCells, (range) => exactly(getMax(range)))
  //   } catch (e) {
  //       throw new Error('Minimizer: Network is inconsistent after minimization')
  //   }
  // }

  // Find a small value for this cell which keeps the network consistent.
  // Returns true if a value was found, false otherwise.
  private minimizeCell(cell: CellRef): boolean {
    let range = this._net.readKnownOrError(cell, 'Minimizer.minimizeCell')

    if (getMin(range) === -Infinity || getMax(range) === Infinity) {
      throw new Error('Minimizer.minimizeCell: Range is unbounded')
    }

    let [lowerRange, upperRange] = splitRange(range)
    // console.log('Minimizer.minimizeCell: ', lowerRange, upperRange)

    if (Math.abs(getMax(upperRange) - getMin(lowerRange)) < this.MIN_RANGE_SIZE) {
      return true
    }

    this._net.checkpoint()

    try {
      this._net.writeCell(cell, known(lowerRange))
      if (this.minimizeCell(cell)) {
        return true
      }

      this._net.revert()

      this._net.checkpoint()
      this._net.writeCell(cell, known(upperRange))
      return this.minimizeCell(cell)
    } catch (e) {
      this._net.revert()
      return false
    }
  }
}

