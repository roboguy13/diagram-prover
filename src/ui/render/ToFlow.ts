// import * as dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled.js'
import { NodesAndEdges, elkToReactFlow } from './NodesAndEdges';
import { Position } from 'reactflow';

import { Model } from '../architecture/Model';
import { getNextChangedId } from '../architecture/Model';
import { build } from 'esbuild';

import { AppNode } from '../components/Nodes/nodeTypes';
import { SemanticNode } from '../../ir/SemanticGraph';
import { semanticNodeToElk } from '../../ir/ToElk';

const elk = new ELK();

export async function toFlow(g: SemanticNode): Promise<NodesAndEdges> {
  let graph = semanticNodeToElk(g);

  // console.log('Graph for ELK:', graph);

  let promise = elk
    .layout(graph)
    // .then((layoutedGraph) => ({
    //   nodes: layoutedGraph.children!.map((node) => {
    //     // Preserve the original node data and just update the position
    //     return {
    //       ...node,
    //       // React Flow expects a position property on the node instead of `x`
    //       // and `y` fields.
    //       position: { 
    //         x: node.x !== undefined ? node.x : 0,
    //         y: node.y !== undefined ? node.y : 0 
    //       },
    //     };
    //   }),
 
    //   edges: layoutedGraph.edges,
    // }))
    .catch(console.error);

  let result = await promise

  // console.log('ELK layout result:', result?.children?.map(node => 
  //   ({id: node.id, x: node.x, y: node.y})));

  if (result) {
    const flowOutput = elkToReactFlow(result);
    console.log('React Flow nodes:', Array.from(flowOutput.nodes.entries()) .map(([id, node]) => ({id, position: node.position})));
    return flowOutput;
  } else {
    return { nodes: new Map<string, AppNode>(), edges: new Array() };
  }
}

// export async function toFlow(model: Model, g: NodesAndEdges): Promise<NodesAndEdges> {
//   // const isHorizontal = elkOptions['elk.direction'] === 'RIGHT';
//   const isHorizontal = false

//   let nodes = Array.from(g.nodes.values());
//   let edges = g.edges;

//   const graph = {
//     id: 'root',
//     layoutOptions: elkOptions,
//     children: nodes.map((node) => ({
//       ...node,
//       // Adjust the target and source handle positions based on the layout
//       // direction.
//       targetPosition: isHorizontal ? 'left' : 'top',
//       sourcePosition: isHorizontal ? 'right' : 'bottom',
 
//       // Hardcode a width and height for elk to use when layouting.
//       width: 150,
//       height: 50,
//     })),
//     edges: edges.map((edge) => ({
//       ...edge,
//       sources: [edge.source],
//       targets: [edge.target],
//     })),
//   };

//   // Create a map of original nodes by ID for easy lookup
//   const nodeMap = new Map();
//   nodes.forEach(node => nodeMap.set(node.id, node));

//   let promise = elk
//     .layout(graph)
//     .then((layoutedGraph) => ({
//       nodes: layoutedGraph.children!.map((node) => {
//         // Preserve the original node data and just update the position
//         const originalNode = nodeMap.get(node.id);
//         return {
//           ...originalNode,
//           // React Flow expects a position property on the node instead of `x`
//           // and `y` fields.
//           position: { 
//             x: node.x !== undefined ? node.x : 0,
//             y: node.y !== undefined ? node.y : 0 
//           },
//         };
//       }),
 
//       edges: layoutedGraph.edges,
//     }))
//     .catch(console.error);

//   let result = await promise

//   if (result) {
//     return { nodes: buildNodeMap(result.nodes), edges: edges};
//   } else {
//     return { nodes: new Map<string, AppNode>(), edges: edges };
//   }
// }
