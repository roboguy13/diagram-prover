import { Term } from "../../engine/Term";
import { termToSemanticNode } from "../../ir/SemanticGraph";
import { Model } from "../architecture/Model";
import { NodesAndEdges } from "./NodesAndEdges";
import { toFlow } from "./ToFlow";

export function updateGraphLayout(model: Model, term: Term): Promise<NodesAndEdges> {
  let semanticGraph = termToSemanticNode(term);
  return toFlow(semanticGraph);
}
