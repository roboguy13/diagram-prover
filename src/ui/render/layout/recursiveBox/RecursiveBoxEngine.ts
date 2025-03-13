//
// Strategy:
//   1. Level order traversal to get the levels and breadth indices of the nodes
//
//   2. Create a propagator network where each cell represents the vertical or horizontal
//      spacing between a pair of nodes
//
//   3. The propagator network generates a collection of ranges for each spacing
//
//   4. We traverse the tree and use these spacing ranges to determine the actual positions
//      of each node
//

import { getEdges, getImmediateEdges, SemanticNode } from "../../../../ir/SemanticGraph";
import { AppNode, GroupedNode, TermNode } from "../../../components/Nodes/nodeTypes";
import { NODE_HEIGHT, NODE_WIDTH } from "../../../Config";
import { LayoutEngine, NodeMap, NodesAndEdges } from "../LayoutEngine";
import { BoxNode, Dimensions } from "./BoxNode";
import { RegionConstraint, RegionConstraintCalculator, getRegionPosition } from "./Region";

import { Cell, known, unknown } from '../../../../constraint/propagator/Propagator'
import { addNumericRange, atLeast, atMost, between, exactly, getMin, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange";
import { Edge, XYPosition } from "@xyflow/react";
import { addPropagator } from "../../../../constraint/propagator/Arithmetic";
import { eqPartialSemigroup } from "../../../../constraint/propagator/PartialSemigroup";
import { get } from "lodash";

type IndexedNode =
  { nodeId: string,
    level: number,
    breadthIndex: number,
  }

type InternalRep = [SemanticNode<void>, [LevelMap, IndexedNode[]], Edge[]]

export class RecursiveBoxEngine implements LayoutEngine<InternalRep> {
  private static readonly VERTICAL_PADDING = 50;
  private static readonly HORIZONTAL_PADDING = 70;

  private static readonly SUBTREE_PADDING = this.HORIZONTAL_PADDING;
  
  private static readonly MAX_WIDTH = 800;
  private static readonly MAX_HEIGHT = 500;

  private static readonly regionCalc = new RegionConstraintCalculator(
    { kind: 'Range', min: 0, max: RecursiveBoxEngine.MAX_WIDTH },
    { kind: 'Range', min: 0, max: RecursiveBoxEngine.MAX_HEIGHT },
    0, 0
  )

  fromSemanticNode(n: SemanticNode<void>): Promise<InternalRep> {
    return new Promise<InternalRep>((resolve, _reject) => {
      let ixNodes = computeIndexedNodes(n)

      let edges = getEdges(n)

      resolve([n, ixNodes, edges])
    })
  }

  toReactFlow(pair: InternalRep): Promise<NodesAndEdges> {
    // TODO: Put all of the actual processing into fromSemanticNode
    let [semNode, [levelMap, ixNodes], edges] = pair

    let constraints = this.initializeConstraints(ixNodes)
    this.computeConstraints(constraints)

    let appNodes = new Map<string, AppNode>()
    
    this.constraintsToAppNodes(semNode, { x: 0, y: 0 }, 0, levelMap, constraints, appNodes)

    // TODO
    return Promise.resolve({
      nodes: appNodes,
      edges
    })
  }

  private constraintsToAppNodes(currentNode: SemanticNode<void>, currentPos: XYPosition, currentLevel: number, levelMap: LevelMap, constraints: NodePairConstraintMap, result: Map<string, AppNode>): void {
    let currAppNode = result.get(currentNode.id)

    result.set(currentNode.id, {
      // ...currAppNode,
      type: 'term',
      data: {
        label: currentNode.label ?? '',
        isActiveRedex: false,
        outputCount: 1,
        inputCount: getImmediateEdges(currentNode).length,
      },
      position: currentPos,
      id: currentNode.id,
    })

    currentNode.children.forEach((child, index) => {
      let constraint = lookupNodePair(currentNode.id, child.id, constraints)

      let newX = currentPos.x + getMin(constraint.spacingConstraint.x.readKnownOrError('constraintsToAppNodes'))
      let newY = currentPos.y + getMin(constraint.spacingConstraint.y.readKnownOrError('constraintsToAppNodes'))

      let cousins = levelMap.get(currentLevel)
      for (let i = 0; i < cousins!.length; i++) {
        if (cousins![i] !== child.id) {
          let constraint = lookupNodePair(cousins![i]!, child.id, constraints)

          let childBreadthIndex = child.id === constraint.node1!.nodeId ? constraint.node1!.breadthIndex : constraint.node2!.breadthIndex
          let cousinBreadthIndex = cousins![i] === constraint.node1!.nodeId ? constraint.node1!.breadthIndex : constraint.node2!.breadthIndex

          if (cousinBreadthIndex < childBreadthIndex) {
            newX += getMin(lookupNodePair(cousins![i]!, child.id, constraints).spacingConstraint.x.readKnownOrError('constraintsToAppNodes')) + RecursiveBoxEngine.SUBTREE_PADDING
          }
        }
      }

        // newX += getMin(prevConstraint.spacingConstraint.x.readKnownOrError('constraintsToAppNodes')) + RecursiveBoxEngine.SUBTREE_PADDING
      // }

      this.constraintsToAppNodes(child, { x: newX, y: newY }, currentLevel+1, levelMap, constraints, result)
    })
  }

  private initializeConstraints(nodes: IndexedNode[]): NodePairConstraintMap {
    let result: NodePairConstraintMap = new Map<string, NodePairConstraint>()

    let pairs = indexedNodePairs(nodes)

    for (let i = 0; i < pairs.length; i++) {
      let [node1, node2] = pairs[i]!

      result.set(makeEdgeKey(node1.nodeId, node2.nodeId), {
        node1: node1,
        node2: node2,
        spacingConstraint:
          { x: new Cell<NumericRange>(partialSemigroupNumericRange(), known(between(0, RecursiveBoxEngine.MAX_WIDTH))),
            y: new Cell<NumericRange>(partialSemigroupNumericRange(), known(between(0, RecursiveBoxEngine.MAX_HEIGHT)))
          }
      })
    }

    return result
  }

  private computeConstraints(nodePairConstraints: NodePairConstraintMap): void {
    nodePairConstraints.forEach((value: NodePairConstraint, key: string) => {
      let node1 = value.node1!
      let node2 = value.node2!

      if (node1.level === node2.level) {
        // Siblings or cousins
        console.log('siblings or cousins: ', node1, node2)
        value.spacingConstraint.y.write(known(exactly(0)))
        value.spacingConstraint.x.write(known(between(NODE_WIDTH + RecursiveBoxEngine.HORIZONTAL_PADDING, Infinity)))
      } else {
        // One node is an ancestor of the other node
        value.spacingConstraint.y.write(known(between(NODE_HEIGHT + RecursiveBoxEngine.VERTICAL_PADDING, Infinity)))
      }
    })
  }
}

function lookupNodePair(nodeId1: string, nodeId2: string, map: NodePairConstraintMap): NodePairConstraint {
  let a = map.get(makeEdgeKey(nodeId1, nodeId2))!

  if (a) {
    return a
  } else {
    let b = map.get(makeEdgeKey(nodeId2, nodeId1))
    if (b) {
      return b
    } else {
      throw new Error('No node pair constraint found for ' + nodeId1 + ' and ' + nodeId2)
    }
  }
}

type LevelMap = Map<number, string[]>

type NodePairConstraintMap = Map<string, NodePairConstraint>

type NodePairConstraint = {
  node1: IndexedNode,
  node2: IndexedNode,
  spacingConstraint: RegionConstraint
}

type NodePair = {
  nodeId1: string
  nodeId2: string
}

function indexedNodePairs(node: IndexedNode[]): [IndexedNode, IndexedNode][] {
  let result: [IndexedNode, IndexedNode][] = []

  console.log('node length: ', node.length)

  for (let i = 0; i < node.length; i++) {
    for (let j = 0; j < node.length; j++) {
      if (i !== j) {
        result.push([node[i]!, node[j]!])
      }
    }
  }

  console.log('result: ', result)

  return result
}

function makeEdgeKey(nodeId1: string, nodeId2: string): string {
  return nodeId1 + '-' + nodeId2
}

function computeIndexedNodes(n: SemanticNode<void>): [LevelMap, IndexedNode[]] {
  let result = new Array<IndexedNode>()

  let levelMap: LevelMap = new Map<number, string[]>()

  // TODO: Is using an array here a performance bottleneck?
  let queue: SemanticNode<void>[] = [n]
  let marked = new Set<string>()

  for (let level = 0; true; ++level) {
    levelMap.set(level, queue.map((node: SemanticNode<void>) => node.id!))

    for (let i = 0; i < queue.length; i++) {
      marked.add(queue[i]!.id)

      result.push({
        nodeId: queue[i]!.id,
        level: level,
        breadthIndex: i
      })
    }

    let newQueue: SemanticNode<void>[] = []
    for (let i = 0; i < queue.length; ++i) {
      let v = queue[i]!

      for (let j = 0; j < v.children.length; j++) {
        if (v.children[j]!.id && !marked.has(v.children[j]!.id)) {
          newQueue.push(v.children[j]!)
        }
      }
    }

    if (newQueue.length === 0) {
      break
    }

    queue = newQueue
  }

  return [levelMap, result]
}
