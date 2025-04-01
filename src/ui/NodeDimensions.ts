import { atLeast, NumericRange } from "../constraint/propagator/NumericRange"
import { SemanticNode } from "../ir/SemanticGraph"

export type Dimensions = {
  width: NumericRange,
  height: NumericRange
}

export function getNodeDimensions<A>(n: SemanticNode<A>): Dimensions {
  switch (n.kind) {
    case 'Transpose': {
      return { width: atLeast(80), height: atLeast(80) }
    }

    default:
      return { width: atLeast(30), height: atLeast(30) }
  }
}
