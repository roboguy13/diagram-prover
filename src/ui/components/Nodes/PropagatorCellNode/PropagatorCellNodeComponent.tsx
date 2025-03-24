import { Handle, NodeProps, Position, } from '@xyflow/react';
import { PropagatorCellNode, } from '../nodeTypes';

export function mkPropagatorCellNode(
  { data, selected } : NodeProps<PropagatorCellNode>) {
    return (
      <div className={`propagator-cell-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
      </div>);
}
