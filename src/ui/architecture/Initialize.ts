import { updateGraphLayout } from "../render/layout/UpdateGraphLayout";
import { Cmd } from "./Cmd";
import { getCurrentTerm, Model } from "./Model";

export function initialize(model: Model): Cmd {
  return { kind: 'UpdateFlow', graphPromise: updateGraphLayout(model, getCurrentTerm(model)) }
}