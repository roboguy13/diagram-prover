import { Handle, Position } from '@xyflow/react';
import React from 'react';
import { PortBarNode } from '../nodeTypes';
import { NodeProps } from '@xyflow/react';

export const PortBarComponent: React.FC<NodeProps<PortBarNode>> = (props) => {
  const { id, data, selected } = props;
  const { portCount, isInput, label } = data;
  
  return (
    <div className={`port-bar ${isInput ? 'input-bar' : 'output-bar'} ${selected ? 'selected' : ''}`}>
      {label && isInput && <div className="port-bar-label">{label}</div>}
      <div className="port-handles">
        {Array.from({ length: portCount }).map((_, index) => {
          const portId = `port-${index}`;

          return (
            <div key={index} className="port-slot">
              <Handle
                id={portId}
                type={isInput ? 'source' : 'target'}
                position={isInput ? Position.Bottom : Position.Top}
                isConnectable={true}
              />
            </div>
          );
        })}
      </div>
      {label && !isInput && <div className="port-bar-label">{label}</div>}
    </div>
  );
};
