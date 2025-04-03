import { XYPosition } from "@xyflow/react"
import { AbsolutePositionMap } from "./ConstraintCalculator"
import { getMin } from "../../../../constraint/propagator/NumericRange"
import { DimensionsMap, ExactDimensions } from "./Constraint"

export class Locator {
  private readonly _absolutePositionMap: AbsolutePositionMap
  private readonly _rootId: string
  private readonly _rootPosition: XYPosition
  private readonly _dimensionsMap: DimensionsMap

  constructor(absolutePositionMap: AbsolutePositionMap, dims: DimensionsMap, rootId: string, rootPosition: XYPosition) {
    this._rootId = rootId
    this._rootPosition = rootPosition
    this._absolutePositionMap = absolutePositionMap
    this._dimensionsMap = dims
  }

  public locate(nodeId: string): XYPosition {
    return {
      x: this._absolutePositionMap.get(nodeId)!.x,
      y: this._absolutePositionMap.get(nodeId)!.y
    }
  }

  public getDimensions(nodeId: string): ExactDimensions {
    const dims = this._dimensionsMap.get(nodeId)

    if (!dims) {
      throw new Error(`No dimensions found for node with id ${nodeId}`)
    }

    return {
      width: dims.width,
      height: dims.height
    }
  }
}
