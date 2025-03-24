import type { NodeTypes } from '@xyflow/react';

// import { PositionLoggerNode } from './PositionLoggerNode';
import { mkTermNode } from './TermNode/TermNodeComponent';
// import { Subdiagram } from './Subdiagram';
import { AppNode, type GroupedNode } from './nodeTypes';
import { makeGroupedNode } from './GroupedNode/GroupedNodeComponent';
import { Model } from '../../architecture/Model';
import { mkPropagatorNode } from './PropagatorNode/PropagatorNodeComponent';
import { mkPropagatorCellNode } from './PropagatorCellNode/PropagatorCellNodeComponent';

export const wireYourIdeas = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'wire' }, parentId: 'group-1', extent: 'parent' },
  { id: 'c', position: { x: 100, y: 100 }, data: { label: 'your ideas' }, parentId: 'group-1', extent: 'parent' },
]

export const initialNodes: AppNode[] = [
  // { id: 'group-1', type: 'grouped-node', position: { x: 0, y: 0 }, data: { label: 'Group 1', nodeIds: ['a', 'c'] } },

  // { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'wire' }, parentId: 'group-1', extent: 'parent' },
  // { id: 'c', position: { x: 100, y: 100 }, data: { label: 'your ideas' }, parentId: 'group-1', extent: 'parent' },

  // {
  //   id: 'b',
  //   type: 'term',
  //   position: { x: -100, y: 100 },
  //   data: { label: 'drag me!' },
  // },
  // { id: 'e', position: { x: 200, y: 100 }, style: { width: 200, height: 200 }, type: 'subdiagram', data:
  //   {
  //     label: 'subdiagram',
  //     nodes: wireYourIdeas,
  //     edges: [
  //       // { id: 'h', source: 'f', target: 'g' },
  //     ],
  //   }
  // },
  {
    id: 'd',
    type: 'output',
    position: { x: 0, y: 200 },
    data: { label: 'with React Flow' },
  },
];

export const nodeTypes = {
  'term': mkTermNode,
  // 'subdiagram': Subdiagram,
  'grouped': makeGroupedNode,
  'propagator': mkPropagatorNode,
  'propagator-cell': mkPropagatorCellNode,
} satisfies NodeTypes;
