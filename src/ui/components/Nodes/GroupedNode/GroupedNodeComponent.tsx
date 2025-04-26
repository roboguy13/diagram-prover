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

import { type GroupedNode, ApplicationNode } from '../nodeTypes';

import { type Model } from '../../../architecture/Model';
import { parameterHandleName, inputHandleName, outputHandleName, portOffsetPercentages, nestedOutputHandleName } from '../../../NodeUtils';
import { NODE_HEIGHT, NODE_WIDTH } from '../../../Config';

const nestedHandleSpacing = 12

export const makeGroupedNode = ({ data, width, height }: NodeProps<GroupedNode>) => {
  const freeVarCount = data.freeVarPortIds.length;
  const parameterCount = data.parameterPortIds.length;

  const parameterHandles = []

  const parameterPortOffets = portOffsetPercentages(parameterCount);

  for (let i = 0; i < parameterCount; i++) {
    const parameterPortOffset = parameterPortOffets[i]!

    parameterHandles.push(
      <Handle
        type="source"
        position={Position.Top}
        id={parameterHandleName(parameterCount - i - 1)}
        key={i}
        style={{
          left: parameterPortOffset + '%',
          top: nestedHandleSpacing,
          // top: boundVarPortOffets[i] + '%',
        }}
      />
    );
  }

  // TODO: Free var handles

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
      {/* <Handle type="target" id={inputHandleName(0)} position={Position.Top} style={{ top: 5 }} /> */}
      <Handle type="source" id={nestedOutputHandleName(0)} position={Position.Bottom} style={{ bottom: nestedHandleSpacing }} />
      <Handle type="source" id={outputHandleName(0)} position={Position.Bottom} className='custom-handle' style={{ bottom: 0 }} />


      {parameterHandles}
      {/* <Handle type="source" id={boundVarHandleName(0)} position={Position.Left} style={{ bottom: 0 }} /> */}
    </div>
    );
}

export type Dimensions = {
  width: number;
  height: number;
}

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