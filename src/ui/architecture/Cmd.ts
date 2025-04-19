import { NodeListAndEdges, NodesAndEdges } from '../render/layout/LayoutEngine'

export type Cmd =
  | { kind: 'UpdateFlow', graphPromise: Promise<NodeListAndEdges> }
