//
// This type mediates between the AST types and the layout engine (currently, ELK) graph types
//   AST -> SemanticGraph -> ELK graph -> ReactFlow graph
//

import { Edge } from "@xyflow/react";
import { Term, TermKind } from "../engine/Term";

export type SemanticNode<A> = {
  id: string;

  label?: string;

  payload: A

  kind: 'Transpose' // We represent the exponential transpose (currying/using a function as a value) as a nested subgraph
        | TermKind;

  subgraph?: SemanticNode<A>[];
  children: SemanticNode<A>[];
}

export function getEdges(n: SemanticNode<void>): Edge[] {
  return n.children.map((child, index) => ({
    id: `edge-${n.id}-${child.id}-${index}`,
    source: n.id,
    target: child.id,
  }));
}

export function termToSemanticNode(t: Term): SemanticNode<void> {
  switch (t.type) {
    case 'Var':
      return { id: t.id ? t.id : 'type', label: 'Type', kind: 'Type', children: [], payload: undefined };
    case 'UnitTy':
      return { id: t.id ? t.id : 'type', label: 'Type', kind: 'Type', children: [], payload: undefined };
    case 'Empty':
      return { id: t.id ? t.id : 'type', label: 'Type', kind: 'Type', children: [], payload: undefined };
    case 'Type':
      // TODO: Show universe in label
      return { id: t.id ? t.id : 'type', label: 'Type', kind: 'Type', children: [], payload: undefined };
    case 'unit':
      return { id: t.id ? t.id : 'unit', label: '()', kind: 'unit', children: [], payload: undefined };
    case 'Pi':
      return { id: t.id ? t.id : 'pi', label: 'Π', kind: 'Pi', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)], payload: undefined };
    case 'Lam':
      // TODO: Exponential transpose
      let lamNode: SemanticNode<void> = { id: t.id ? t.id : 'lam', label: 'λ', kind: 'Lam', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)], payload: undefined };
      let parentNode: SemanticNode<void> = { id: 'transpose-' + (t.id ? t.id : 'lam'), kind: 'Transpose', subgraph: [lamNode], children: [], payload: undefined };
      return parentNode
    case 'App':
      // TODO: Exponential transpose
      return { id: t.id ? t.id : 'app', label: '@', kind: 'App', children: [termToSemanticNode(t.func), termToSemanticNode(t.arg)], payload: undefined };
    case 'Ann':
      return { id: t.id ? t.id : 'ann', label: ':', kind: 'Ann', children: [termToSemanticNode(t.term), termToSemanticNode(t.ty)], payload: undefined };
  }
}
