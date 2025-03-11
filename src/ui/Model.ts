import { AppNode } from "./components/Nodes/nodeTypes";
import { Edge } from "@xyflow/react";
import { NodesAndEdges } from "./render/NodesAndEdges";
import { Term, exampleTerm } from "../engine/Term";
import { toUnlayouted } from "./render/ToUnlayoutedNodes";
import { toFlow } from "./render/ToFlow";
import { oneStep, StepChange } from "../engine/Normalize";
import { ChangeTracker } from "./dataStructures/ChangeTracker";
import { produce } from "immer";

export type Model = {
  graph?: NodesAndEdges

  termStepHistory: ChangeTracker<StepChange, Term>

  updateCenter: boolean
}

const initialModel0: Model = {
  termStepHistory: new ChangeTracker(exampleTerm, (term) => {
    let result = oneStep(term);
    if (result[0].type === 'no-change') {
      return null
    } else {
      return [result[0], result[1]];
    }
  }),

  updateCenter: true,
};

export const initialModel: Model = initializeModel(initialModel0);

export function getNextChangedId(model: Model): string | null {
  let change = model.termStepHistory.getChangeAfterPresent();

  if (change && change[0].type !== 'no-change') {
    let id = change[1].id;
    return id ? id : null;
  }
  return null
}

// export function extendHistory(model: Model): Model {
//   if (model.nextChange) {
//     return { ...model, history: [...model.history, model.nextChange[1]] };
//   }
//   return model;
// }

export function initializeModel(model: Model): Model {
  if (!model.graph) {
    return updateCurrentTerm(model, 0);
  } else {
    return model
  }
}
function updateFlow(model: Model): Model {
  let unlayoutedNodesAndEdges: NodesAndEdges = toUnlayouted(model.termStepHistory.getCurrent());

  let flowNodesAndEdges = toFlow(model, unlayoutedNodesAndEdges);

  return { ...model, graph: flowNodesAndEdges };
}

export function updateCurrentTerm(model: Model, termIx: number): Model {
  let newTermStepHistory = produce(model.termStepHistory, (draft) => {
    draft.setCurrentChangeIx(termIx);
  });

  let term = newTermStepHistory.getCurrent();

  if (!term) {
    return model;
  }

  let newModel = { ...model, updateCenter: true, termStepHistory: newTermStepHistory };

  return updateFlow(newModel);
}

export function advanceChange(model: Model): Model {
  let newTermStepHistory = produce(model.termStepHistory, (draft) => {
    let change = draft.advanceChange();
  });

  let newModel = { ...model, updateCenter: true, termStepHistory: newTermStepHistory };

  return updateFlow(newModel);
}

export function rollbackChange(model: Model): Model {
  let newTermStepHistory = produce(model.termStepHistory, (draft) => {
    draft.rollbackChange();
  });

  let newModel = { ...model, updateCenter: true, termStepHistory: newTermStepHistory };

  return updateFlow(newModel);
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
