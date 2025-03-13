import { SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine } from "../LayoutEngine";

type IndexedNode = SemanticNode<NodeIndex>

type NodeIndex =
  { level: number,
    breadthIndex: number
  }

// export class SimpleLayoutEngine implements LayoutEngine<IndexedNode> {
// }
