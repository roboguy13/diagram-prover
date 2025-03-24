// This is for visualizing propagator networks themselves.

import { ElkNode, ElkExtendedEdge } from "elkjs";
import { CellRef, PropagatorDescription, PropagatorNetwork } from "./Propagator";
import { NODE_HEIGHT, NODE_WIDTH } from "../../ui/Config";
import { Edge } from "reactflow";

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '50',
  'elk.padding': '[top=25,left=25,bottom=25,right=25]',
  'elk.spacing.componentComponent': '40',
  'elk.spacing.edgeNode': '25',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.randomizationSeed': '1'
};

// const elkOptions = {
//   'elk.algorithm': 'stress',  // Try stress algorithm which works well for large graphs
//   'elk.spacing.nodeNode': '80',
//   'elk.padding': '[top=50, left=50, bottom=50, right=50]',
//   'elk.spacing.componentComponent': '100',
//   'elk.spacing.edgeNode': '40',
//   'elk.stress.desiredEdgeLength': '200',  // Longer edges for better spacing
//   'elk.randomizationSeed': '1'
// }

// const elkOptions = {
//   'elk.algorithm': 'stress',
//   'elk.direction': 'DOWN',
//   'elk.spacing.nodeNode': '50',
//   'elk.layered.spacing.nodeNodeBetweenLayers': '100',
//   'elk.padding': '[top=25, left=25, bottom=25, right=25]',
//   'elk.spacing.componentComponent': '40',
//   'elk.spacing.edgeNode': '25',
//   'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
//   'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
//   'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
//   'elk.layered.aspectRatio': '2.0',
//   'elk.layered.spacing.baseValue': '40',
//   // Increase the size allotted for the layout
//   'elk.aspectRatio': '1.5',
//   // Force a minimum size for the layout area
//   'elk.randomizationSeed': '1'
// }

// const elkOptions = {
//   'elk.algorithm': 'force',
//   'elk.spacing.nodeNode': '30',
//   'elk.padding': '[top=25, left=25, bottom=25, right=25]',
//   'elk.spacing.componentComponent': '40',
//   'elk.spacing.edgeNode': '25',
// }

export function propagatorNetworkToElkNode<A>(net: PropagatorNetwork<A>): ElkNode {
  let elkList = propagatorNetworkToElkNodeList(net)
  let edges = elkList.flatMap(node => node.edges).filter(edge => edge !== undefined) as ElkExtendedEdge[]

  return {
    id: 'root-node',
    children: elkList,
    layoutOptions: elkOptions,
    edges,
    // width: 2000,  // Force a wide layout
    // height: 2000  // Force a tall layout
  }
}

function propagatorNetworkToElkNodeList<A>(net: PropagatorNetwork<A>): ElkNode[] {
  return net.propagatorConnections
            .map(propagatorDescriptionToElkNode(net))
            .concat(net.getCellRefs().map(cellToElkNode(net)))
}

function propagatorDescriptionToElkNode<A>(net: PropagatorNetwork<A>) { return (propagator: PropagatorDescription): ElkNode => {
    let propagatorId = newPropagatorId()
    let outputEdges = 
      propagator.outputs.map(cellToElkNode(net)).map((output): ElkExtendedEdge => ({
        id: `edge-${propagatorId}-${output.id}`,
        sources: [output.id],
        targets: [propagatorId],
      }))

    let inputEdges =
      propagator.inputs.map(cellToElkNode(net)).map((input): ElkExtendedEdge => ({
        id: `edge-${input.id}-${propagatorId}`,
        sources: [propagatorId],
        targets: [input.id],
      }))

    return {
      id: propagatorId,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      // layoutOptions: elkOptions,
      labels: [{ text: 'propagator-node' }, { text: propagator.description }],
      edges: outputEdges.concat(inputEdges),
    }
  }
}

function cellToElkNode<A>(net: PropagatorNetwork<A>) { return (cell: CellRef): ElkNode => {
    return {
      id: makeCellRefId(cell),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      // layoutOptions: elkOptions,
      labels: [{ text: 'propagator-cell-node' }, { text: net.cellDescription(cell) }],
    }
  }
}

let propagatorId = 0

function makeCellRefId(cell: CellRef): string {
  return `cell-${cell}`
}

function newPropagatorId(): string {
  const id = `propagator-${propagatorId}`
  propagatorId++
  return id
}
