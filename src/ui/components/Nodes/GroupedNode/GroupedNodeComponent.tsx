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
import { inputHandleName, outputHandleName } from '../../../NodeUtils';
import { NODE_HEIGHT, NODE_WIDTH } from '../../../Config';

const GROUPED_NODE_PADDING = 30;

export const makeGroupedNode = ({ data, width, height }: NodeProps<GroupedNode>) => {
  return (
    <div
      className='transpose-node'
      style={{ width: data.width, height: data.height }}
      // style={{
      //   // position: 'absolute',
      //   // left: data.x,
      //   // top: data.y,
      //   width: width,
      //   height: height,
      //   border: 'solid #000',
      //   // borderRadius: '5px',
      //   // borderRadius: '20%',
      //   // backgroundColor: 'rgba(240, 240, 240, 0.7)',
      //   // padding: '10px',
      // }}
    >
      <Handle type="target" id={outputHandleName(0)} position={Position.Top} style={{ top: 0 }} />
      <Handle type="source" id={inputHandleName(0)} position={Position.Bottom} style={{ bottom: 0 }} />
    </div>
    );
}

export type Dimensions = {
  width: number;
  height: number;
}

const WIDTH_PADDING_PER_NODE = NODE_WIDTH;
const HEIGHT_PADDING_PER_NODE = NODE_HEIGHT;

export function calculateGroupBounds(nodeDimensions: Dimensions[]): Dimensions {
  if (nodeDimensions.length === 0) {
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }

  // Find the min/max coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodeDimensions.forEach(dim => {
    const width = dim.width || NODE_WIDTH;
    const height = dim.height || NODE_HEIGHT;
    
    minX = Math.min(minX, 0);  // Assuming nodes are positioned relative to (0,0)
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, width);
    maxY = Math.max(maxY, height);
  });

  const FIXED_PADDING = 290; // Adjust this value as needed
  
  return {
    width: (maxX - minX) + FIXED_PADDING,
    height: (maxY - minY) + FIXED_PADDING,
  };
}