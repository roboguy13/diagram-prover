import { atLeast, exactly, NumericRange } from "../constraint/propagator/NumericRange"
import { SemanticNode } from "../ir/SemanticGraph"
import { StringNode } from "../ir/StringDiagram"

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

export function getStringNodeDimensions(node: StringNode): Dimensions {
  if (node.kind === 'LamNode') {
    return { width: atLeast(80), height: atLeast(80) }
  }
  return { width: exactly(30), height: exactly(30) }
}