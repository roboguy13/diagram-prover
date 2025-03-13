//
// This type mediates between the AST types and the layout engine (currently, ELK) graph types
//   AST -> SemanticGraph -> ELK graph -> ReactFlow graph
//

import { Edge } from "@xyflow/react";
import { Term, TermKind } from "../engine/Term";
import { TargetIcon } from "@radix-ui/react-icons";
import { inputHandleName, outputHandleName } from "../ui/NodeUtils";

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
  let edgesHere = n.children.map((child, index) => ({
    id: `edge-${n.id}-${child.id}-${index}`,
    source: n.id,
    target: child.id,

    sourceHandle: inputHandleName(index),
    targetHandle: outputHandleName(0),
  }));

  let edgesThere = n.children ? n.children.flatMap((child, index) => getEdges(child)) : [];
  let edges = [...edgesHere, ...edgesThere];
  return edges
}

export function termToSemanticNode(t: Term): SemanticNode<void> {
  switch (t.type) {
    case 'Var':
      return { id: t.id ? t.id : 'type', label: 'Var', kind: 'Var', children: [], payload: undefined };
    case 'UnitTy':
      return { id: t.id ? t.id : 'type', label: 'Unit', kind: 'UnitTy', children: [], payload: undefined };
    case 'Empty':
      return { id: t.id ? t.id : 'type', label: 'Empty', kind: 'Empty', children: [], payload: undefined };
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
      // let parentNode: SemanticNode<void> = { id: 'transpose-' + (t.id ? t.id : 'lam'), kind: 'Transpose', subgraph: [lamNode], children: [], payload: undefined };
      return lamNode
    case 'App':
      // TODO: Exponential transpose
      return { id: t.id ? t.id : 'app', label: '@', kind: 'App', children: [termToSemanticNode(t.func), termToSemanticNode(t.arg)], payload: undefined };
    case 'Ann':
      return { id: t.id ? t.id : 'ann', label: ':', kind: 'Ann', children: [termToSemanticNode(t.term), termToSemanticNode(t.ty)], payload: undefined };
  }
}
