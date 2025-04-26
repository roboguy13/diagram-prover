import { Edge, Node } from "@xyflow/react";
import { EdgeRouter } from "./EdgeRouter";
import { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs";
import { NodeId } from "../../../ir/StringDiagram";
import { elk } from "../layout/elk/ElkEngine";

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.stress.fixed': 'true',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.padding': '[top=10, bottom=10, left=10, right=10]',
  'elk.spacing.nodeNode': '20',
  'elk.spacing.edgeEdge': '20',
}

export class ElkRouter implements EdgeRouter {
  async route(nodes: Node[], edges: Edge[]): Promise<Edge[]> {
    const roots = getRoots(nodes);
    const childMap = nodeChildren(new Map(nodes.map(node => [node.id, node])));
    const elkEdgeMap = makeElkEdgeMap(edges);
    const elkNodes = roots.map(node => nodeToElkNode(elkEdgeMap, childMap, node));

    const topElkNode = {
      id: "top",
      children: elkNodes,
    }

    const layout = await elk.layout(topElkNode, {
      layoutOptions
    })

    const newEdges = layout.edges

    if (!newEdges) {
      throw new Error('No edges in layout');
    }

    const finishedEdges = newEdges.map(edge => elkEdgeToEdge(edge));

    return finishedEdges
  }
}

type ChildMap = Map<NodeId, Node[]>;
type EdgeMap = Map<NodeId, Edge[]>;
type ElkEdgeMap = Map<NodeId, ElkExtendedEdge[]>;

function getRoots(nodes: Node[]): Node[] {
  const roots: Node[] = [];

  for (const node of nodes) {
    if (!node.parentId) {
      roots.push(node);
    }
  }

  return roots;
}

function nodeToElkNode(edgeMap: ElkEdgeMap, childMap: ChildMap, node: Node): ElkNode {
  const width = node.data['width'] as number
  const height = node.data['height'] as number

  if (!width) {
    throw new Error(`Node ${node.id} has no width`);
  }

  if (!height) {
    throw new Error(`Node ${node.id} has no height`);
  }

  return {
    id: node.id,
    width,
    height,
    children: childMap.get(node.id) || [],
    labels: [],
    edges: edgeMap.get(node.id) || [],
    ports: getPorts(node),
    layoutOptions
  };
}

function nodeChildren(nodeMap: Map<NodeId, Node>): ChildMap {
  const childMap: ChildMap = new Map();

  for (const [id, node] of nodeMap) {
    const parentId = node.parentId

    if (parentId) {
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(node);
    }
  }

  return childMap;
}

function nodeEdges(edges: Edge[]): EdgeMap {
  const edgeMap: EdgeMap = new Map();

  for (const edge of edges) {
    const sourceId = edge.source;

    if (!edgeMap.has(sourceId)) {
      edgeMap.set(sourceId, []);
    }

    edgeMap.get(sourceId)!.push(edge);
  }

  return edgeMap;
}

function makeElkEdgeMap(edges: Edge[]): ElkEdgeMap {
  const edgeMap: ElkEdgeMap = new Map();

  for (const edge of edges) {
    const sourceId = edge.source;

    if (!edgeMap.has(sourceId)) {
      edgeMap.set(sourceId, []);
    }

    const elkEdge = edgeToElkEdge(edge);
    if (!elkEdge) {
      continue
    }
    edgeMap.get(sourceId)!.push(elkEdge);
  }

  return edgeMap;
}

function edgeToElkEdge(edge: Edge): ElkExtendedEdge | null {
  const elkSourceId = getElkPortId(edge.source, edge.sourceHandle || '');
  const elkTargetId = getElkPortId(edge.target, edge.targetHandle || '');

  if (!elkSourceId || !elkTargetId) {
    console.warn(`Edge ${edge.id} has no source or target`);
    return null;
  }

  return {
    id: edge.id,
    sources: [elkSourceId],
    targets: [elkTargetId],
  };
}

function elkEdgeToEdge(edge: ElkExtendedEdge): Edge {
  const sourcePort = edge.sources[0];
  const targetPort = edge.targets[0];

  if (!sourcePort || !targetPort) {
    throw new Error(`Edge ${edge.id} has no source or target`);
  }

  const { nodeId: sourceNodeId, handleId: sourceHandleId } = fromElkPortId(sourcePort);
  const { nodeId: targetNodeId, handleId: targetHandleId } = fromElkPortId(targetPort);

  return {
    id: edge.id,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: sourceHandleId,
    targetHandle: targetHandleId,
  }
}

function fromElkPortId(elkPortId: string): { nodeId: NodeId, handleId: string } {
  const [nodeId, handleId] = elkPortId.split(':');
  if (!nodeId || !handleId) {
    throw new Error(`Invalid elk port id: ${elkPortId}`);
  }
  return { nodeId: nodeId as NodeId, handleId };
}

function getElkPortId(nodeId: NodeId, handleId: string): string {
  return `${nodeId}:${handleId}`;
}
function getPorts(node: Node): ElkPort[] {
  const ports: ElkPort[] = [];
  const nodeData = node.data || {}; // Ensure nodeData exists

  // Use inputPortIds and outputPortIds from node.data
  const inputPortIds = (nodeData['inputPortIds'] || []) as string[];
  const outputPortIds = (nodeData['outputPortIds'] || []) as string[];

  // Create ELK ports for inputs (typically on top)
  inputPortIds.forEach((handleId, index) => {
    if (!handleId) {
      console.warn(`Node ${node.id} has an undefined input handle at index ${index}`);
      return;
    }
    const elkPortId = getElkPortId(node.id, handleId);
    console.log(`Creating ELK port for input handle: ${elkPortId}`);
    ports.push({
      id: elkPortId,
      width: 0, // Ports usually have zero dimensions for ELK
      height: 0,
      labels: [],
      layoutOptions: {
        'port.side': 'NORTH', // Place input ports on the top side
        'port.index': `${index}` // Maintain order
        // 'portAlignment.north': 'DISTRIBUTED' // Or other alignment as needed
      }
    });
  });

  // Create ELK ports for outputs (typically on bottom)
  outputPortIds.forEach((handleId, index) => {
    if (!handleId) {
      console.warn(`Node ${node.id} has an undefined output handle at index ${index}`);
      return;
    }
    const elkPortId = getElkPortId(node.id, handleId);
    ports.push({
      id: elkPortId,
      width: 0,
      height: 0,
      labels: [],
      layoutOptions: {
        'port.side': 'SOUTH', // Place output ports on the bottom side
        'port.index': `${index}` // Maintain order
        // 'portAlignment.south': 'DISTRIBUTED' // Or other alignment as needed
      }
    });
  });
  return ports;
}
