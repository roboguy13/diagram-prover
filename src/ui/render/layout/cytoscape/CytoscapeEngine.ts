import cytoscape from "cytoscape";
import fcose, { FcoseLayoutOptions } from "cytoscape-fcose";
import { getEdges, getImmediateEdges, getNodeIds, getNodeIdsAndLabels, SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { node } from "webpack";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { TermKind } from "../../../../engine/Term";

export class CytoscapeEngine implements LayoutEngine<NodesAndEdges> {
  constructor() {
    cytoscape.use(fcose);
  }

  fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<NodesAndEdges> {
    console.log('fromSemanticNode called with: ', n.id);
    try {
      const nodeElements: cytoscape.ElementDefinition[] = getNodeIdsAndLabels(n).map((pair) => {
        let [id, kind, label] = pair;
        return {
          data: {
            id: id, // The node ID
            label: label,
            kind: kind
          }
        }
      })

      let edges = getEdges(n);

      const edgeElements: cytoscape.ElementDefinition[] = edges.map((edge) => {
        return {
          data: {
            id: edge.id, // The edge ID
            source: edge.source, // The source node ID
            target: edge.target, // The target node ID
            sourceHandle: edge.sourceHandle, // Optional, for react-flow compatibility
            targetHandle: edge.targetHandle // Optional, for react-flow compatibility
          }
        }
      })

      const elements = nodeElements.concat(edgeElements);

      const cy = cytoscape({
        container: null,
        elements,
        headless: true,
        styleEnabled: false,
      })

      let options = {
        name: 'fcose' as const, // Use fcose layout
        animate: false, // Disable animation for layout
        ready: () => {} // Add a required ready callback function
      }

      const layout = cy.layout(options).run()

      let nodes: AppNode[] = cy.nodes().map((node): AppNode => {
        const data = node.data() as { id: string, label?: string, kind: 'Transpose' | TermKind };

        let type: any = 'default'

        switch (data.kind) {
          case 'Transpose':
            return {
              id: data.id,
              type: 'grouped', // Transpose nodes are grouped
              position: node.position(),
              data: { label: data.label ?? '' },
            }
          default:
            return {
              id: data.id,
              type: 'term', // Default term node
              position: node.position(),
              data: {
                label: data.label ?? '',
                isActiveRedex: data.id === activeRedexId, // Mark as active redex if applicable
                outputCount: 1, // Default to 1 for now, can be adjusted based on actual edges
                inputCount: getImmediateEdges(n).length
              },
            }
        }

        // return {
        //   id: data.id,
        //   type: type,
        //   position: node.position(),
        //   data: { label: data.label! },
        // }
      })

      let nodeMap = new Map<string, AppNode>();
    console.log('node: ', nodes);

    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    return Promise.resolve({ nodes: nodeMap, edges });
    } catch (e) {
      console.error('Error in fromSemanticNode: ', e);
      throw e
    }
    return Promise.reject(new Error("Failed to create layout from semantic node"));
  }
  
  toReactFlow(g: NodesAndEdges): Promise<NodesAndEdges> {
    return Promise.resolve(g);
  }
  
  renderDebugInfo(g: any): Promise<NodesAndEdges> {
    throw new Error("Method not implemented.");
  }
}