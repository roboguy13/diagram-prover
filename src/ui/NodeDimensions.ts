import { atLeast, between, exactly, NumericRange } from "../constraint/propagator/NumericRange"
import { SemanticNode } from "../ir/SemanticGraph"
import { DiagramNode } from "../ir/StringDiagram"

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

export function getStringNodeDimensions(node: DiagramNode): Dimensions {
  if (node.nodeKind === 'lam') {
    return { width: between(40, 800), height: between(40, 800) }
  } else if (node.nodeKind === 'portBar') {
    return { width: exactly(60), height: exactly(10) }
  }
  return { width: exactly(30), height: exactly(30) }
}