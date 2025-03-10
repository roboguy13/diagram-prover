import { Term, hasAllIds } from '../../engine/Term';
import { AppNode, TermNode } from '../components/Nodes/nodeTypes';
import { NodesAndEdges } from './NodesAndEdges';

import * as dagre from 'dagre';

export function toUnlayouted(term: Term): NodesAndEdges {
  let g = { nodes: [], edges: [] }
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
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: term.name.name ?? ('?' + term.name.ix) },
        position: { x: 0, y: 0 },
      });
      break;

    case 'UnitTy':
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'UnitTy' },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Empty':
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'Empty' },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Type':
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'Type' },
        position: { x: 0, y: 0 },
      });
      break;

    case 'unit':
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'unit' },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Pi': {
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'Pi' },
        position: { x: 0, y: 0 },
      });
      // g.nodes.push({
      //   id: term.paramTy.id ?? 'paramTy',
      //   type: 'term',
      //   data: { label: 'paramTy' },
      //   position: { x: 0, y: 0 },
      // });

      // g.edges.push({ source: term.id ?? 'Pi', target: term.paramTy.id ?? 'paramTy', id: newEdgeId() });

      let bodyId = toUnlayoutedHelper(allIds, g, term.body);

      g.edges.push({ source: thisId, target: bodyId, id: newEdgeId() });
      break;
    }

    case 'Lam': {
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'Lam' },
        position: { x: 0, y: 0 },
      });
      // g.nodes.push({
      //   id: term.paramTy.id ?? 'paramTy',
      //   type: 'term',
      //   data: { label: 'paramTy' },
      //   position: { x: 0, y: 0 },
      // });

      // g.edges.push({ source: term.id ?? 'Lam', target: term.paramTy.id ?? 'paramTy', id: newEdgeId() });

      let bodyId = toUnlayoutedHelper(allIds, g, term.body);

      g.edges.push({ source: thisId, target: bodyId, id: newEdgeId() });
      break;
    }

    case 'App': {
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'App' },
        position: { x: 0, y: 0 },
      });

      let funcId = toUnlayoutedHelper(allIds, g, term.func);
      let argId = toUnlayoutedHelper(allIds, g, term.arg);

      g.edges.push({ source: thisId, target: funcId, id: newEdgeId() });
      g.edges.push({ source: thisId, target: argId, id: newEdgeId() });
      break;
    }

    case 'Ann': {
      g.nodes.push({
        id: thisId,
        type: 'term',
        data: { label: 'Ann' },
        position: { x: 0, y: 0 },
      });

      let termId = toUnlayoutedHelper(allIds, g, term.term);
      g.edges.push({ source: thisId, target: termId, id: newEdgeId() });

      let tyId = toUnlayoutedHelper(allIds, g, term.ty);
      g.edges.push({ source: thisId, target: tyId, id: newEdgeId() });
      break;
    }
  }

  return thisId
}