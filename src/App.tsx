import { useRef, useEffect, useCallback, useReducer } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  type OnConnect,
  useReactFlow,
} from '@xyflow/react';

import { ChevronRightIcon, MagicWandIcon } from '@radix-ui/react-icons'

import '@xyflow/react/dist/style.css';

import { nodeTypes } from './ui/components/Nodes';
import { edgeTypes } from './edges';
import { AppNode } from './ui/components/Nodes/nodeTypes';
import { update } from './ui/Msg';
import { initialModel, Model } from './ui/Model';

import { NodesAndEdges } from './ui/render/NodesAndEdges';

export interface Props {
  nodesAndEdges: NodesAndEdges;
}

export default function App() {
  const [state, dispatch] = useReducer(update, initialModel);
  const reactFlowInstance = useReactFlow();

  let nodes = Array.from(state.graph?.nodes.values() ?? []);
  let edges = state.graph?.edges ?? [];

  let handleBetaStep = () => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'BetaStepMsg', reactFlowInstance }});
  }

  let handleStepBack = () => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'StepBackMsg', reactFlowInstance }});
  }

  // Fixed implementation
useEffect(() => {
  if (state.updateCenter && reactFlowInstance) {
    // Two key issues with the original code:
    // 1. reactFlowInstance.fitView might not be stable across renders
    // 2. We need to ensure the DOM has fully updated

    // Add a small delay to ensure DOM updates are complete
    const timeoutId = setTimeout(() => {
      // Try-catch to handle potential errors
      try {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 300,
          includeHiddenNodes: false
        });
      } catch (error) {
        console.error("Error centering graph:", error);
      }
      
      // Reset the flag after centering
      dispatch({ kind: 'EditorMsg', msg: { type: 'ResetUpdateCenter' } });
    }, 50);
    
    // Clean up timeout if component unmounts or effect runs again
    return () => clearTimeout(timeoutId);
  }
}, [state.updateCenter]); // Only depend on the updateCenter flag

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'NodeChangeMsg', changes: changes}})}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'EdgeChangeMsg', changes: changes}})}
      onConnect={(connection) => {}}
      fitView
    >
      <Background />
      <MiniMap />
      <Controls>
        <ControlButton onClick={handleBetaStep}>
          <ChevronRightIcon />
        </ControlButton>

        <ControlButton onClick={handleStepBack}>
          <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
        </ControlButton>
      </Controls>
    </ReactFlow>
  );
}
