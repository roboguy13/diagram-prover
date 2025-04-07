// Topologically sort the node map, since parents must be
// before children

import { ApplicationNode } from '../../components/Nodes/nodeTypes';

export function topSortNodes(nodeMap: Map<string, ApplicationNode>): ApplicationNode[] {
  let remainingIds: Set<string> = new Set(nodeMap.keys())
  let result: ApplicationNode[] = []

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
