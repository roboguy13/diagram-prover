import { rollbackChange, advanceChange, applyModelUpdates, Model, setNode, updateCurrentTerm, getCurrentTerm, getNode } from '../../architecture/Model';
import { EditorMsg } from './EditorMsg';
import { NodeChange, NodePositionChange, NodeSelectionChange, EdgeChange, applyNodeChanges } from '@xyflow/react';
import { Cmd } from '../../architecture/Cmd';
import { renderLayoutConflictInfo, renderLayoutDebugInfo, updateGraphLayout } from '../../render/layout/UpdateGraphLayout';
import { ApplicationNode } from '../Nodes/nodeTypes';
import { NodeListAndEdges } from '../../render/layout/LayoutEngine';

export function editorUpdate(model: Model, msg: EditorMsg): [Model, Cmd | null] {
  switch (msg.type) {
    case 'ConnectMsg':
      return [connect(model, msg), null];
    case 'SelectMsg':
      return [model, null]; //select(model, msg.selected);
    case 'NodeChangeMsg':
      return [applyModelUpdates(model, nodeChange, msg.changes), null];
    case 'EdgeChangeMsg':
      return [applyModelUpdates(model, edgeChange, msg.changes), null];

    case 'ResetUpdateCenter':
      return [{ ...model, updateCenter: false }, null];

    case 'GraphLayoutReady':
      return [{ ...model, graph: msg.graph }, null];

    case 'ToggleDebugPropagatorsMode':
      if (model.mode === 'normal-mode') {
        let newModel: Model = { ...model, mode: 'debug-propagators-mode' }
        return [ newModel, { kind: 'UpdateFlow', graphPromise: renderLayoutDebugInfo(model, getCurrentTerm(model)) } ]
      } else {
        let newModel: Model = { ...model, mode: 'normal-mode' }
        return [ newModel, { kind: 'UpdateFlow', graphPromise: updateGraphLayout(newModel, getCurrentTerm(newModel)) } ]
      }

    case 'PropagatorConflict': {
        let newModel: Model = { ...model, mode: 'debug-propagators-mode' }
        return [ newModel, { kind: 'UpdateFlow', graphPromise: renderLayoutConflictInfo(msg.net, msg.conflict) } ]
    }


    case 'BetaStepMsg': {
      let newModel = advanceChange(model)
      let term = getCurrentTerm(newModel);
      return [newModel, { kind: 'UpdateFlow', graphPromise: updateGraphLayout(newModel, term) }]
    }

    case 'StepBackMsg': {
      let newModel = rollbackChange(model)
      let term = getCurrentTerm(newModel);
      return [newModel, { kind: 'UpdateFlow', graphPromise: updateGraphLayout(newModel, term) }]
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

    // TODO: Fix the issue with selection (apparently) changing the z-index
    case 'select':
      return model //nodeSelectionChange(model, change);

    default: {
      const nodes = model.graph?.nodes;
      if (!nodes) {
        return model
      }

      const newNodes = applyNodeChanges([change], nodes) as ApplicationNode[];
      const newGraph: NodeListAndEdges = { ...model.graph, nodes: newNodes } as NodeListAndEdges;
      return { ... model, graph: newGraph };
    }
  }
}

function nodePositionChange(model: Model, change: NodePositionChange): Model {
  let node = getNode(model, change.id)

  if (!node && model.inputBar.id === change.id) {
    node = model.inputBar
  }

  if (!node && model.outputBar.id === change.id) {
    node = model.outputBar
  }

  if (node?.data && 'portBarType' in node.data && node.data.portBarType) {
    return model
  }

  if (node && change.position
      && change.position.x === change.position.x && change.position.y === change.position.y) { // To avoid NaNs
    const updatedNode = { ...node, position: change.position };
    return setNode(model, updatedNode);
  }

  return model;
}

function nodeSelectionChange(model: Model, change: NodeSelectionChange): Model {
  const node = getNode(model, change.id);

  if (node) {
    if (node?.data && 'portBarType' in node.data && node.data.portBarType) {
      return model
    }

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