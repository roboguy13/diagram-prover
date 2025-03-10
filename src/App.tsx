import { useCallback, useReducer } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { nodeTypes } from './ui/components/Nodes';
import { edgeTypes } from './edges';
import { AppNode } from './ui/components/Nodes/nodeTypes';
import { update } from './ui/Msg';
import { initialModel, makeInitialModel, Model } from './ui/Model';

import { NodesAndEdges } from './ui/render/NodesAndEdges';

export interface Props {
  nodesAndEdges: NodesAndEdges;
}

export default function App(props: Props) {
  const { nodesAndEdges } = props;
  let initialEdges = nodesAndEdges.edges;
  let initialNodes = nodesAndEdges.nodes;

  const [state, dispatch] = useReducer(update, makeInitialModel(initialNodes, initialEdges));

  // const nodes: AppNode[] = Array.from(state.nodes.values());
  // const edges = state.edges;

  // const [nodes, , onNodesChange] = useNodesState(initialNodes);
  // const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  // const onConnect: OnConnect = useCallback(
  //   (connection) => setEdges((edges) => addEdge(connection, edges)),
  //   [setEdges]
  // );

  return (
    <ReactFlow
      nodes={Array.from(state.nodes.values())}
      nodeTypes={nodeTypes}
      onNodesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'NodeChangeMsg', changes: changes}})}
      edges={state.edges}
      edgeTypes={edgeTypes}
      onEdgesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'EdgeChangeMsg', changes: changes}})}
      onConnect={(connection) => {}}
      fitView
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
