import type { Edge, EdgeTypes, MarkerType } from '@xyflow/react';
import { FloatingEdge } from '../ui/components/Edges/FloatingEdge';

export const initialEdges: Edge[] = [
  { id: 'a->c', source: 'a', target: 'c', animated: true },
  { id: 'b->d', source: 'b', target: 'd' },
  { id: 'c->d', source: 'c', target: 'd', animated: true },
];

export const edgeTypes = {
  'floating': FloatingEdge
} satisfies EdgeTypes;
