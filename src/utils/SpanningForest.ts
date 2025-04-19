export type GraphEdge<V> = {
  source: V;
  target: V;
}

export type Graph<V> = {
  vertices: V[];
  edges: GraphEdge<V>[];
}

export function spanningForest<V>(graph: Graph<V>): Set<GraphEdge<V>> {
  const visited = new Set<V>();
  const forestEdges = new Set<GraphEdge<V>>();

  for (const vertex of graph.vertices) {
    if (!visited.has(vertex)) {
      dfsVisit(graph, vertex, visited, forestEdges);
    }
  }

  return forestEdges
}

function dfsVisit<V>(graph: Graph<V>, vertex: V, visited: Set<V>, forestEdges: Set<GraphEdge<V>>) {
  visited.add(vertex);

  const neighbors = getNeighbors(graph.edges, vertex);

  for (const pair of neighbors) {
    const [neighbor, edge] = pair;
    if (!visited.has(neighbor)) {
      forestEdges.add(edge);
      dfsVisit(graph, neighbor, visited, forestEdges);
    }
  }
}

export function getNeighbors<V>(edges: GraphEdge<V>[], vertex: V): [V, GraphEdge<V>][] {
  const neighbors = new Set<[V, GraphEdge<V>]>();

  for (const edge of edges) {
    if (edge.source === vertex) {
      neighbors.add([edge.target, edge]);
    } else if (edge.target === vertex) {
      neighbors.add([edge.source, edge]);
    }
  }

  return Array.from(neighbors);
}
