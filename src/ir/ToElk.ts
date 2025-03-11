import { ElkNode } from "elkjs";
import { SemanticNode } from "./SemanticGraph";

export function semanticNodeToElk(node: SemanticNode): ElkNode {
  let subgraphElkNodes = node.subgraph?.map(semanticNodeToElk)

  return {
    id: node.id,

    ...subgraphElkNodes ? { children: subgraphElkNodes } : {},

    edges: node.children.map(child => ({
      id: `${node.id}-${child.id}`,
      sources: [node.id],
      targets: [child.id]
    })),
  };
} 
