import { CellRef } from "../../../../constraint/propagator/Propagator";
import { SpacingMap } from "./constraints/SpacingMap";

export type Spacing = {
  xSpacing: CellRef
  ySpacing: CellRef
}

export interface Constraint {
  apply(spacingMap: SpacingMap): void;
}

export type ExactDimensions =
  { width: number,
    height: number
  }
export type DimensionsMap = Map<string, ExactDimensions>
