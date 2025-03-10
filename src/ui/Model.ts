import { AppNode } from "./components/Nodes/nodeTypes";
import { Edge } from "@xyflow/react";
import { NodesAndEdges } from "./render/NodesAndEdges";
import { Term, exampleTerm } from "../engine/Term";
import { toUnlayouted } from "./render/ToUnlayoutedNodes";
import { toFlow } from "./render/ToFlow";

export type Model = {
  graph?: NodesAndEdges

  currentTerm: Term
}

const initialModel0: Model = {
  currentTerm: exampleTerm
};

export const initialModel: Model = initializeModel(initialModel0);

export function initializeModel(model: Model): Model {
  if (!model.graph) {
    return updateCurrentTerm(model, model.currentTerm);
  } else {
    return model
  }
}

export function updateCurrentTerm(model: Model, term: Term): Model {
  let unlayoutedNodesAndEdges: NodesAndEdges = toUnlayouted(term);
  let flowNodesAndEdges = toFlow(unlayoutedNodesAndEdges);

  return { ...model, graph: flowNodesAndEdges, currentTerm: term };
}

export function applyModelUpdates<A>(model: Model, fn: (model: Model, a: A) => Model, aList: A[]): Model {
  let newModel = model;
  for (const a of aList) {
    newModel = fn(newModel, a);
  }
  return newModel;
}

export function getNode(model: Model, id: string): AppNode | undefined {
  return model.graph?.nodes.get(id);
}

export function setNode(model: Model, node: AppNode): Model {
  const nodes = model.graph?.nodes ?? new Map();
  const edges = model.graph?.edges ?? [];
  nodes.set(node.id, node);
  return { ...model, graph: { nodes, edges } };
}
