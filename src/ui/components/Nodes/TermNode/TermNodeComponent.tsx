import { NodeProps, Position, Handle } from '@xyflow/react';
import { portOffsetPercentages } from '../../../NodeUtils';
import { TermNode } from '../nodeTypes';

export function mkTermNode(
    { data, selected }: NodeProps<TermNode>) {

    let outputPortOffsets = portOffsetPercentages(data.outputPortIds.length);
    let inputPortOffsets = portOffsetPercentages(data.inputPortIds.length);

    const outputHandles = data.outputPortIds.map((portId, index) => (
        <Handle
            type="source" 
            position={Position.Bottom}
            id={portId}
            key={portId}
            style={{
                left: outputPortOffsets[index] + '%',
            }}
        />
    ));

    const inputHandles = data.inputPortIds.map((portId, index) => (
        <Handle
            type="target"
            position={Position.Top}
            id={portId}
            key={portId}
            style={{
                left: inputPortOffsets[index] + '%',
            }}
        />
    ));

    return (
        <div
            className={`term-node ${selected ? 'selected' : ''} ${data.isActiveRedex ? 'redex' : ''}`}
            style={{ width: data.width, height: data.height, }}
        >
            {data.label}
            {inputHandles}
            {outputHandles}
        </div>
    );
}
