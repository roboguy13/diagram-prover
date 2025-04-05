//
// This type mediates between the AST types and the layout engine (currently, ELK) graph types
//   AST -> SemanticGraph -> ELK graph -> ReactFlow graph
//

import { Edge } from "@xyflow/react";
import { Term, TermKind } from "../engine/Term";
import { TargetIcon } from "@radix-ui/react-icons";
import { inputHandleName, outputHandleName } from "../ui/NodeUtils";
import { json } from "fp-ts";

export type SemanticNode<A> = {
  id: string;

  label?: string;

  payload: A

  kind: 'Transpose' // We represent the exponential transpose (currying/using a function as a value) as a nested subgraph
        | TermKind;

  subgraph?: SemanticNode<A>[];
  children: SemanticNode<A>[];
}

export function getNodeIds<A>(n: SemanticNode<A>): string[] {
  let idsThere = n.children ? n.children.flatMap((child) => getNodeIds(child)) : [];
  let nestedIds = n.subgraph ? n.subgraph.flatMap((child) => getNodeIds(child)) : [];
  return [n.id, ...idsThere, ...nestedIds];
}

export function getNodeIdsAndLabels<A>(n: SemanticNode<A>): Array<[string, 'Transpose' | TermKind, string | undefined]> {
  let idsThere = n.children ? n.children.flatMap((child) => getNodeIdsAndLabels(child)) : [];
  let nestedIds = n.subgraph ? n.subgraph.flatMap((child) => getNodeIdsAndLabels(child)) : [];
  return [[n.id, n.kind, n.label], ...idsThere, ...nestedIds];
}

export function getImmediateEdges(n: SemanticNode<void>): Edge[] {
  return n.children.map((child, index) => ({
    id: `edge-${n.id}-${child.id}-${index}`,
    source: n.id,
    target: child.id,

    sourceHandle: inputHandleName(index),
    targetHandle: outputHandleName(0),
  }));
}

export function getEdges(n: SemanticNode<void>): Edge[] {
  let edgesHere = getImmediateEdges(n)

  let edgesThere = n.children ? n.children.flatMap((child, index) => getEdges(child)) : [];
  let nestedEdges = n.subgraph ? n.subgraph.flatMap((child, index) => getEdges(child)) : [];
  let edges = [...edgesHere, ...edgesThere, ...nestedEdges];
  return edges
}

export function termToSemanticNode(t: Term): SemanticNode<void> {
  switch (t.type) {
    case 'Var':
      if (t.kind === 'FreeVar') {
        return { id: t.id ? t.id : 'type', label: JSON.stringify(t.name), kind: 'Var', children: [], payload: undefined };
      } else {
        return { id: t.id ? t.id : 'type', label: JSON.stringify(t.index), kind: 'Var', children: [], payload: undefined };
      }
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
    case 'Lam': {
      // TODO: Exponential transpose
      let thisId = t.id ? t.id : 'lam';
      let lamNode: SemanticNode<void> = { id: thisId, label: 'λ', kind: 'Lam', children: [termToSemanticNode(t.paramTy), termToSemanticNode(t.body)], payload: undefined };
      // let parentNode: SemanticNode<void> = { id: 'transpose-' + thisId, label: 'transpose', kind: 'Transpose', subgraph: [lamNode], children: [], payload: undefined };
      let parentNode: SemanticNode<void> = { id: 'transpose-' + thisId, label: 'transpose', kind: 'Transpose', subgraph: [lamNode], children: [], payload: undefined };
      return parentNode
    }
    case 'App':
      // TODO: Exponential transpose
      return { id: t.id ? t.id : 'app', label: '@', kind: 'App', children: [termToSemanticNode(t.func), termToSemanticNode(t.arg)], payload: undefined };
    case 'Ann':
      return { id: t.id ? t.id : 'ann', label: ':', kind: 'Ann', children: [termToSemanticNode(t.term), termToSemanticNode(t.ty)], payload: undefined };
  }
}
