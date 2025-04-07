/**
 * Performs a Breadth-First Search on a graph (potentially a forest)
 * starting from specified roots, determining the layer (depth) of each node
 * and the nodes belonging to each layer. Handles DAGs by assigning nodes
 * to the shallowest layer they are encountered in.
 *
 * @template T The type of the node identifier (e.g., string for nodeId).
 * @param roots An array of the starting nodes (roots of the forest components).
 * @param getChildren A function that returns an array of children for a given node.
 * @returns An object containing:
 * - layers: Map<number, T[]> (Layer number -> ordered array of nodes in that layer)
 * - nodeLayer: Map<T, number> (Node -> its assigned layer number)
 */
export function determineLayers<T>(
    roots: T[],
    getChildren: (node: T) => T[]
): { layers: Map<number, T[]>, nodeLayer: Map<T, number> } {
    const layers = new Map<number, T[]>();
    const nodeLayer = new Map<T, number>();
    const visited = new Set<T>(); // To handle DAGs correctly
    let queue: T[] = [...roots]; // Start queue with all roots
    let currentLayer = 0;

    // Mark initial roots as visited
    queue.forEach(root => visited.add(root));

    while (queue.length > 0) {
        const nextQueue: T[] = [];
        const currentLayerNodes: T[] = []; // Nodes for the current layer

        // Process all nodes currently in the queue (they belong to currentLayer)
        for (const node of queue) {
            // Assign layer and add to the ordered list for this layer
            nodeLayer.set(node, currentLayer);
            currentLayerNodes.push(node);

            // Find children for the next layer
            const children = getChildren(node);
            for (const child of children) {
                // Only process/enqueue a child if it hasn't been visited yet
                // This ensures nodes get assigned the minimum possible layer depth
                if (!visited.has(child)) {
                    visited.add(child);
                    nextQueue.push(child);
                }
            }
        }

        // Store the ordered list of nodes for the current layer
        if (currentLayerNodes.length > 0) {
            layers.set(currentLayer, currentLayerNodes);
        }

        // Move to the next layer
        queue = nextQueue;
        currentLayer++;
    }

    return { layers, nodeLayer };
}
