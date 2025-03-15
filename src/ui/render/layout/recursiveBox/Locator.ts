import { XYPosition } from "@xyflow/react"
import { ConstraintMap, NodeRelationConstraint, MidpointConstraint, VERTICAL_PADDING, lookupHorizontalSpacing, lookupVerticalSpacing } from "./SpacingConstraints"
import { getMin } from "../../../../constraint/propagator/NumericRange"

export class Locator {
  private readonly _constraintMap: ConstraintMap
  private readonly _rootId: string
  private readonly _rootPosition: XYPosition

  constructor(constraintMap: ConstraintMap, rootId: string, rootPosition: XYPosition) {
    this._constraintMap = constraintMap
    this._rootId = rootId
    this._rootPosition = rootPosition
  }

  public locate(nodeId: string): XYPosition {
    let xSpacing = lookupHorizontalSpacing(this._rootId, nodeId, this._constraintMap)
    let ySpacing = lookupVerticalSpacing(this._rootId, nodeId, this._constraintMap)

    return {
      x: this._rootPosition.x + (getMin(xSpacing) ?? 0),
      y: this._rootPosition.y + (getMin(ySpacing) ?? 0)
    }
  }
}
