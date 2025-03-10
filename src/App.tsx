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

  // This effect runs when the AST changes
  useEffect(() => {
    if (state.updateCenter) {
      // Use a small timeout to ensure the graph is rendered before fitting
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false }); }, 1);

      dispatch({ kind: 'EditorMsg', msg: { type: 'ResetUpdateCenter' } });
    }
  }, [state.updateCenter, reactFlowInstance.fitView]);

  // if (state.updateCenter) {
  //   // const { x, y, zoom } = reactFlowInstance.getViewport();
  //   // reactFlowInstance.setCenter(x, y, { zoom });
  //   reactFlowInstance.fitView();
  //   dispatch({ kind: 'EditorMsg', msg: { type: 'ResetUpdateCenter' } });
  // }

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
