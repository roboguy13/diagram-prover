import { XYPosition } from "@xyflow/react"
import { BoundingBox } from "./BoundingBox"

export type NodeLayout = {
  nodeId: string
  nestingParentId: string | null
  intrinsicBox: BoundingBox
  subtreeExtentBox: BoundingBox
  position: XYPosition | null
  label: string
  kind: string
}
