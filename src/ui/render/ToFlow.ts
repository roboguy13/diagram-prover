// import * as dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled.js'
import { NodesAndEdges, buildNodeMap } from './NodesAndEdges';
import { Position } from 'reactflow';

import { Model } from '../architecture/Model';
import { getNextChangedId } from '../architecture/Model';
import { build } from 'esbuild';

import { AppNode } from '../components/Nodes/nodeTypes';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

const elk = new ELK();

// See these for options:
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
};

export async function toFlow(model: Model, g: NodesAndEdges): Promise<NodesAndEdges> {
  // const isHorizontal = elkOptions['elk.direction'] === 'RIGHT';
  const isHorizontal = false

  let nodes = Array.from(g.nodes.values());
  let edges = g.edges;

  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => ({
      ...node,
      // Adjust the target and source handle positions based on the layout
      // direction.
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
 
      // Hardcode a width and height for elk to use when layouting.
      width: 150,
      height: 50,
    })),
    edges: edges.map((edge) => ({
      ...edge,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  // Create a map of original nodes by ID for easy lookup
  const nodeMap = new Map();
  nodes.forEach(node => nodeMap.set(node.id, node));

  let promise = elk
    .layout(graph)
    .then((layoutedGraph) => ({
      nodes: layoutedGraph.children!.map((node) => {
        // Preserve the original node data and just update the position
        const originalNode = nodeMap.get(node.id);
        return {
          ...originalNode,
          // React Flow expects a position property on the node instead of `x`
          // and `y` fields.
          position: { 
            x: node.x !== undefined ? node.x : 0,
            y: node.y !== undefined ? node.y : 0 
          },
        };
      }),
 
      edges: layoutedGraph.edges,
    }))
    .catch(console.error);

  let result = await promise

  if (result) {
    return { nodes: buildNodeMap(result.nodes), edges: edges};
  } else {
    return { nodes: new Map<string, AppNode>(), edges: edges };
  }
}

// export function toFlow(model: Model, g: NodesAndEdges, direction = 'TB'): NodesAndEdges {
//   const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

//   const isHorizontal = direction === 'LR';
//   dagreGraph.setGraph({ rankdir: direction });

//   const nodes = g.nodes;
//   const edges = g.edges;
 
//   nodes.forEach((node) => {
//     dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
//   });
 
//   edges.forEach((edge) => {
//     dagreGraph.setEdge(edge.source, edge.target);
//   });
 
//   dagre.layout(dagreGraph);
 

//   const newNodes = Array.from(nodes.values()).map((node) => {
//     const nodeWithPosition = dagreGraph.node(node.id);

//     const newNode = {
//       ...node,
//       targetPosition: isHorizontal ? Position.Left : Position.Top,
//       sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
//       // We are shifting the dagre node position (anchor=center center) to the top left
//       // so it matches the React Flow node anchor point (top left).
//       position: {
//         x: nodeWithPosition.x - NODE_WIDTH / 2,
//         y: nodeWithPosition.y - NODE_HEIGHT / 2,
//       },
//     };
 
//     return newNode;
//   });

//   let nodeMap = buildNodeMap(newNodes);

//   return { nodes: nodeMap, edges };
// }
