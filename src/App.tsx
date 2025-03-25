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
import { update } from './ui/architecture/Msg';
import { initialModel, Model } from './ui/architecture/Model';

import { topSortNodes } from './ui/render/layout/TopSort';
import { useElmish } from './ui/architecture/Elmish';
import { NodesAndEdges } from './ui/render/layout/LayoutEngine';
import { theLayoutEngine } from './ui/render/layout/LayoutEngineConfig';
import { debugConfictHandler } from './ui/render/layout/recursiveBox/DebugConflictHandler';

export interface Props {
  nodesAndEdges: NodesAndEdges;
}

export default function App() {
  // const [state, dispatch] = useReducer(update, initialModel);
  let [state, dispatch] = useElmish(initialModel)

  const reactFlowInstance = useReactFlow();

  let nodes = topSortNodes(state.graph?.nodes ?? new Map<string, AppNode>());
  let edges = state.graph?.edges ?? [];

  useEffect(() => {
    theLayoutEngine.addConflictHandler(net => conflict => {
      if (state.mode !== 'debug-propagators-mode')
        debugConfictHandler(dispatch)(net)(conflict)
      })
  }, [])

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

  // console.log("Rendering React Flow with nodes:", nodes, "and edges:", edges);

  const handleBetaStep = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'BetaStepMsg' }});
  }, [dispatch]);

  const handleStepBack = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'StepBackMsg' }});
  }, [dispatch]);

  const handleLayoutDebug = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'ToggleDebugPropagatorsMode' }});
  }, [dispatch]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if focus is on input elements
      if (
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        handleBetaStep();
      } else if (event.key === 'ArrowLeft') {
        handleStepBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  })


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
        {/* Button for rendering the propagator network as a graph to debug it */}
        <ControlButton onClick={handleLayoutDebug} >
          <MagicWandIcon />
        </ControlButton>

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
