import { NodeChange, EdgeChange } from '@xyflow/react';
import { ReactFlowInstance } from '@xyflow/react';

export type EditorMsg =
  | { type: 'ConnectMsg', source: string, target: string }
  | { type: 'SelectMsg', selected: string[] }
  | { type: 'NodeChangeMsg', changes: NodeChange[] }
  | { type: 'EdgeChangeMsg', changes: EdgeChange[] }
  | { type: 'BetaStepMsg', reactFlowInstance: ReactFlowInstance }
  | { type: 'StepBackMsg', reactFlowInstance: ReactFlowInstance }
  | { type: 'ResetUpdateCenter' }
