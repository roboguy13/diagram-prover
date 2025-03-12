import { NodeProps, Position, Handle } from '@xyflow/react';
import { type TermNode } from '../nodeTypes';
import { inputHandleName, outputHandleName, portOffsetPercentages } from '../../../NodeUtils';

export function mkTermNode(
  { data, selected } : NodeProps<TermNode>) {
    let portOffsets = portOffsetPercentages(data.outputCount);

    // Make output Handles
    const outputHandles = [];
    for (let i = 0; i < data.outputCount; i++) {
      outputHandles.push(
        <Handle
          type="source"
          position={Position.Bottom}
          id={outputHandleName(i)}
          key={i}
          style={{
            left: portOffsets[i] + '%',
          }}
        />
      );
    }

    return (
      <div className={`term-node ${selected ? 'selected' : ''} ${data.isActiveRedex ? 'redex' : ''}`}>
      {data.label}
      <Handle type="target" id={inputHandleName(0)} position={Position.Top} style={{ top: 0 }} />
      {
        
      }
      {/* <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} /> */}
      {outputHandles}
      {/* <Handle
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
        }} */}
      {/* /> */}
    </div>);
}
