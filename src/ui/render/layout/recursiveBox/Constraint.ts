import { NumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, PropagatorNetwork } from "../../../../constraint/propagator/Propagator";
import { BoundingBox } from "./BoundingBox";
import { DebugBoundingBox } from "./DebugBoundingBox";
import { LayoutTree } from "./LayoutTree";

export interface Constraint {
  apply(layoutTree: LayoutTree): void;

  cellsToMinimize(): CellRef[];

  debugBoxes: DebugBoundingBox[];
}
