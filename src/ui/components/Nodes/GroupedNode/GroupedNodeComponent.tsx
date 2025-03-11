import { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
  Connection,
  addEdge
} from '@xyflow/react';

import { type GroupedNode, AppNode } from '../nodeTypes';

import { getNode, type Model } from '../../../architecture/Model';

const GROUPED_NODE_PADDING = 30;

export const makeGroupedNode = ({ data }: NodeProps<GroupedNode>) => {
  return (
    <div
      style={{
        // position: 'absolute',
        // left: data.x,
        // top: data.y,
        // width: data.width,
        // height: data.height,
        border: '2px solid #000',
        borderRadius: '5px',
        backgroundColor: 'rgba(240, 240, 240, 0.7)',
        padding: '10px',
      }}
    >
    </div>
    );
}

function calculateGroupBounds(model: Model, nodeIds: string[]) {
  // Get nodes from node IDs:
  const nodes = nodeIds.map((id) => {
    const node = getNode(model, id);
    return node;
  });

  if (nodes.length === 0) return null;

  if (nodes[0]) {
    let firstNode = nodes[0];

    // Initialize bounds with the first node
    let minX: number = firstNode.position.x;
    let minY: number = firstNode.position.y;
    let maxX: number = firstNode.position.x + (firstNode.width || 150);
    let maxY: number = firstNode.position.y + (firstNode.height || 40);

    // Find the bounding box of all selected nodes
    nodes.forEach((node) => {
      if (node) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + (node.width || 150));
        maxY = Math.max(maxY, node.position.y + (node.height || 40));
      }
    });

    // Add padding
    minX -= GROUPED_NODE_PADDING;
    minY -= GROUPED_NODE_PADDING;
    maxX += GROUPED_NODE_PADDING;
    maxY += GROUPED_NODE_PADDING;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  } else {
    return null;
  }
};