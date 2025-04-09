import { NumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, PropagatorNetwork } from "../../../../constraint/propagator/Propagator";
import { LayoutTree } from "./LayoutTree";

export interface Constraint {
  apply(layoutTree: LayoutTree): void;

  cellsToMinimize(): CellRef[];
}
