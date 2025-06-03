import { NumericRange, printNumericRange } from "../../../constraint/propagator/NumericRange";
import { Conflict, PropagatorNetwork } from "../../../constraint/propagator/Propagator";
import { conflictToElkNode } from "../../../constraint/propagator/PropagatorToElk";
import { Term } from "../../../engine/Term";
import { termToSemanticNode } from "../../../ir/SemanticGraph";
import { termToStringDiagram } from "../../../ir/TermToDiagram";
import { getNextChangedId, Model } from "../../architecture/Model";
import { elk } from "./elk/ElkEngine";
import { elkToReactFlow } from "./elk/ElkToReactFlow";
import { NodeListAndEdges, NodesAndEdges } from "./LayoutEngine";
import { toFlow } from './LayoutEngine';
import { theLayoutEngine } from "./LayoutEngineConfig";

export function updateGraphLayout(model: Model, term: Term): Promise<NodeListAndEdges> {
  if (model.mode === 'debug-propagators-mode') {
    throw new Error('Cannot update graph layout in debug mode');
  }

  let diagram = termToStringDiagram(term);

  const [_, activeRedexId] = getNextChangedId(model)

  return toFlow(theLayoutEngine, diagram, activeRedexId).catch(err => {
    console.error('Error updating graph layout:', err);
    throw err;
    // return { nodes: [], edges: [] };
  })
}

export async function renderLayoutConflictInfo(net: PropagatorNetwork<NumericRange>, conflict: Conflict<NumericRange>): Promise<NodeListAndEdges> {
  let elkNode = conflictToElkNode(printNumericRange, net, conflict)

  return elkToReactFlow(await elk.layout(elkNode))
}

export async function renderLayoutDebugInfo(model: Model, term: Term): Promise<NodeListAndEdges> {
  let semanticGraph = termToSemanticNode(term);

  const [_, activeRedexId] = getNextChangedId(model)

  let ir = await theLayoutEngine.fromSemanticNode(semanticGraph, activeRedexId);

  return theLayoutEngine.renderDebugInfo(ir);
}
