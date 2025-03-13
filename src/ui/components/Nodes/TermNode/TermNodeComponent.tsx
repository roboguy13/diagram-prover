import { NodeProps, Position, Handle } from '@xyflow/react';
import { type TermNode } from '../nodeTypes';
import { inputHandleName, outputHandleName, portOffsetPercentages } from '../../../NodeUtils';

export function mkTermNode(
  { data, selected } : NodeProps<TermNode>) {
    let outputPortOffets = portOffsetPercentages(data.outputCount);
    let inputPortOffets = portOffsetPercentages(data.inputCount);

    // Make Handles

    const outputHandles = [];
    for (let i = 0; i < data.outputCount; i++) {
      outputHandles.push(
        <Handle
          type="target"
          position={Position.Top}
          id={outputHandleName(i)}
          key={i}
          style={{
            left: outputPortOffets[i] + '%',
          }}
        />
      );
    }

    const inputHandles = [];
    for (let i = 0; i < data.inputCount; i++) {
      inputHandles.push(
        <Handle
          type="source"
          position={Position.Bottom}
          id={inputHandleName(i)}
          key={i}
          style={{
            left: inputPortOffets[i] + '%',
          }}
          />
      );
    }

    return (
      <div className={`term-node ${selected ? 'selected' : ''} ${data.isActiveRedex ? 'redex' : ''}`}>
      {data.label}
      {inputHandles}
      {
        
      }
      {/* <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} /> */}
      {outputHandles}
      {/* <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-1"
        style={{ left: outputPortOffets[0] + '%', bottom: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-2"
        // style={{ left: '75%', bottom: 0 }}
        style={{
          left: outputPortOffets[1] + '%',
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
