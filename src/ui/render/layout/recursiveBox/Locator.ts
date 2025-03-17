import { XYPosition } from "@xyflow/react"
import { AbsolutePositionMap } from "./SpacingConstraints"
import { getMin } from "../../../../constraint/propagator/NumericRange"

export class Locator {
  private readonly _absolutePositionMap: AbsolutePositionMap
  private readonly _rootId: string
  private readonly _rootPosition: XYPosition

  constructor(absolutePositionMap: AbsolutePositionMap, rootId: string, rootPosition: XYPosition) {
    this._rootId = rootId
    this._rootPosition = rootPosition
    this._absolutePositionMap = absolutePositionMap
  }

  public locate(nodeId: string): XYPosition {
    return {
      x: this._absolutePositionMap.get(nodeId)!.x,
      y: this._absolutePositionMap.get(nodeId)!.y
    }
  }
}
