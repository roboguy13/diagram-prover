//
// This type mediates between the AST types and the layout engine (currently, ELK) graph types
//   AST -> SemanticGraph -> ELK graph -> ReactFlow graph
//

import { Term, TermKind } from "../engine/Term";

export type SemanticNode = {
  id: string;

  label?: string;

  kind: 'Transpose' // We represent the exponential transpose (currying/using a function as a value) as a nested subgraph
        | TermKind;

  subgraph?: SemanticNode[];
  children: SemanticNode[];
}

export function termToSemanticNode(t: Term): SemanticNode {
  switch (t.type) {
    case 'Var':
      return { id: t.id ? t.id : 'var', label: 'Var', kind: 'Var', children: [] };
    case 'UnitTy':
      return { id: t.id ? t.id : 'unitTy', label: 'UnitTy', kind: 'UnitTy', children: [] };
    case 'Empty':
      return { id: t.id ? t.id : 'empty', label: 'Empty', kind: 'Empty', children: [] };
    case 'Type':
      // TODO: Show universe in label
      return { id: t.id ? t.id : 'type', label: 'Type', kind: 'Type', children: [] };
    case 'unit':
      return { id: t.id ? t.id : 'unit', label: '()', kind: 'unit', children: [] };
    case 'Pi':
      return { id: t.id ? t.id : 'pi', label: 'Π', kind: 'Pi', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)] };
    case 'Lam':
      // TODO: Exponential transpose
      let lamNode: SemanticNode = { id: t.id ? t.id : 'lam', label: 'λ', kind: 'Lam', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)] }
      let parentNode: SemanticNode = { id: 'transpose-' + (t.id ? t.id : 'lam'), kind: 'Transpose', subgraph: [lamNode], children: [] };
      return parentNode
    case 'App':
      // TODO: Exponential transpose
      return { id: t.id ? t.id : 'app', label: '@', kind: 'App', children: [termToSemanticNode(t.func), termToSemanticNode(t.arg)] };
    case 'Ann':
      return { id: t.id ? t.id : 'ann', label: 'Ann', kind: 'Ann', children: [termToSemanticNode(t.term), termToSemanticNode(t.ty)] };
  }
}
