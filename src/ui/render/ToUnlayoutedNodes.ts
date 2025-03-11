import { Term, hasAllIds } from '../../engine/Term';
import { AppNode, TermNode } from '../components/Nodes/nodeTypes';
import { NodesAndEdges } from './NodesAndEdges';
import { outputHandleName } from '../NodeUtils';
import { getNextChangedId, Model } from '../Model';

import * as dagre from 'dagre';
import { prettyPrintTerm } from '../../engine/PrettyPrint';

export function toUnlayouted(model: Model, term: Term): NodesAndEdges {
  let g = { nodes: new Map(), edges: [] }
  toUnlayoutedHelper(model, hasAllIds(term), g, term);
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

function toUnlayoutedHelper(model: Model, allIds: boolean, g: NodesAndEdges, term: Term): string {
  let thisId = getTermId(allIds, term);

  let nextChangedId = getNextChangedId(model);
  let isActiveRedex = term.id === nextChangedId;

  switch (term.type) {
    case 'Var':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: term.name.name ?? ('?' + term.name.ix), outputCount: 0, isActiveRedex },
        position: { x: 0, y: 0 },
      });
      break;

    case 'UnitTy':
      g.nodes.set(thisId,{
        id: thisId,
        type: 'term',
        data: { label: 'Unit', outputCount: 0, isActiveRedex },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Empty':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Empty', outputCount: 0, isActiveRedex },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Type':
      // TODO: Show universe level

      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Type', outputCount: 0, isActiveRedex },
        position: { x: 0, y: 0 },
      });
      break;

    case 'unit':
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: '()', outputCount: 0, isActiveRedex },
        position: { x: 0, y: 0 },
      });
      break;

    case 'Pi': {
      let label = 'Π';

      if (term.paramName) {
        label += ' ' + term.paramName;
      }

      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label, outputCount: 2, isActiveRedex },
        position: { x: 0, y: 0 },
      });

      let paramTy = toUnlayoutedHelper(model, allIds, g, term.paramTy);
      let bodyId = toUnlayoutedHelper(model, allIds, g, term.body);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: paramTy, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: bodyId, id: newEdgeId() });
      break;
    }

    case 'Lam': {
      let label = 'λ';

      if (term.paramName) {
        label += ' ' + term.paramName;
      }

      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label, outputCount: 2, isActiveRedex },
        position: { x: 0, y: 0 },
      });

      let paramTy = toUnlayoutedHelper(model, allIds, g, term.paramTy);
      let bodyId = toUnlayoutedHelper(model, allIds, g, term.body);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: paramTy, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: bodyId, id: newEdgeId() });
      break;
    }

    case 'App': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: '@', outputCount: 2, isActiveRedex },
        position: { x: 0, y: 0 },
      });

      let funcId = toUnlayoutedHelper(model, allIds, g, term.func);
      let argId = toUnlayoutedHelper(model, allIds, g, term.arg);

      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: funcId, id: newEdgeId() });
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: argId, id: newEdgeId() });
      break;
    }

    case 'Ann': {
      g.nodes.set(thisId, {
        id: thisId,
        type: 'term',
        data: { label: 'Ann', outputCount: 2, isActiveRedex },
        position: { x: 0, y: 0 },
      });

      let termId = toUnlayoutedHelper(model, allIds, g, term.term);
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(0), target: termId, id: newEdgeId() });

      let tyId = toUnlayoutedHelper(model, allIds, g, term.ty);
      g.edges.push({ source: thisId, sourceHandle: outputHandleName(1), target: tyId, id: newEdgeId() });
      break;
    }
  }

  return thisId
}