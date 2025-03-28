import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { PortBarNode } from '../nodeTypes';

export const PinnedPortBarNode: React.FC<NodeProps<PortBarNode>> = ({ data }) => {
  const { portCount, isInput, label } = data;

  const pinnedStyle: React.CSSProperties = {
    position: 'absolute',
    top: isInput ? 20 : '80%',
    left: '50%',
    transform: 'translateX(-50%)', // no transform inversion
    background: '#333',
    padding: 10,
    borderRadius: 4,
    zIndex: 9999 // ensure visibility
  };

  return (
    <div style={pinnedStyle}>
      <div style={{ color: '#fff', marginBottom: 8 }}>{label}</div>
      {Array.from({ length: portCount }).map((_, i) => (
        <Handle
          key={i}
          id={`port-${i}`}
          type={isInput ? 'target' : 'source'}
          position={isInput ? Position.Top : Position.Bottom}
          style={{ background: '#555', width: 10, height: 10 }}
          isConnectable={true}
        />
      ))}
    </div>
  );
};

// export const PinnedPortBarNode: React.FC<NodeProps<PortBarNode>> = ({ data }) => {
//   // Get the current viewport's transform so we can visually "undo" it
//   const instance = useReactFlow();
//   const { viewport: { x, y } } = instance.toObject();
//   const zoom = instance.getZoom();
//   const [tx, ty, scale] = [x, y, zoom];

//   const { portCount, isInput, label } = data;

//   // Position your pinned bar at top/bottom in absolute screen coordinates
//   // For example, top bar pinned at y=20; bottom bar pinned at y=80% of screen, etc.
//   // Adjust left/top as needed.
//   const pinnedStyle: React.CSSProperties = {
//     position: 'absolute',
//     // This is your fixed position in the window
//     top: isInput ? 20 : window.innerHeight - 80,
//     left: '50%',
//     // "Undo" the flow transform so it never moves
//     transform: `translateX(-50%) scale(${1 / scale}) translate(${-tx}px, ${-ty}px)`,
//     background: '#333',
//     padding: 10,
//     borderRadius: 4
//   };

//   return (
//     <div style={pinnedStyle}>
//       <div style={{ color: '#fff', marginBottom: 8 }}>{label}</div>
//       <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
//         {Array.from({ length: portCount }).map((_, index) => {
//           const portId = `port-${index}`;
//           return (
//             <Handle
//               key={index}
//               id={portId}
//               type={isInput ? 'target' : 'source'}
//               position={isInput ? Position.Top : Position.Bottom}
//               style={{
//                 background: '#555',
//                 width: 10,
//                 height: 10,
//               }}
//               isConnectable={true}
//             />
//           );
//         })}
//       </div>
//     </div>
//   );
// };
