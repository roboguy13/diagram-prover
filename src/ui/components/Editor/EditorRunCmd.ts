import { Cmd } from "../../architecture/Cmd";
import { Dispatch, Msg } from "../../architecture/Msg";

export function runCmd(dispatch: Dispatch, cmd: Cmd) {
  switch (cmd.kind) {
    case 'UpdateFlow':
      cmd.graphPromise.then(graph => {
        dispatch({ kind: 'EditorMsg', msg: { type: 'GraphLayoutReady', graph } });
      })
  }
}