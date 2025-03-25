import { NumericRange } from "../../../../constraint/propagator/NumericRange";
import { Conflict, ConflictHandler, PropagatorNetwork } from "../../../../constraint/propagator/Propagator";
import { Msg } from "../../../architecture/Msg";

let inPropagatorDebugMode = false;

export function debugConfictHandler(dispatch: (msg: Msg) => void) { return (net: PropagatorNetwork<NumericRange>) => { return (conflict: Conflict<NumericRange>) => {
      if (inPropagatorDebugMode) {
        return
      }

      inPropagatorDebugMode = true
      console.log('Conflict detected:', conflict)
      dispatch({ kind: 'EditorMsg', msg: { type: 'PropagatorConflict', net: net, conflict: conflict } })
    }
  }
}