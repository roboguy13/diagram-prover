import { ApplicationNode, PortBarNode } from "../components/Nodes/nodeTypes";
import { Edge } from "@xyflow/react";
import { NodeListAndEdges, NodesAndEdges } from "../render/layout/LayoutEngine";
import { Term, annotateTermWithIds, exampleTerm } from "../../engine/Term";
import { toFlow } from '../render/layout/LayoutEngine';
import { oneStep, StepChange } from "../../engine/Normalize";
import { ChangeTracker } from "../dataStructures/ChangeTracker";
import { produce } from "immer";
import { SemanticNode } from "../../ir/SemanticGraph";
import { ElkNode } from "elkjs";
import { PropagatorNetwork } from "../../constraint/propagator/Propagator";
import { NumericRange } from "../../constraint/propagator/NumericRange";

export type Mode =
  | 'normal-mode'
  | 'test-mode' // Ignore the terms and use a custom semantic graph for testing
  | 'debug-propagators-mode'

export type Model = {
  semanticGraph?: SemanticNode<void>
  graph?: NodeListAndEdges // The laid-out graph
  mode: Mode
  propagatorNetwork?: PropagatorNetwork<NumericRange>
  inputBar: PortBarNode
  outputBar: PortBarNode

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

  inputBar: {
    id: 'input-bar',
    type: 'port-bar',
    data: {
      label: 'Input',
      portCount: 3,
      isInput: true
    },
    position: { x: -80, y: -80 }
  },

  outputBar: {
    id: 'output-bar',
    type: 'port-bar',
    data: {
      label: 'Output',
      portCount: 1,
      isInput: false
    },
    position: { x: -80, y: 500 }
  }
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

export function getNode(model: Model, id: string): ApplicationNode | undefined {
  if (!model.graph) {
    return undefined;
  }

  const node = model.graph.nodes.find((node) => node.id === id);
  return node
}

export function setNode(model: Model, node: ApplicationNode): Model {
  if (!model.graph) {
    return model;
  }

  const newGraph = {
    ...model.graph,
    nodes: model.graph.nodes.map((n) => (n.id === node.id ? node : n)),
  };

  return { ...model, graph: newGraph };
}
