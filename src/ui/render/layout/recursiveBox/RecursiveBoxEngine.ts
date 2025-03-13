import { getEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { AppNode, GroupedNode, TermNode } from "../../../components/Nodes/nodeTypes";
import { NODE_HEIGHT, NODE_WIDTH } from "../../../Config";
import { LayoutEngine, NodeMap, NodesAndEdges } from "../LayoutEngine";
import { BoxNode, Dimensions } from "./BoxNode";
import { BoundingBox, BoundingConstraintCalculator, getBoundingBox } from "./BoundingBox";

import { Cell, known, unknown } from '../../../../constraint/propagator/Propagator'
import { addNumericRange, atLeast, atMost, between, getMin, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Edge } from "@xyflow/react";
import { addPropagator } from "../../../../constraint/propagator/Arithmetic";
import { eqPartialSemigroup } from "../../../../constraint/propagator/PartialSemigroup";

export class RecursiveBoxEngine implements LayoutEngine<[BoxNode, Edge[]]> {
  private static readonly VERTICAL_PADDING = 10;
  private static readonly HORIZONTAL_PADDING = 10;

  private static readonly SUBTREE_PADDING = this.HORIZONTAL_PADDING;
  
  private static readonly MAX_WIDTH = 800;
  private static readonly MAX_HEIGHT = 800;
  private static readonly boundingCalc = new BoundingConstraintCalculator(
    { kind: 'Range', min: 0, max: RecursiveBoxEngine.MAX_WIDTH },
    { kind: 'Range', min: 0, max: RecursiveBoxEngine.MAX_HEIGHT },
  )

  fromSemanticNode(n: SemanticNode<void>): Promise<[BoxNode, Edge[]]> {
    return new Promise<[BoxNode, Edge[]]>((resolve, _reject) => {
      let node = this.makeInitialBoundingBoxConstraint(n)

      this.makeConstraints(node)

      let edges = getEdges(n)

      resolve([node, edges])
    })
  }

  toReactFlow(pair: [BoxNode, Edge[]]): Promise<NodesAndEdges> {
    let [node, edges] = pair

    let appNodes = new Map<string, AppNode>()

    this.boxNodeToAppNodes(node, appNodes)

    // TODO
    return Promise.resolve({
      nodes: appNodes,
      edges
    })
  }

  private boxNodeToAppNodes(g: BoxNode, appNodes: NodeMap): void {
    const bounds = getBoundingBox(g.payload);

    if (g.kind === 'Transpose') {
      const current: GroupedNode = {
        id: g.id,
        type: 'grouped',
        data: { label: g.label ?? '' },
        position: { x: bounds.x, y: bounds.y },
        width: bounds.dimensions.width,
        height: bounds.dimensions.height,
        style: { backgroundColor: 'lightblue' },
      };

      appNodes.set(g.id, current);

      if (g.subgraph) {
        g.subgraph.map(subgraphNode => this.boxNodeToAppNodes(subgraphNode, appNodes));
      }
    } else {
      const current: TermNode = {
        id: g.id,
        type: 'term',
        data: { label: g.label ?? '', isActiveRedex: false, outputCount: 1, inputCount: g.children.length },
        position: { x: bounds.x, y: bounds.y },
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      };

      appNodes.set(g.id, current);

      g.children.map(child => this.boxNodeToAppNodes(child, appNodes));
    }
  }

  private makeInitialBoundingBoxConstraint(node: SemanticNode<void>): BoxNode {
    let width = NODE_WIDTH
    let height = NODE_HEIGHT

    return {
      ... node,
      payload: {
        x: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: 0, max: 800 } }),
        y: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: 0, max: 800 } }),
        width: width,
        height: height
      },
      children: node.children.map(child => this.makeInitialBoundingBoxConstraint(child)),
      subgraph: node.subgraph ? node.subgraph.map(subgraphNode => this.makeInitialBoundingBoxConstraint(subgraphNode)) : []
    }
  }

  private makeConstraints(node: BoxNode): void {
    if (node.kind === 'Transpose') {
      if (node.subgraph) {
        // RecursiveBoxEngine.boundingCalc.contains(RecursiveBoxEngine.SUBTREE_PADDING, node.payload, node.subgraph.map(subgraphNode => subgraphNode.payload))

        // node.subgraph.map(subgraphNode => this.makeConstraints(subgraphNode))
      }
    }

    // Horizontal constraints between siblings
    for (let i = 0; i < node.children.length - 1; i++) {
      if (!node.children[i+1]) {
        break
      }

      RecursiveBoxEngine.boundingCalc.toTheLeftOf(RecursiveBoxEngine.HORIZONTAL_PADDING, 
        node.children[i]!.payload, 
        node.children[i+1]!.payload)
    }

    // node is above its children
    node.children.map(child =>
      RecursiveBoxEngine.boundingCalc.above(RecursiveBoxEngine.VERTICAL_PADDING, node.payload, child.payload))

    node.children.map(child => this.makeConstraints(child))
  }
}
