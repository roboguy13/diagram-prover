import { useCallback, useReducer } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
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
  // const { nodesAndEdges } = props;
  // let initialEdges = nodesAndEdges.edges;
  // let initialNodes = nodesAndEdges.nodes;

  const [state, dispatch] = useReducer(update, initialModel);

  // const nodes: AppNode[] = Array.from(state.nodes.values());
  // const edges = state.edges;

  // const [nodes, , onNodesChange] = useNodesState(initialNodes);
  // const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  // const onConnect: OnConnect = useCallback(
  //   (connection) => setEdges((edges) => addEdge(connection, edges)),
  //   [setEdges]
  // );

  let nodes = Array.from(state.graph?.nodes.values() ?? []);
  let edges = state.graph?.edges ?? [];

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
        <ControlButton onClick={() => dispatch({ kind: 'EditorMsg', msg: { type: 'BetaStepMsg' }})}>
          <ChevronRightIcon />
        </ControlButton>

        <ControlButton onClick={() => dispatch({ kind: 'EditorMsg', msg: { type: 'StepBackMsg' }})}>
          <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
        </ControlButton>
      </Controls>
    </ReactFlow>
  );
}
