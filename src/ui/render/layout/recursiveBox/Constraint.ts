import { CellRef } from "../../../../constraint/propagator/Propagator";
import { LayoutData } from "./constraints/LayoutData";

export type Spacing = {
  xSpacing: CellRef
  ySpacing: CellRef
}

export interface Constraint {
  apply(spacingMap: LayoutData): void;
}

export type ExactDimensions =
  { width: number,
    height: number
  }
export type DimensionsMap = Map<string, ExactDimensions>
