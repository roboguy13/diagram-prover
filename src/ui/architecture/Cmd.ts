import { NodesAndEdges } from '../render/layout/elk/ElkToReactFlow';

export type Cmd =
  | { kind: 'UpdateFlow', graphPromise: Promise<NodesAndEdges> }
