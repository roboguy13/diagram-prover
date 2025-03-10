import { AppNode } from "./components/Nodes/nodeTypes";
import { Edge } from "@xyflow/react";

export type Model = {
  nodes: Map<string, AppNode>;
  edges: Edge[];
}

export const initialModel: Model = {
  nodes: new Map<string, AppNode>(),
  edges: [],
};

export const makeInitialModel = (nodes: AppNode[], edges: Edge[]): Model => {
  const nodeMap = new Map<string, AppNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  return {
    nodes: nodeMap,
    edges: edges,
  };
}

export function applyModelUpdates<A>(model: Model, fn: (model: Model, a: A) => Model, aList: A[]): Model {
  let newModel = model;
  for (const a of aList) {
    newModel = fn(newModel, a);
  }
  return newModel;
}

export function getNode(model: Model, id: string): AppNode | undefined {
  return model.nodes.get(id);
}

export function setNode(model: Model, node: AppNode): Model {
  const newNodes = new Map(model.nodes)
  newNodes.set(node.id, node);
  return { ...model, nodes: newNodes };
}