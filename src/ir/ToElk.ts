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
  let here = {
    id: node.id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    layoutOptions: elkOptions,
    labels: node.label ? [{ text: node.label }] : [],

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
    // .map(edge => ({
    //   id: edge.id,
    //   source: edge.sources[0]!,
    //   target: edge.targets[0]!,
    // }));
  // const localEdges: ElkExtendedEdge[] = zipWith(filteredEdges, range(filteredEdges.length - 1), (edge, index) => ({
  //   id: edge.id || newEdgeId(),

  //   sources: [elk.id],
  //   targets: [edge.targets[0]],

  //   sourceHandle: outputHandleName(index),
  //   // targetHandle: inputHandleName(0) // TODO
  // }));

  const childEdges = (elk.children ?? []).flatMap(collectElkEdges);

  return [...localEdges, ...childEdges];
}

// export function semanticNodeToElk(node: SemanticNode): ElkNode {
//   let subgraphElkNodes = node.subgraph?.map(semanticNodeToElk)

//   return {
//     id: node.id,

//     ...subgraphElkNodes ? { children: subgraphElkNodes } : {},

//     edges: node.children.map(child => ({
//       id: `${node.id}-${child.id}`,
//       sources: [node.id],
//       targets: [child.id],

//       ...node.label ? { text: node.label } : {},

//       // TODO: Move these things somewhere else?
//       targetPosition: 'top',
//       sourcePosition: 'bottom',
 
//       width: 150,
//       height: 50,
//     })),
//   };
// } 
