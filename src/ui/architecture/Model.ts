import { AppNode } from "../components/Nodes/nodeTypes";
import { Edge } from "@xyflow/react";
import { NodesAndEdges } from "../render/layout/LayoutEngine";
import { Term, annotateTermWithIds, exampleTerm } from "../../engine/Term";
import { toFlow } from '../render/layout/LayoutEngine';
import { oneStep, StepChange } from "../../engine/Normalize";
import { ChangeTracker } from "../dataStructures/ChangeTracker";
import { produce } from "immer";
import { SemanticNode } from "../../ir/SemanticGraph";
import { ElkNode } from "elkjs";
import { PropagatorNetwork } from "../../constraint/propagator/Propagator";
import { NumericRange } from "../../constraint/propagator/NumericRange";

export type Mode = 'normal-mode' | 'debug-propagators-mode'

export type Model = {
  semanticGraph?: SemanticNode<void>
  graph?: NodesAndEdges // The laid-out graph
  mode: Mode
  propagatorNetwork?: PropagatorNetwork<NumericRange>

  termStepHistory: ChangeTracker<StepChange, Term>

  updateCenter: boolean
}

const initialModel0: Model = {
  mode: 'normal-mode',

  termStepHistory: new ChangeTracker(annotateTermWithIds(exampleTerm), (term) => {
    let result = oneStep(term);
    if (result[0].type === 'no-change') {
      return null
    } else {
      return [result[0], result[1]];
    }
  }),

  updateCenter: true,
};

export const initialModel = initializeModel(initialModel0);

export function getNextChangedId(model: Model): [Model, string | null] {
  let [newTermStepHistory, change] = model.termStepHistory.getChangeAfterPresent();

  let newModel = { ...model, termStepHistory: newTermStepHistory };

  if (change && change[0].type !== 'no-change') {
    let id = change[0].changedId;
    return [newModel, id ? id : null];
  }
  return [newModel, null];
}

export function initializeModel(model: Model): Model {
  if (!model.graph) {
    return updateCurrentTerm(model, 0);
  }
  return model
}

export function updateCurrentTerm(model: Model, termIx: number): Model {
  let newTermStepHistory = model.termStepHistory.setCurrentChangeIx(termIx);

  let term = newTermStepHistory.getCurrent();

  if (!term) {
    return model;
  }

  return { ...model, updateCenter: true, termStepHistory: newTermStepHistory };
}

export function getCurrentTerm(model: Model): Term {
  return model.termStepHistory.getCurrent()
}

export function advanceChange(model: Model): Model {
  return { ...model, updateCenter: true, termStepHistory: model.termStepHistory.advanceChange() };
}

export function rollbackChange(model: Model): Model {
  return { ...model, updateCenter: true, termStepHistory: model.termStepHistory.rollbackChange() };
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
