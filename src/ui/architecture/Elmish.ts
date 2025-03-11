import { Cmd } from "./Cmd"
import { useRef, useReducer, useEffect, useCallback, startTransition } from "react"
import { update } from "./Msg"
import { runCmd } from "../components/Editor/EditorRunCmd"
import { Model } from "./Model"
import { Msg } from "./Msg"
import { initialize } from "./Initialize"

export function useElmish(
  initial: Model
) {
  const dispatchRef = useRef<(msg: Msg) => void>(() => {})

  const [model, dispatchBase] = useReducer(
    (model: Model, msg: Msg) => {
      const [newModel, cmd] = update(model, msg)

      // Dispatch side effects *after* React commit
      if (cmd) {
        startTransition(() => {
          if (dispatchRef.current) {
            runCmd(dispatchRef.current, cmd)
          }
        })
      }

      return newModel
    },
    initial
  )

  const dispatch = useCallback((msg: Msg) => {
    dispatchBase(msg)
  }, [])

  // Save latest dispatch so we can use it in runCmd inside reducer
  useEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  // Run the initial command
  useEffect(() => {
    const cmd = initialize(initial)
    runCmd(dispatch, cmd)
  }, [])

  return [model, dispatch] as const
}
