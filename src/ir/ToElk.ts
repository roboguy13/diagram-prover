import { ElkExtendedEdge, ElkNode } from "elkjs";
import { SemanticNode } from "./SemanticGraph";
import { elkOptions, NODE_HEIGHT, NODE_WIDTH } from "../ui/Config";
import { inputHandleName, outputHandleName } from "../ui/NodeUtils";

export function semanticNodeToElk(node: SemanticNode): ElkNode {
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

function semanticNodeToElkList(node: SemanticNode): ElkNode[] {
  let kindLabel = node.kind === 'Transpose' ? 'Transpose' : 'Regular'

  let here = {
    id: node.id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    layoutOptions: elkOptions,
    labels: [{ text: kindLabel }].concat(node.label ? [{ text: node.label }] : []),
    children: node.subgraph ? node.subgraph.flatMap(semanticNodeToElkList) : [],

    edges: node.children.map((child, index) => ({
      id: `edge-${node.id}-${child.id}-${index}`,
      sources: [node.id],
      targets: [child.id],
    }))
  }

  return [here, ...node.children.flatMap(semanticNodeToElkList)];
}

var edgeId = 0

function newEdgeId(): string {
  edgeId += 1;
  return 'edge' + edgeId;
}

function collectElkEdges(elk: ElkNode): ElkExtendedEdge[] {
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
