import { NodesAndEdges } from '../render/layout/LayoutEngine'

export type Cmd =
  | { kind: 'UpdateFlow', graphPromise: Promise<NodesAndEdges> }
