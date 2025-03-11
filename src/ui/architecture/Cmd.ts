import { NodesAndEdges } from '../render/NodesAndEdges';

export type Cmd =
  | { kind: 'UpdateFlow', graphPromise: Promise<NodesAndEdges> }
