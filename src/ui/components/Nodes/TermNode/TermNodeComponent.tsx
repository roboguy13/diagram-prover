// src/ui/components/Nodes/TermNode/TermNodeComponent.tsx
import { NodeProps, Position, Handle } from '@xyflow/react';
// Assuming your nodeTypes includes the port ID arrays now
import { portOffsetPercentages } from '../../../NodeUtils'; // Keep using this for positioning
import { TermNode } from '../nodeTypes';

export function mkTermNode(
    { data, selected }: NodeProps<TermNode>) {

    // Calculate offsets based on the *actual* number of ports
    let outputPortOffsets = portOffsetPercentages(data.outputPortIds.length);
    let inputPortOffsets = portOffsetPercentages(data.inputPortIds.length);

    // Create Output Handles (Bottom) - Corrected Type and ID
    const outputHandles = data.outputPortIds.map((portId, index) => (
        <Handle
            type="source" // *** CORRECTED TYPE ***
            position={Position.Bottom}
            id={portId} // *** USE ACTUAL PORT ID ***
            key={portId} // Use portId as key
            style={{
                left: outputPortOffsets[index] + '%',
            }}
        />
    ));

    // Create Input Handles (Top) - Corrected Type and ID
    const inputHandles = data.inputPortIds.map((portId, index) => (
        <Handle
            type="target" // *** CORRECTED TYPE ***
            position={Position.Top}
            id={portId} // *** USE ACTUAL PORT ID ***
            key={portId} // Use portId as key
            style={{
                left: inputPortOffsets[index] + '%',
            }}
        />
    ));

    const portBarType = data.portBarType

    return (
        <div
            className={`term-node ${selected ? 'selected' : ''} ${data.isActiveRedex ? 'redex' : ''}`}
            style={{ width: data.width, height: data.height, }}
        >
            {data.label}
            {/* Render the handles */}
            {inputHandles}
            {outputHandles}
        </div>
    );
}
// import { NodeProps, Position, Handle } from '@xyflow/react';
// import { type TermNode } from '../nodeTypes';
// import { inputHandleName, outputHandleName, portOffsetPercentages } from '../../../NodeUtils';

// export function mkTermNode(
//   { data, selected } : NodeProps<TermNode>) {
//     let outputPortOffets = portOffsetPercentages(data.outputCount);
//     let inputPortOffets = portOffsetPercentages(data.inputCount);

//     // Make Handles

//     const outputHandles = [];
//     for (let i = 0; i < data.outputCount; i++) {
//       outputHandles.push(
//         <Handle
//           type="target"
//           position={Position.Bottom}
//           id={outputHandleName(i)}
//           key={i}
//           style={{
//             left: outputPortOffets[i] + '%',
//           }}
//         />
//       );
//     }

//     const inputHandles = [];
//     for (let i = 0; i < data.inputCount; i++) {
//       inputHandles.push(
//         <Handle
//           type="source"
//           position={Position.Top}
//           id={inputHandleName(i)}
//           key={i}
//           style={{
//             left: inputPortOffets[i] + '%',
//           }}
//           />
//       );
//     }

//     return (
//       <div
//         className={`term-node ${selected ? 'selected' : ''} ${data.isActiveRedex ? 'redex' : ''}`}
//         style={{width: data.width, height: data.height,}}
//         >
//       {data.label}
//       {inputHandles}
//       {
        
//       }
//       {/* <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} /> */}
//       {outputHandles}
//       {/* <Handle
//         type="source"
//         position={Position.Bottom}
//         id="bottom-1"
//         style={{ left: outputPortOffets[0] + '%', bottom: 0 }}
//       />
//       <Handle
//         type="source"
//         position={Position.Bottom}
//         id="bottom-2"
//         // style={{ left: '75%', bottom: 0 }}
//         style={{
//           left: outputPortOffets[1] + '%',
//           bottom: 0,
//           background: 'orange',
//           width: '4px',
//           height: '4px',
//           borderRadius: '0',
//           border: '0.5px solid black',
//           boxShadow: '0 0 6px rgba(0, 0, 0, 0.3)'
//         }} */}
//       {/* /> */}
//     </div>);
// }
