// Bottom up approach

import { Edge, XYPosition } from "@xyflow/react";
import { getEdges, getImmediateEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodeListAndEdges, NodesAndEdges } from "../LayoutEngine";
import { BreadthIndexMap, computeIndexedNodes, IndexedNode, LevelMap } from "../NodeLevels";
import { ApplicationNode } from "../../../components/Nodes/nodeTypes";
import { OpenDiagram } from "../../../../ir/StringDiagram";

type InternalRep = [SemanticNode<void>, [LevelMap, BreadthIndexMap, IndexedNode[]], Edge[]]

export class SimpleLayoutEngine implements LayoutEngine<InternalRep> {
  private static readonly VERTICAL_PADDING = 50;
  private static readonly HORIZONTAL_PADDING = 70;

  private static readonly MAX_HEIGHT = 500;

  fromSemanticNode(n: SemanticNode<void>): Promise<InternalRep> {
    return new Promise<InternalRep>((resolve, _reject) => {
      let ixNodes = computeIndexedNodes(n)

      let edges = getEdges(n)

      resolve([n, ixNodes, edges])
    })
  }

  fromStringDiagram(diagram: OpenDiagram, activeRedexId: string | null): Promise<InternalRep> {
    throw new Error("Method not implemented.");
  }

  renderDebugInfo(g: InternalRep): Promise<NodeListAndEdges> {
    throw new Error("Method not implemented.");
  }

  toReactFlow(pair: InternalRep): Promise<NodeListAndEdges> {
    // TODO: Put all of the actual processing into fromSemanticNode
    let [semNode, [levelMap, breadthIndexMap, ixNodes], edges] = pair

    let appNodes = new Map<string, ApplicationNode>()

    let maxLevel = Math.max(...Array.from(levelMap.keys()))
    
    // this.computeAppNodes(semNode, { x: 0, y: SimpleLayoutEngine.MAX_HEIGHT }, maxLevel, levelMap, breadthIndexMap, appNodes)

    return Promise.resolve({
      nodes: Array.from(appNodes.values()),
      edges
    })
  }
}
