import { Edge } from "@xyflow/react";
import { getEdges, getImmediateEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { AbsolutePositionMap, ConstraintCalculator } from "./SpacingConstraints";
import { Locator } from "./Locator";
import { AppNode } from "../../../components/Nodes/nodeTypes";

type InternalRep = [AbsolutePositionMap, SemanticNode<void>, Edge[], string | null]

export class RecursiveBoxEngine implements LayoutEngine<InternalRep> {
  public fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<InternalRep> {
    return new Promise<InternalRep>((resolve, _reject) => {
      const constraintCalculator = new ConstraintCalculator(n)
      const edges = getEdges(n)

      resolve([constraintCalculator.absolutePositionMap, n, edges, activeRedexId])
    })
  }

  public toReactFlow(g: InternalRep): Promise<NodesAndEdges> {
    let [absolutePositionMap, n, edges, activeRedexId] = g
    let locator = new Locator(absolutePositionMap, n.id, { x: 0, y: 0 })

    let appNodes = new Map<string, AppNode>()
    this.traverseSemanticNode(n, locator, appNodes, activeRedexId)

    return Promise.resolve({
      nodes: appNodes,
      edges: edges
    })
  }

  traverseSemanticNode(n: SemanticNode<void>, locator: Locator, result: Map<string, AppNode>, activeRedexId: string | null): void {
    let position = locator.locate(n.id)

    result.set(n.id, {
      id: n.id,
      type: 'term',
      data: { label: n.label ?? '',
              isActiveRedex: n.id === activeRedexId,
              outputCount: 1,
              inputCount: getImmediateEdges(n).length,
            },
      position: { x: position.x, y: position.y },
    })

    for (let child of n.children) {
      this.traverseSemanticNode(child, locator, result, activeRedexId)
    }
  }
}
