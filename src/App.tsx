import { useCallback, useReducer } from 'react';
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
    const { x, y, zoom } = reactFlowInstance.getViewport();
    dispatch({ kind: 'EditorMsg', msg: { type: 'BetaStepMsg' }});
    reactFlowInstance.setCenter(x, y, { zoom });
  }

  let handleStepBack = () => {
    const { x, y, zoom } = reactFlowInstance.getViewport();
    dispatch({ kind: 'EditorMsg', msg: { type: 'StepBackMsg' }});
    reactFlowInstance.setCenter(x, y, { zoom });
    // reactFlowInstance.fitView();
  }

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
