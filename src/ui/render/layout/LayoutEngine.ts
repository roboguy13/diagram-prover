import { AppNode } from "../../components/Nodes/nodeTypes";
import { SemanticNode } from "../../../ir/SemanticGraph";
import { Edge } from "@xyflow/react";
import { ConflictHandler } from "../../../constraint/propagator/Propagator";
import { NumericRange } from "../../../constraint/propagator/NumericRange";

export type NodeMap = Map<string, AppNode>;
export type NodesAndEdges = { nodes: NodeMap, edges: Edge[] }

export interface LayoutEngine<A> {
  fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<A>
  toReactFlow(g: A): Promise<NodesAndEdges>
  renderDebugInfo(g: A): Promise<NodesAndEdges>
}

export interface ConstraintLayoutEngine<A> extends LayoutEngine<A> {
  addConflictHandler(handler: ConflictHandler<NumericRange>): void
}

export async function toFlow<A>(layoutEngine: LayoutEngine<A>, g: SemanticNode<void>, activeRedexId: string | null): Promise<NodesAndEdges> {
  let promise = layoutEngine.fromSemanticNode(g, activeRedexId)

  let result = await promise;

  if (result) {
    return layoutEngine.toReactFlow(result);
  } else {
    return { nodes: new Map<string, AppNode>(), edges: new Array() };
  }
}
