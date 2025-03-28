import React, { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import './PanelPortBarComponent.css';

interface PanelPortBarProps {
  id: string;
  label: string;
  portCount: number;
  isInput: boolean;
}

export const PanelPortBar: React.FC<PanelPortBarProps> = ({ id, label, portCount, isInput }) => {
  const { getNode, addNodes, setNodes } = useReactFlow();
  
  // Add the actual node to React Flow on mount
  useEffect(() => {
    // Check if node already exists
    const existingNode = getNode(id);
    
    if (!existingNode) {
      // Add the node to React Flow - this creates the proper node context
      addNodes({
        id,
        type: 'port-bar',
        position: { x: 0, y: -1000 }, // Position off-screen
        data: { label, portCount, isInput },
        hidden: false, // Not hidden so handles work, just off-screen
      });
    }
    
    // Clean up on unmount
    return () => {
      setNodes(nodes => nodes.filter(node => node.id !== id));
    };
  }, [id, label, portCount, isInput, addNodes, getNode, setNodes]);
  
  // The Panel just shows a visual representation
  // The actual node with handles exists in the React Flow graph
  return (
    <div className={`panel-port-bar ${isInput ? 'input-bar' : 'output-bar'}`}>
      <div className="port-bar-label">{label}</div>
      <div className="port-handles">
        {Array.from({ length: portCount }).map((_, index) => (
          <div key={index} className="panel-port">
            <div className="port-handle" />
            <div className="port-label">{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};