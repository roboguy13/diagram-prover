import { XYPosition } from "@xyflow/react"
import { SimpleBoundingBox } from "./BoundingBox"
import { PortBarType } from "../../../components/Nodes/nodeTypes"

export type NodeLayout = {
  nodeId: string
  nestingParentId: string | null
  intrinsicBox: SimpleBoundingBox
  subtreeExtentBox: SimpleBoundingBox
  position: XYPosition | null
  label: string
  kind: string
  portBarType: PortBarType | null
}
