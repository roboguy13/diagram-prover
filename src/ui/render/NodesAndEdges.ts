import { AppNode, TermNode } from '../components/Nodes/nodeTypes';

import { Edge } from '@xyflow/react';

export type NodesAndEdges = { nodes: Map<string, AppNode>, edges: Edge[] }

export function buildNodeMap(nodes: AppNode[]): Map<string, AppNode> {
  const nodeMap = new Map<string, AppNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  return nodeMap;
}