//
// This type mediates between the AST types and the layout engine (currently, ELK) graph types
//   AST -> SemanticGraph -> ELK graph -> ReactFlow graph
//

import { Term, TermKind } from "../engine/Term";

export type SemanticNode = {
  id: string;
  kind: TermKind;
  subgraph?: SemanticNode[];
  children: SemanticNode[];
}

export function termToSemanticNode(t: Term): SemanticNode {
  switch (t.type) {
    case 'Var':
      return { id: t.id ? t.id : 'var', kind: 'Var', children: [] };
    case 'UnitTy':
      return { id: t.id ? t.id : 'unitTy', kind: 'UnitTy', children: [] };
    case 'Empty':
      return { id: t.id ? t.id : 'empty', kind: 'Empty', children: [] };
    case 'Type':
      return { id: t.id ? t.id : 'type', kind: 'Type', children: [] };
    case 'unit':
      return { id: t.id ? t.id : 'unit', kind: 'unit', children: [] };
    case 'Pi':
      return { id: t.id ? t.id : 'pi', kind: 'Pi', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)] };
    case 'Lam':
      return { id: t.id ? t.id : 'lam', kind: 'Lam', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)] };
    case 'App':
      return { id: t.id ? t.id : 'app', kind: 'App', children: [termToSemanticNode(t.func), termToSemanticNode(t.arg)] };
    case 'Ann':
      return { id: t.id ? t.id : 'ann', kind: 'Ann', children: [termToSemanticNode(t.term), termToSemanticNode(t.ty)] };
  }
}
