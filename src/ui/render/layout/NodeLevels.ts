import { SemanticNode } from "../../../ir/SemanticGraph"

export type IndexedNode =
  { nodeId: string,
    level: number,
    breadthIndex: number,
  }

export type LevelMap = Map<number, string[]>
export type BreadthIndexMap = Map<string, number>

export type NodePair = {
  nodeId1: string
  nodeId2: string
}

export function indexedNodePairs(node: IndexedNode[]): [IndexedNode, IndexedNode][] {
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

export function makeEdgeKey(nodeId1: string, nodeId2: string): string {
  return nodeId1 + '-' + nodeId2
}

export function computeIndexedNodes(n: SemanticNode<void>): [LevelMap, BreadthIndexMap, IndexedNode[]] {
  let result = new Array<IndexedNode>()

  let levelMap: LevelMap = new Map<number, string[]>()
  let breadthIndexMap: BreadthIndexMap = new Map<string, number>()

  // TODO: Is using an array here a performance bottleneck?
  let queue: SemanticNode<void>[] = [n]
  let marked = new Set<string>()

  for (let level = 0; true; ++level) {
    levelMap.set(level, queue.map((node: SemanticNode<void>) => node.id!))

    for (let i = 0; i < queue.length; i++) {
      marked.add(queue[i]!.id)

      breadthIndexMap.set(queue[i]!.id!, i)

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

  return [levelMap, breadthIndexMap, result]
}
