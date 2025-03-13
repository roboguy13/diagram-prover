import { SemanticNode } from "../../../../ir/SemanticGraph";
import { RegionConstraint } from "./Region";

export type BoxNode = SemanticNode<RegionConstraint>

export type Dimensions = { width: number, height: number }
