// A simple layout engine using the Kiwi constraint solver

import { Edge } from "@xyflow/react";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodeListAndEdges, NodesAndEdges } from "../LayoutEngine";
import { BreadthIndexMap, IndexedNode, LevelMap } from "../NodeLevels";
import * as Kiwi from "@lume/kiwi"
import { OpenDiagram } from "../../../../ir/StringDiagram";

type InternalRep = [SemanticNode<void>, [LevelMap, BreadthIndexMap, IndexedNode[]], Edge[]]

export class KiwiLayoutEngine implements LayoutEngine<InternalRep> {
  fromSemanticNode(n: SemanticNode<void>): Promise<InternalRep> {
    throw new Error("Method not implemented.");
  }

  toReactFlow(g: InternalRep): Promise<NodeListAndEdges> {
    throw new Error("Method not implemented.");
  }

  fromStringDiagram(diagram: OpenDiagram, activeRedexId: string | null): Promise<InternalRep> {
    throw new Error("Method not implemented.");
  }

  renderDebugInfo(g: InternalRep): Promise<NodeListAndEdges> {
    throw new Error("Method not implemented.");
  }
}

// function childConstraint(nodeA: IndexedNode, nodeB: IndexedNode): Kiwi.Constraint {
//   return new Kiwi.Constraint(Kiwi.Operator.Equal, nodeA.x, nodeB.x)
// }

// class CenteringConstraint {
// }

// class ChildConstraint {
// }

// class SiblingConstraint {
// }
