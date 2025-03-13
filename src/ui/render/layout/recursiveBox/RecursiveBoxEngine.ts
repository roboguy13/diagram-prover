import { getEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { AppNode, GroupedNode, TermNode } from "../../../components/Nodes/nodeTypes";
import { NODE_HEIGHT, NODE_WIDTH } from "../../../Config";
import { LayoutEngine, NodeMap, NodesAndEdges } from "../LayoutEngine";
import { BoxNode, Dimensions } from "./BoxNode";
import { above, BoundingBox, contains, getBoundingBox } from "./BoundingBox";

import { Cell } from '../../../../constraint/propagator/Propagator'
import { getMin, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Edge } from "@xyflow/react";

export class RecursiveBoxEngine implements LayoutEngine<[BoxNode, Edge[]]> {
  private static readonly VERTICAL_PADDING = 10;
  private static readonly HORIZONTAL_PADDING = 10;

  private static readonly SUBTREE_PADDING = this.HORIZONTAL_PADDING;

  fromSemanticNode(n: SemanticNode<void>): Promise<[BoxNode, Edge[]]> {
    return new Promise<[BoxNode, Edge[]]>((resolve, _reject) => {
      let node = this.makeInitialBoundingBoxConstraint(n)

      this.makeConstraints(node)

      let edges = getEdges(n)

      resolve([node, edges])
    })
  }

  toReactFlow(pair: [BoxNode, Edge[]]): Promise<NodesAndEdges> {
    let [node, edges] = pair;

    // TODO
    return Promise.resolve({
      nodes: new Map(),
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
    return {
      ... node,
      payload: {
        x: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: 0, max: Infinity } }),
        y: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: 0, max: Infinity } }),
        width: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: NODE_WIDTH, max: NODE_WIDTH } }),
        height: new Cell(partialSemigroupNumericRange(), { kind: 'Known', value: { kind: 'Range', min: NODE_HEIGHT, max: NODE_HEIGHT } }),
      },
      children: node.children.map(child => this.makeInitialBoundingBoxConstraint(child)),
      subgraph: node.subgraph ? node.subgraph.map(subgraphNode => this.makeInitialBoundingBoxConstraint(subgraphNode)) : []
    }
  }

  private makeConstraints(node: BoxNode): void {
    if (node.kind === 'Transpose') {
      if (node.subgraph) {
        contains(RecursiveBoxEngine.SUBTREE_PADDING, node.payload, node.subgraph.map(subgraphNode => subgraphNode.payload))

        node.subgraph.map(subgraphNode => this.makeConstraints(subgraphNode))
      }
    }

    // node is above its children
    node.children.map(child =>
      above(RecursiveBoxEngine.VERTICAL_PADDING, node.payload, child.payload))

    node.children.map(child => this.makeConstraints(child))
  }

  // private centerLayout(node: BoxNode): AppNode[] {
  //   return []
  // }

  // private computeLayout(node: BoxNode): AppNode[] {
  //   // TODO
  //   return []
  // }

  // // // We put the root node at (0,0). This is adjusted by centerLayout later.
  // // private computeBoundingBox(node: SemanticNode<void>): BoxNode {
  // //   const dimensions = this.computeDimensions(node)

  // //   // TODO
  // //   return node
  // // }

  // private computeDimensions<A>(node: SemanticNode<A>): SemanticNode<Dimensions> {
  //   let childrenDims = node.children.map(child => this.computeDimensions(child))

  //   if (!node.subgraph) {
  //     return {
  //       ...node,
  //       payload: { width: NODE_WIDTH, height: NODE_HEIGHT },
  //       subgraph: [],
  //       children: childrenDims
  //     }
  //   }

  //   if (node.subgraph?.length == 0) {
  //     return {
  //       ...node,
  //       payload: { width: NODE_WIDTH, height: NODE_HEIGHT },
  //       subgraph: [],
  //       children: childrenDims
  //     }
  //   }

  //   let width = Math.max(...childrenDims.map(dim => dim.payload.width)) + RecursiveBoxEngine.HORIZONTAL_PADDING
  //   let height = childrenDims.reduce((acc, dim) => acc + dim.payload.height, 0) + RecursiveBoxEngine.VERTICAL_PADDING

  //   return {
  //     ...node,
  //     payload: { width, height },
  //     subgraph: [], // TODO
  //     children: childrenDims
  //   }
  // }
}
