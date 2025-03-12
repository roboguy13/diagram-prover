
export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 40;

// See these for options:
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
export const elkOptions = {
  // 'elk.algorithm': 'mrtree',
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
  'elk.padding': '[top=10,left=10,bottom=10,right=10]',
  'elk.insideEdgeRouting': 'ORTHOGONAL',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
};
