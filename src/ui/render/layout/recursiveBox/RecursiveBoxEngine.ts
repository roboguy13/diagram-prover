import { Edge } from "@xyflow/react";
import { getEdges, getImmediateEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { ConstraintLayoutEngine, LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { ConstraintCalculator } from "./SpacingConstraints";
import { Locator } from "./Locator";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { ConflictHandler } from "../../../../constraint/propagator/Propagator";
import { atMost, NumericRange } from "../../../../constraint/propagator/NumericRange";

type InternalRep = [ConstraintCalculator, SemanticNode<void>, Edge[], string | null]

export const MAX_WIDTH: number = 1000;
export const MAX_HEIGHT: number = 500;

export class RecursiveBoxEngine implements ConstraintLayoutEngine<InternalRep> {
  private _conflictHandlers: ConflictHandler<NumericRange>[]

  constructor() {
    this._conflictHandlers = []
  }

  addConflictHandler(handler: ConflictHandler<NumericRange>) {
    this._conflictHandlers.push(handler)
  }

  public fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<InternalRep> {
    return new Promise<InternalRep>((resolve, _reject) => {
      const constraintCalculator = new ConstraintCalculator({ width: atMost(MAX_WIDTH), height: atMost(MAX_HEIGHT) }, [n], this._conflictHandlers)
      const edges = getEdges(n)

      resolve([constraintCalculator, n, edges, activeRedexId])
    })
  }

  public toReactFlow(g: InternalRep): Promise<NodesAndEdges> {
    let [constraintCalculator, n, edges, activeRedexId] = g

    let absolutePositionMap = constraintCalculator.absolutePositionMap

    let locator = new Locator(absolutePositionMap, n.id, { x: 0, y: 0 })

    let appNodes = new Map<string, AppNode>()
    this.traverseSemanticNode(n, locator, appNodes, activeRedexId)

    return Promise.resolve({
      nodes: appNodes,
      edges: edges
    })
  }

  public renderDebugInfo(g: InternalRep): Promise<NodesAndEdges> {
    let [constraintCalculator, _n, _edges, _activeRedexId] = g
    return constraintCalculator.renderDebugInfo()
  }

  traverseSemanticNode(n: SemanticNode<void>, locator: Locator, result: Map<string, AppNode>, activeRedexId: string | null): void {
    let position = locator.locate(n.id)

    switch (n.kind) {
      case 'Transpose': {
        result.set(n.id, {
          id: n.id,
          type: 'grouped',
          data: { label: n.label ?? '',
                },
          position: { x: position.x, y: position.y },
        })
        break
      }
      default:
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
    }

    for (let child of n.children) {
      this.traverseSemanticNode(child, locator, result, activeRedexId)
    }

    for (let child of n.subgraph ?? []) {
      this.traverseSemanticNode(child, locator, result, activeRedexId)
    }
  }
}
