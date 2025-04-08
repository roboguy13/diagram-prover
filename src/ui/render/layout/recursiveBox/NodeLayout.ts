import { XYPosition } from "@xyflow/react"
import { BoundingBox } from "./BoundingBox"
import { PortBarType } from "../../../components/Nodes/nodeTypes"

export type NodeLayout = {
  nodeId: string
  nestingParentId: string | null
  intrinsicBox: BoundingBox
  subtreeExtentBox: BoundingBox
  position: XYPosition | null
  label: string
  kind: string
  portBarType: PortBarType | null
}
