import { updateGraphLayout } from "../render/UpdateGraphLayout";
import { Cmd } from "./Cmd";
import { getCurrentTerm, Model } from "./Model";

export function initialize(model: Model): Cmd {
  return { kind: 'UpdateFlow', graphPromise: updateGraphLayout(model, getCurrentTerm(model)) }
}