import { NodeProps, Position, Handle } from '@xyflow/react';
import { type TermNode } from '../nodeTypes';
import { portOffsetPercentages } from '../../../NodeUtils';

export function TermNode(
  { data, selected } : NodeProps<TermNode>) {
    let portOffsets = portOffsetPercentages(2);

    return (
      <div className={`term-node ${selected ? 'selected' : ''}`}>
      {data.label}
      <Handle type="target" position={Position.Top} style={{ top: 0 }} />
      {/* <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} /> */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-1"
        style={{ left: portOffsets[0] + '%', bottom: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-2"
        // style={{ left: '75%', bottom: 0 }}
        style={{
          left: portOffsets[1] + '%',
          bottom: 0,
          background: 'orange',
          width: '4px',
          height: '4px',
          borderRadius: '0',
          border: '0.5px solid black',
          boxShadow: '0 0 6px rgba(0, 0, 0, 0.3)'
        }}
      />
    </div>);
}
