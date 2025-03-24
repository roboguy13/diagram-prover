import { Handle, NodeProps, Position, } from '@xyflow/react';
import { PropagatorNode, } from '../nodeTypes';

export function mkPropagatorNode(
  { data, selected } : NodeProps<PropagatorNode>) {
    return (
      <div className={`propagator-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
      </div>);
}
