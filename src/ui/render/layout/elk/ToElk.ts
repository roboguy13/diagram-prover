import { ElkExtendedEdge, ElkNode } from "elkjs";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { NODE_HEIGHT, NODE_WIDTH } from "../../../Config";
import { inputHandleName, outputHandleName } from "../../../NodeUtils";
import { calculateGroupBounds } from "../../../components/Nodes/GroupedNode/GroupedNodeComponent";
import { Dimensions } from "@xyflow/react";
import { elkOptions } from "./ElkConfig";

export function semanticNodeToElk(node: SemanticNode<void>): ElkNode {
  let elkList = semanticNodeToElkList(node);
  let edges = elkList.flatMap(collectElkEdges);

  console.log('Created ELK nodes:', elkList.length);

  return {
    id: 'root-node',
    children: elkList,
    layoutOptions: elkOptions,
    edges
  };
}

function semanticNodeToElkList(node: SemanticNode<void>): ElkNode[] {
  let kindLabel = node.kind === 'Transpose' ? 'Transpose' : 'Regular'

  let subgraph = node.subgraph ? node.subgraph.flatMap(semanticNodeToElkList) : []

  let bounds: Dimensions =
    kindLabel === 'Transpose'
      ? calculateGroupBounds(subgraph.map(child => ({ width: child.width!, height: child.height! })))
      : { width: NODE_WIDTH, height: NODE_HEIGHT };

  let here = {
    id: node.id,
    width: bounds.width,
    height: bounds.height,
    layoutOptions: elkOptions,
    labels: [{ text: kindLabel }].concat(node.label ? [{ text: node.label }] : []),
    children: subgraph,

    edges: node.children.map((child, index) => ({
      id: `edge-${node.id}-${child.id}-${index}`,
      sources: [child.id],
      targets: [node.id],
      // sources: [node.id],
      // targets: [child.id],
    }))
  }

  return [here, ...node.children.flatMap(semanticNodeToElkList)];
}

var edgeId = 0

function newEdgeId(): string {
  edgeId += 1;
  return 'edge' + edgeId;
}

export function collectElkEdges(elk: ElkNode): ElkExtendedEdge[] {
  const localEdges: any[] = (elk.edges ?? [])
    .filter(edge => edge.sources?.[0] !== undefined && edge.targets?.[0] !== undefined)
    .map((edge, index) => {
      const uniqueId = edge.id || `edge-${elk.id}-${index}-${newEdgeId()}`;
      return {
        id: edge.id || newEdgeId(),
        sources: [edge.sources[0]!],
        targets: [edge.targets[0]!],
        // Set source handle based on index if the source is this node
        ...(edge.sources[0] === elk.id ? { sourceHandle: outputHandleName(index) } : {}),
        // Add target handle
        targetHandle: inputHandleName(0)
      }});

  const childEdges = (elk.children ?? []).flatMap(collectElkEdges);

  return [...localEdges, ...childEdges];
}
