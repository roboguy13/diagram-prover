import { Term, hasAllIds } from '../../engine/Term';
import { AppNode, TermNode } from '../components/Nodes/nodeTypes';
import { NodesAndEdges } from './NodesAndEdges';
import { outputHandleName } from '../NodeUtils';

import * as dagre from 'dagre';

export function toUnlayouted(term: Term): NodesAndEdges {
  let g = { nodes: new Map(), edges: [] }
  toUnlayoutedHelper(hasAllIds(term), g, term);
  return g
}

let edgeId = 0
let nodeId = 0

function newEdgeId(): string {
  edgeId += 1;
  return 'edge' + edgeId;
}

function getTermId(allIds: boolean, term: Term): string {
  if (allIds) {
    return term.id ?? '';
  } else {
    nodeId += 1;
    return 'node' + nodeId;
  }
}

function toUnlayoutedHelper(allIds: boolean, g: NodesAndEdges, term: Term): string {
  let thisId = getTermId(allIds, term);

  switch (term.type) {
    case 'Var':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: term.name.name ?? ('?' + term.name.ix), outputCount: 0 },
        position: { x: 0, y: 0 },
      });
      break;

    case 'UnitTy':
      g.nodes.set(thisId,{
        id: thisId,
        type: 'term',
        data: { label: 'Unit', outputCount: 0 },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Empty':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Empty', outputCount: 0 },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Type':
      // TODO: Show universe level

      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Type', outputCount: 0 },
        position: { x: 0, y: 0 },
      });
      break;

    case 'unit':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: '()', outputCount: 0 },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Pi': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Π', outputCount: 2 },
        position: { x: 0, y: 0 },
      });

      let paramTy = toUnlayoutedHelper(allIds, g, term.paramTy);
      let bodyId = toUnlayoutedHelper(allIds, g, term.body);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: paramTy, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: bodyId, id: newEdgeId() });
      break;
    }

    case 'Lam': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'λ', outputCount: 2 },
        position: { x: 0, y: 0 },
      });

      let paramTy = toUnlayoutedHelper(allIds, g, term.paramTy);
      let bodyId = toUnlayoutedHelper(allIds, g, term.body);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: paramTy, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: bodyId, id: newEdgeId() });
      break;
    }

    case 'App': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: '@', outputCount: 2 },
        position: { x: 0, y: 0 },
      });

      let funcId = toUnlayoutedHelper(allIds, g, term.func);
      let argId = toUnlayoutedHelper(allIds, g, term.arg);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: funcId, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: argId, id: newEdgeId() });
      break;
    }

    case 'Ann': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Ann', outputCount: 2 },
        position: { x: 0, y: 0 },
      });

      let termId = toUnlayoutedHelper(allIds, g, term.term);
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: termId, id: newEdgeId() });

      let tyId = toUnlayoutedHelper(allIds, g, term.ty);
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: tyId, id: newEdgeId() });
      break;
    }
  }

  return thisId
}