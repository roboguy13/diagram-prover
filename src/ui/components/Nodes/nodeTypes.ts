import type { Position, Node, Edge, BuiltInNode } from '@xyflow/react'

export type TermNodeData =
  { label: string,
    isActiveRedex: boolean,
    outputCount: number,
    inputCount: number,
    inputPortIds: string[],
    outputPortIds: string[],
    width?: number,
    height?: number,
    portBarType?: PortBarType
  }

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>
export type TermNode = Node<
  TermNodeData,
  'term'>
export type GroupedNode = Node<
  { label: string,
    parameterCount: number,
    inputCount: number,
    width?: number,
    height?: number,
    // nodeIds: string[],
    // x: number,
    // y: number,
    // width: number,
    // height: number,
    // onSubdiagramChange?: (updatedDiagram: { nodes: Node[]; edges: Edge[] }) => void
  },
  'grouped'>

export type PortBarType = 'parameter-bar' | 'result-bar'

export type PropagatorNode = Node<{ label: string }, 'propagator'>
export type PropagatorCellNode = Node<{ label: string }, 'propagator-cell'>

export type PortBarNode = Node<{ label: string, portCount: number, isInput: boolean }, 'port-bar'>

export type PinnedPortBarNode = Node<{ label: string, portCount: number, isInput: boolean }, 'pinned-port-bar'>

// export type GroupNode = Node<{ label: string }, 'group'>

export type ApplicationNode = BuiltInNode | TermNode | PositionLoggerNode | GroupedNode | PropagatorNode | PropagatorCellNode | PortBarNode | PinnedPortBarNode
