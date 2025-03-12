import { AppNode } from "../../components/Nodes/nodeTypes";
import { SemanticNode } from "../../../ir/SemanticGraph";
import { Edge } from "@xyflow/react";

export type NodesAndEdges = { nodes: Map<string, AppNode>, edges: Edge[] }

export interface LayoutEngine<A> {
  fromSemanticNode(n: SemanticNode): Promise<A>
  toReactFlow(g: A): Promise<NodesAndEdges>
}

export async function toFlow<A>(layoutEngine: LayoutEngine<A>, g: SemanticNode): Promise<NodesAndEdges> {
  let promise = layoutEngine.fromSemanticNode(g)

  let result = await promise;

  if (result) {
    return layoutEngine.toReactFlow(result);
  } else {
    return { nodes: new Map<string, AppNode>(), edges: new Array() };
  }
}
