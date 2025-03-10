import { applyModelUpdates, Model, setNode, updateCurrentTerm } from '../../Model';
import { EditorMsg } from './EditorMsg';
import { NodeChange, NodePositionChange, NodeSelectionChange, EdgeChange } from '@xyflow/react';
import { oneStep } from '../../../engine/Normalize';
import { prettyPrintTerm } from '../../../engine/PrettyPrint';

export function editorUpdate(model: Model, msg: EditorMsg): Model {
  switch (msg.type) {
    case 'ConnectMsg':
      return connect(model, msg);
    case 'SelectMsg':
      return model; //select(model, msg.selected);
    case 'NodeChangeMsg':
      return applyModelUpdates(model, nodeChange, msg.changes);
    case 'EdgeChangeMsg':
      return applyModelUpdates(model, edgeChange, msg.changes);

    case 'ResetUpdateCenter':
      return { ...model, updateCenter: false };

    case 'BetaStepMsg': {
      if (model.currentTermIx < model.history.length-1) {
        return updateCurrentTerm(model, model.currentTermIx + 1);
      }

      let currentTerm = model.history[model.currentTermIx];
      if (currentTerm) {
        let [stepChange, newTerm] = oneStep(currentTerm);

        if (stepChange.type !== 'no-change') {
          let newModel = { ...model, history: [...model.history, newTerm] };
          return updateCurrentTerm(newModel, model.currentTermIx + 1);
        }

        return model;
      }
      return model;
    }

    case 'StepBackMsg': {
      if (model.currentTermIx > 0) {
        return updateCurrentTerm(model, model.currentTermIx - 1);
      }
      return model;
    }
  }
}

function connect(model: Model, msg: EditorMsg): Model {
  return model;
  // const { source, target } = msg;
  // const node = model.nodes.get(source);
  // if (node) {
  //   node.data.connectedTo.push(target);
  // }
  // return model;
}

function nodeChange(model: Model, change: NodeChange): Model {
  switch (change.type) {
    case 'position':
      return nodePositionChange(model, change);
    case 'select':
      return nodeSelectionChange(model, change);
    default:
      return model;
  }
}

function nodePositionChange(model: Model, change: NodePositionChange): Model {
  const node = model.graph?.nodes.get(change.id);

  if (node && change.position
      && change.position.x === change.position.x && change.position.y === change.position.y) { // To avoid NaNs
    const updatedNode = { ...node, position: change.position };
    return setNode(model, updatedNode);
  }

  return model;
}

function nodeSelectionChange(model: Model, change: NodeSelectionChange): Model {
  const node = model.graph?.nodes.get(change.id);

  if (node) {
    const updatedNode = { ...node, selected: change.selected };
    return setNode(model, updatedNode);
  }

  return model;
}

function edgeChange(model: Model, change: EdgeChange): Model {
  // TODO
  return model;

  // switch (change.type) {
  //   case 'remove':
  //     return edgeRemove(model, change);
  //   default:
  //     return model;
  // }
}