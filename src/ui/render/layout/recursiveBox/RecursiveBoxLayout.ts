import { Edge, XYPosition } from "@xyflow/react";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { BreadthIndexMap, IndexedNode, LevelMap, makeEdgeKey } from "../NodeLevels";
import { addNumericRange, atLeast, between, divNumericRangeNumber, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Cell, known, naryPropagator, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator";
import { unary } from "lodash";

type InternalRep = [LevelMap, BreadthIndexMap, Edge[]]

export class RecursiveBoxEngine implements LayoutEngine<InternalRep> {
  public fromSemanticNode(n: SemanticNode<void>): Promise<InternalRep> {
    throw new Error("Method not implemented.");
  }

  public toReactFlow(g: InternalRep): Promise<NodesAndEdges> {
    throw new Error("Method not implemented.");
  }

  // buildConstraintMap(indexedNodes: IndexedNode[]): NodeRelationConstraintMap {
  //   let result = new Map<string, NodeRelationConstraint>()

  //   for (let i = 0; i < indexedNodes.length; i++) {
  //     for (let j = 0; j < indexedNodes.length; j++) {
  //       if (i < j) {
  //         let nodeA = indexedNodes[i]!
  //         let nodeB = indexedNodes[j]!
          
  //         let constraint = new NodeRelationConstraint(nodeA, nodeB, MAX_WIDTH)
  //         let key = constraint.edgeKey

  //         result.set(key, constraint)
  //       }
  //     }
  //   }

  //   return result
  // }
}
