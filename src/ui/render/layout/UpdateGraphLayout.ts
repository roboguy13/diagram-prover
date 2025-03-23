import { Term } from "../../../engine/Term";
import { termToSemanticNode } from "../../../ir/SemanticGraph";
import { getNextChangedId, Model } from "../../architecture/Model";
import { NodesAndEdges } from "./LayoutEngine";
import { toFlow } from './LayoutEngine';
import { theLayoutEngine } from "./LayoutEngineConfig";

export function updateGraphLayout(model: Model, term: Term): Promise<NodesAndEdges> {
  let semanticGraph = termToSemanticNode(term);

  const [_, activeRedexId] = getNextChangedId(model)

  return toFlow(theLayoutEngine, semanticGraph, activeRedexId);
}
