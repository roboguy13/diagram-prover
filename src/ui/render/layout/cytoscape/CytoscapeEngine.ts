import cytoscape from "cytoscape";
import fcose, { FcoseLayoutOptions } from "cytoscape-fcose";
import euler from 'cytoscape-euler';
import { getEdges, getImmediateEdges, getNodeIds, getNodeIdsAndLabels, SemanticNode } from "../../../../ir/SemanticGraph";
import { LayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { node } from "webpack";
import { ApplicationNode } from "../../../components/Nodes/nodeTypes";
import { TermKind } from "../../../../engine/Term";
import cytoscapeDagre from "cytoscape-dagre";
import klay from 'cytoscape-klay';
import { StringDiagram } from "../../../../ir/StringDiagram";

export class CytoscapeEngine implements LayoutEngine<NodesAndEdges> {
  constructor() {
    // cytoscape.use(euler);
    cytoscape.use(cytoscapeDagre)
    // cytoscape.use(klay)
  }

  fromStringDiagram(diagram: StringDiagram, activeRedexId: string | null): Promise<NodesAndEdges> {
    throw new Error("Method not implemented."); // TODO
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
        name: 'dagre' as const,
        rankDir: 'TB',
        ranker: 'tight-tree',
        nodeSep: 200,       // Increase horizontal spacing substantially
        rankSep: 200,       // Increase vertical spacing substantially
        edgeSep: 100,       // Increase edge separation
        padding: 75,
        // minLen: function(edge) { return 2; },  // Force minimum edge length
        animate: false,
        ready: () => {}
      }

      // let options = {
      //   name: 'klay' as const,
      //   nodeDimensionsIncludeLabels: true,
      //   fit: true,
      //   padding: 50,
      //   animate: false,
      //   ready: () => {}, // Add this - klay may expect a ready function
      //   stop: () => {}, // Optional but can help prevent errors
      //   klay: {
      //     direction: 'DOWN',
      //     edgeSpacingFactor: 0.5,
      //     nodeLayering: 'NETWORK_SIMPLEX',
      //     nodeSpacing: 40,
      //     thoroughness: 10,
      //     edgeRouting: 'ORTHOGONAL',
      //     hierarchyHandling: 'INCLUDE_CHILDREN',
      //     spacing: 50,
      //     // Add these explicit values to prevent undefined options
      //     separateConnectedComponents: true,
      //     crossingMinimization: 'LAYER_SWEEP',
      //     cycleBreaking: 'GREEDY',
      //     inLayerSpacingFactor: 1.0,
      //     layoutHierarchy: true,
      //     mergeEdges: false,
      //     mergeHierarchyCrossingEdges: true,
      //     fixedAlignment: 'NONE',
      //     aspectRatio: 1.6,
      //     borderSpacing: 10
      //   }
      // }

      // let options = {
      //   name: 'klay' as const,
      //   nodeDimensionsIncludeLabels: true,
      //   fit: true,
      //   padding: 50,
      //   animate: false,
      //   klay: {
      //     direction: 'DOWN',           // Overall direction (DOWN, UP, LEFT, RIGHT)
      //     edgeSpacingFactor: 0.5,      // Factor for edge spacing
      //     nodeLayering: 'NETWORK_SIMPLEX', // Algorithm for node layering
      //     nodeSpacing: 40,            // Spacing between nodes
      //     thoroughness: 10,           // How thorough the algorithm should be (higher = better but slower)
      //     edgeRouting: 'ORTHOGONAL',   // POLYLINE, ORTHOGONAL, or SPLINES
      //     hierarchyHandling: 'INCLUDE_CHILDREN', // Important for compound/nested nodes
      //     spacing: 50,                // Overall spacing
      //   }
      // }

      // let options = {
      //   name: 'dagre' as const,
      //   rankDir: 'TB',           // Top to bottom layout
      //   ranker: 'tight-tree',    // Algorithm type (network-simplex, tight-tree, longest-path)
      //   nodeSep: 120,            // Horizontal separation
      //   rankSep: 150,            // Vertical separation
      //   edgeSep: 80,             // Minimum edge separation
      //   padding: 50,
      //   animate: false,
      //   ready: () => {}
      // }

      // let options = {
      //   name: 'breadthfirst' as const, // Use fcose layout
      //   directed: true,
      //   roots: [n.id], // Start from the root node of the semantic graph
      //   padding: 50,
      //   grid: true,
      //   rankDir: 'TB',
      //   circle: false,
      //   nodeDimensionsIncludeLabels: true,
      //   spacingFactor: 3, // Adjust spacing between nodes
      //   animate: false, // Disable animation for layout
      //   ready: () => {} // Add a required ready callback function
      // }

      const layout = cy.layout(options).run()

      let nodes: ApplicationNode[] = cy.nodes().map((node): ApplicationNode => {
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

      let nodeMap = new Map<string, ApplicationNode>();
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