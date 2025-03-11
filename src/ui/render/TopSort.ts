// Topologically sort the node map, since parents must be
// before children

import { AppNode } from '../components/Nodes/nodeTypes';

export function topSortNodes(nodeMap: Map<string, AppNode>): AppNode[] {
  let remainingIds: Set<string> = new Set(nodeMap.keys())
  let result: AppNode[] = []

  while (remainingIds.size > 0) {
    let currentId = remainingIds.values().next().value

    let origCurrentId = currentId!

    while (currentId) {
      let current = nodeMap.get(currentId)!

      remainingIds.delete(currentId)

      if (current.parentId && remainingIds.has(current.parentId)) {
        currentId = current.parentId
      } else {
        break
      }
    }

    result.push(nodeMap.get(origCurrentId)!)
  }

  return result
}
