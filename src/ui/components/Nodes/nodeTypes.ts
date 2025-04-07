import type { Position, Node, Edge, BuiltInNode } from '@xyflow/react'

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>
export type TermNode = Node<
  { label: string,
    isActiveRedex: boolean,
    outputCount: number,
    inputCount: number,
    width?: number,
    height?: number,
  },
  'term'>
export type GroupedNode = Node<
  { label: string,
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

export type PropagatorNode = Node<{ label: string }, 'propagator'>
export type PropagatorCellNode = Node<{ label: string }, 'propagator-cell'>

export type PortBarNode = Node<{ label: string, portCount: number, isInput: boolean }, 'port-bar'>

export type PinnedPortBarNode = Node<{ label: string, portCount: number, isInput: boolean }, 'pinned-port-bar'>

// export type GroupNode = Node<{ label: string }, 'group'>

export type ApplicationNode = BuiltInNode | TermNode | PositionLoggerNode | GroupedNode | PropagatorNode | PropagatorCellNode | PortBarNode | PinnedPortBarNode
