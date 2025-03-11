import { Term } from "../../engine/Term";
import { Model } from "../architecture/Model";
import { NodesAndEdges } from "./NodesAndEdges";
import { toFlow } from "./ToFlow";
import { toUnlayouted } from "./ToUnlayoutedNodes";

export function updateGraphLayout(model: Model, term: Term): Promise<NodesAndEdges> {
  let unlayoutedNodesAndEdges: NodesAndEdges = toUnlayouted(model, term);
  return toFlow(model, unlayoutedNodesAndEdges);
}
