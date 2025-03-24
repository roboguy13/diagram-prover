import type { Position, Node, Edge, BuiltInNode } from '@xyflow/react';

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>;
export type TermNode = Node<
  { label: string,
    isActiveRedex: boolean,
    outputCount: number,
    inputCount: number,
  },
  'term'>;
export type GroupedNode = Node<
  { label: string,
    // nodeIds: string[],
    // x: number,
    // y: number,
    // width: number,
    // height: number,
    // onSubdiagramChange?: (updatedDiagram: { nodes: Node[]; edges: Edge[] }) => void
  },
  'grouped'>;

export type PropagatorNode = Node<{ label: string }, 'propagator'>;
export type PropagatorCellNode = Node<{ label: string }, 'propagator-cell'>;

// export type GroupNode = Node<{ label: string }, 'group'>;

export type AppNode = BuiltInNode | TermNode | PositionLoggerNode | GroupedNode | PropagatorNode | PropagatorCellNode;
