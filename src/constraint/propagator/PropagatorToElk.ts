// This is for visualizing propagator networks themselves.

import { ElkNode, ElkExtendedEdge } from "elkjs";
import { CellRef, Conflict, Content, printContent, PropagatorDescription, PropagatorNetwork } from "./Propagator";
import { PROPAGATOR_CELL_NODE_HEIGHT, PROPAGATOR_CELL_NODE_WIDTH, PROPAGATOR_NODE_HEIGHT, PROPAGATOR_NODE_WIDTH } from "../../ui/Config";
import { Edge } from "reactflow";
import { elk } from "../../ui/render/layout/elk/ElkEngine";
import { ElkColorLabel, ElkNoHandlesLabel } from "../../ui/render/layout/elk/ElkData";
import { last } from "lodash";

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '100',
  'elk.padding': '[top=25,left=25,bottom=25,right=25]',
  'elk.spacing.componentComponent': '40',
  'elk.spacing.edgeNode': '25',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.randomizationSeed': '1'
};

export function conflictToElkNode<A>(aPrinter: (a: A) => string, net: PropagatorNetwork<A>, conflict: Conflict<A>): ElkNode {
  let elkList = conflictToElkNodeList(net, conflict)
  let contentIds: [string, Content<A>][] = elkList.map(([node, content]) => [node.id, content])
  let cellNode = cellToElkNode(net)(conflict.cell)
  let nodes = elkList.map(([node, _content]) => node).concat([cellNode])

  let lastNode0 = propagatorDescriptionToElkNode(net)(conflict.propagator2)
  let lastNode = { ...lastNode0, edges: [] }
  let lastEdge0 = createEdge(aPrinter, cellNode, [lastNode.id, conflict.newContent])
  let lastEdge: ElkExtendedEdge =
    { ... lastEdge0,
      labels: (lastEdge0.labels || []).concat([new ElkColorLabel('red')])
    }

  let secondToLastNode0 = propagatorDescriptionToElkNode(net)(conflict.propagator1)
  let secondToLastNode = { ...secondToLastNode0, edges: [] }
  let secondToLastEdge0 = createEdge(aPrinter, cellNode, [secondToLastNode.id, conflict.oldContent])
  let secondToLastEdge: ElkExtendedEdge =
    { ... secondToLastEdge0,
      labels: (secondToLastEdge0.labels || []).concat([new ElkColorLabel('cornflowerblue')])
    }

  return {
    id: 'root-node',
    children: nodes.concat([secondToLastNode, lastNode]),
    layoutOptions: elkOptions,
    edges: contentIds.map((pair) => {
      let [id, content] = pair
      let theEdge = createEdge(aPrinter, cellNode, [id, content])
      return theEdge
    }).concat([secondToLastEdge, lastEdge])
    // edges:
    //   [ { id: 'edge-1', labels: [ { text: printContent(aPrinter)(conflict.oldContent) } ], sources: [elkList[0]!.id], targets: [elkList[1]!.id] },
    //     { id: 'edge-2', labels: [ { text: printContent(aPrinter)(conflict.newContent) } ], sources: [elkList[2]!.id], targets: [elkList[0]!.id] }
    //   ],
  }
}

function createEdge<A>(aPrinter: (a: A) => string, cellNode: ElkNode, pair: [string, Content<A>]): ElkExtendedEdge {
  let [propagatorId, content] = pair

  // Create an edge from the cell node to the propagator node
  let labelText = printContent(aPrinter)(content)
  let edgeId = `edge-${cellNode.id}-${propagatorId}` // Unique edge ID based on cell and propagator description

  return {
    id: edgeId,
    sources: [cellNode.id],
    targets: [propagatorId],
    labels: [{ text: labelText }]
    // labels: [{ text: labelText }, new ElkNoHandlesLabel()]
  }
}

export function conflictToElkNodeList<A>(net: PropagatorNetwork<A>, conflict: Conflict<A>): [ElkNode, Content<A>][] {
  return conflict.allWrites.map((val) => {
    // For each write in the conflict, we will create an ElkNode for the cell and the propagator
    let [propagator, content] = val // This is a tuple of the propagator description and its content
    let propagatorNode = propagatorDescriptionToElkNode(net)(propagator) // Convert the propagator description to an ElkNode
    return [{ ... propagatorNode, edges: []}, content] // Return a tuple of the ElkNode and its content
  })

  // return 
  // let cellNode = cellToElkNode(net)(conflict.cell)
  // let propagatorNode1 = propagatorDescriptionToElkNode(net)(conflict.propagator1)
  // let propagatorNode2 = propagatorDescriptionToElkNode(net)(conflict.propagator2)

  // let otherPropagators = conflict.allWrites.map((val) => propagatorDescriptionToElkNode(net)(val[0]))
  // let otherPropagatorNodes = otherPropagators.map((node) => { return { ... node, edges: [] } })

  // return [cellNode, { ... propagatorNode1, edges: [] }, { ... propagatorNode2, edges: [] }]
  // // return [cellNode].concat(otherPropagatorNodes)
}

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
      width: PROPAGATOR_NODE_WIDTH,
      height: PROPAGATOR_NODE_HEIGHT,
      // layoutOptions: elkOptions,
      labels: [{ text: 'propagator-node' }, { text: propagator.description }],
      // labels: [{ text: 'propagator-node' }, { text: propagator.description }, new ElkNoHandlesLabel()],
      edges: outputEdges.concat(inputEdges),
    }
  }
}

function cellToElkNode<A>(net: PropagatorNetwork<A>) { return (cell: CellRef): ElkNode => {
    return {
      id: makeCellRefId(cell),
      width: PROPAGATOR_CELL_NODE_WIDTH,
      height: PROPAGATOR_CELL_NODE_HEIGHT,
      // layoutOptions: elkOptions,
      labels: [{ text: 'propagator-cell-node' }, { text: net.cellDescription(cell) }],
      // labels: [{ text: 'propagator-cell-node' }, { text: net.cellDescription(cell) }, new ElkNoHandlesLabel()],
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
