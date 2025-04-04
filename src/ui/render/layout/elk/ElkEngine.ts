import { ElkNode } from "elkjs";
import { LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { semanticNodeToElk } from "./ToElk";
import { toFlow } from '../LayoutEngine';
import { elkToReactFlow } from "./ElkToReactFlow";
import ELK from 'elkjs/lib/elk.bundled.js'

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

  async toReactFlow(g: ElkNode): Promise<NodesAndEdges> {
    return elkToReactFlow(g)
  }

  async renderDebugInfo(g: ElkNode): Promise<NodesAndEdges> {
    return { nodes: new Map(), edges: [] }
  }
}
