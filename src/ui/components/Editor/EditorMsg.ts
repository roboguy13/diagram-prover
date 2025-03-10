import { NodeChange, EdgeChange } from '@xyflow/react';

export type EditorMsg =
  | { type: 'ConnectMsg', source: string, target: string }
  | { type: 'SelectMsg', selected: string[] }
  | { type: 'NodeChangeMsg', changes: NodeChange[] }
  | { type: 'EdgeChangeMsg', changes: EdgeChange[] }
  | { type: 'BetaStepMsg' }
  | { type: 'StepBackMsg' }
