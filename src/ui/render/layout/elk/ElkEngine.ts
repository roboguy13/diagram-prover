import { ElkNode } from "elkjs";
import { LayoutEngine, NodeListAndEdges, NodesAndEdges } from "../LayoutEngine";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { semanticNodeToElk } from "./ToElk";
import { toFlow } from '../LayoutEngine';
import { elkToReactFlow } from "./ElkToReactFlow";
import ELK from 'elkjs/lib/elk.bundled.js'
import { OpenDiagram } from "../../../../ir/StringDiagram";
// import { StringDiagram } from "../../../../ir/StringDiagram";

export const elk = new ELK();

export class ElkEngine implements LayoutEngine<ElkNode> {
  fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<ElkNode> {
    let graph = semanticNodeToElk(n);

    return elk
      .layout(graph)
      .catch(error => {
        console.error(error);
        throw error;
      });
  }

  fromStringDiagram(diagram: OpenDiagram, activeRedexId: string | null): Promise<ElkNode> {
    throw new Error("Method not implemented."); // TODO
  }

  async toReactFlow(g: ElkNode): Promise<NodeListAndEdges> {
    return elkToReactFlow(g)
  }

  async renderDebugInfo(g: ElkNode): Promise<NodeListAndEdges> {
    return { nodes: [], edges: [] }
  }
}
