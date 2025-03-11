import * as dagre from 'dagre';
import { NodesAndEdges, buildNodeMap } from './NodesAndEdges';
import { Position } from 'reactflow';

import { Model } from '../Model';
import { getNextChangedId } from '../Model';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

export function toFlow(model: Model, g: NodesAndEdges, direction = 'TB'): NodesAndEdges {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  const nodes = g.nodes;
  const edges = g.edges;
 
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
 
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
 
  dagre.layout(dagreGraph);
 
  let nextChangedId = getNextChangedId(model);
    
  const newNodes = Array.from(nodes.values()).map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    let isNextChangedId = node.id == nextChangedId;

    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },

      className: `${isNextChangedId ? 'redex-node' : ''}`
    };
 
    return newNode;
  });
 
  return { nodes: buildNodeMap(newNodes), edges };
}
