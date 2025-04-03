import { atLeast, exactly, NumericRange } from "../constraint/propagator/NumericRange"
import { SemanticNode } from "../ir/SemanticGraph"

export type Dimensions = {
  width: NumericRange,
  height: NumericRange
}

export function getNodeDimensions<A>(n: SemanticNode<A>): Dimensions {
  switch (n.kind) {
    case 'Transpose': {
      return { width: exactly(80), height: exactly(80) }
    }

    default:
      return { width: exactly(30), height: exactly(30) }
  }
}
