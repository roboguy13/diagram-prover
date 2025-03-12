// // See these for options:
// // - https://www.eclipse.org/elk/reference/algorithms.html
// // - https://www.eclipse.org/elk/reference/options.html
// export const elkOptions = {
//   // 'elk.algorithm': 'mrtree',
//   'elk.algorithm': 'layered',
//   'elk.layered.spacing.nodeNodeBetweenLayers': '80',
//   'elk.spacing.nodeNode': '30',
//   // 'elk.padding': '[top=10,left=10,bottom=10,right=10]',
//   // 'elk.insideEdgeRouting': 'ORTHOGONAL',
//   'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
//   'elk.direction': 'DOWN',
//   'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
//   "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX"
//   // 'elk.contentAlignment': 'H_LEFT V_CENTER',
// };

export const elkOptions = {
  'elk.algorithm': 'mrtree',
  'elk.direction': 'DOWN',
  // 'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '30',
  'elk.padding': '[top=25, left=25, bottom=25, right=25]',
  'elk.spacing.componentComponent': '40',
  'elk.spacing.edgeNode': '25',
  // 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // 'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.topdown.strategy': 'SEPARATE_CHILDREN',
  'elk.nodeSize.options': 'UNIFORM_PORT_SPACING',
  // "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  // "elk.layered.crossingMinimization.semiInteractive": "true",
  // "elk.layered.layering.strategy": "INTERACTIVE",
  // "elk.portConstraints": "FIXED_ORDER",
};