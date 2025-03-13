import { SemanticNode } from "../../../../ir/SemanticGraph";
import { BoundingBoxConstraint } from "./BoundingBox";

export type BoxNode = SemanticNode<BoundingBoxConstraint>

export type Dimensions = { width: number, height: number }
