import { NodeChange, EdgeChange } from '@xyflow/react';
import { ReactFlowInstance } from '@xyflow/react';
import { NodesAndEdges } from '../../render/layout/elk/ElkToReactFlow';

export type EditorMsg =
  | { type: 'ConnectMsg', source: string, target: string }
  | { type: 'SelectMsg', selected: string[] }
  | { type: 'NodeChangeMsg', changes: NodeChange[] }
  | { type: 'EdgeChangeMsg', changes: EdgeChange[] }
  | { type: 'GraphLayoutReady', graph: NodesAndEdges }
  | { type: 'BetaStepMsg' }
  | { type: 'StepBackMsg' }
  | { type: 'ResetUpdateCenter' }
