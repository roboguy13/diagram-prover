import { ElkNode } from 'elkjs'
import { AppNode, GroupedNode, PropagatorCellNode, PropagatorNode, TermNode } from '../../../components/Nodes/nodeTypes'

import { Edge } from '@xyflow/react'
import { inputHandleName, outputHandleName } from '../../../NodeUtils'
import { calculateGroupBounds } from '../../../components/Nodes/GroupedNode/GroupedNodeComponent'
import { NODE_HEIGHT, NODE_WIDTH } from '../../../Config'
import { NodesAndEdges } from '../LayoutEngine'
import { ElkColorLabel, ElkNoHandlesLabel } from './ElkData'
import { FloatingEdge } from '../../../components/Edges/FloatingEdge'

export function elkToReactFlow(elkRoot: ElkNode): NodesAndEdges {
  const nodes = (elkRoot.children || []).flatMap(child => flattenElkNodes(child));
  
  // Deduplicate edges using a Map with edge ID as key
  const edgeMap = new Map<string, Edge>();
  collectElkEdges(elkRoot).forEach(edge => {
    console.log('edge type: ', edge.id, edge.type);
    // Convert ELK extended edge to React Flow edge
    const flowEdge: Edge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      style: edge.style || {},
      sourceHandle: edge.sourceHandle || outputHandleName(0),
      targetHandle: edge.targetHandle || inputHandleName(0),
      type: edge.type || 'default',
    };
    
    edgeMap.set(flowEdge.id, flowEdge);
  });
  
  const edges = Array.from(edgeMap.values());
  const nodeMap = buildNodeMap(nodes);
  
  console.log('nodeMap: ', nodeMap);
  console.log('edges: ', edges);
  
  return { nodes: nodeMap, edges: edges };
}

function buildNodeMap(nodes: AppNode[]): Map<string, AppNode> {
  const nodeMap = new Map<string, AppNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  return nodeMap;
}

function flattenElkNodes(node: ElkNode, parentId?: string): AppNode[] {
  const kindLabel = node.labels ? node.labels[0] : { text: '' };
  const theLabel = node.labels ? node.labels[1] : { text: '' };

  const label = theLabel?.text ? theLabel.text : '';

  switch (kindLabel!.text) {
    case 'propagator-node': {
      const current: PropagatorNode = {
        id: node.id,
        data: { label },
        type: 'propagator',
        position: { x: node.x || 0, y: node.y || 0 },
        ...parentId && { parentId: parentId, extent: 'parent' },
      }
      return [current];
    }

    case 'propagator-cell-node': {
      const current: PropagatorCellNode = {
        id: node.id,
        data: { label },
        type: 'propagator-cell',
        position: { x: node.x || 0, y: node.y || 0 },
        ...parentId && { parentId: parentId, extent: 'parent' },
      }
      return [current];
    }

    case 'Transpose': {
      const children = (node.children || []).flatMap(child => flattenElkNodes(child, node.id));

      console.log('children: ', children);

      const bounds = calculateGroupBounds(children.map(child => ({ width: child.width!, height: child.height! })));

      const current: GroupedNode = {
        id: node.id,
        data: { label },
        type: 'grouped',
        position: { x: node.x || 0, y: node.y || 0 },
        width: bounds.width,
        height: bounds.height,
        ...parentId && { parentId: parentId, extent: 'parent' },
      }
      return [current, ...children];
    }
    default: //case 'Regular':
      const children = (node.children || []).flatMap(child => flattenElkNodes(child));

      console.log('parentId: ', parentId);

      const current: TermNode = {
        id: node.id,
        type: 'term',
        // data: { label, inputCount: 1, outputCount: (node.edges?.length || 0), isActiveRedex: false },
        data: { label, outputCount: 1, inputCount: (node.edges?.length || 0), isActiveRedex: false },
        position: { x: node.x || 0, y: node.y || 0 },
        ...parentId && { parentId: parentId, extent: 'parent' },
      }
      return [current, ...children];
  }
}

function collectElkEdges(elk: ElkNode): Edge[] {
  const localEdges: Edge[] = (elk.edges ?? [])
    .filter(edge => edge.sources?.[0] !== undefined && edge.targets?.[0] !== undefined)
    .map((edge, index) => {
      console.log('edge: ', edge.id, edge.sources[0], edge.targets[0]);
      let colorLabel: ElkColorLabel | undefined = edge.labels?.find(label => label instanceof ElkColorLabel)
      // let noHandles = edge.labels?.find(label => label instanceof ElkNoHandlesLabel)
      // let edgeKind = noHandles ? 'floating' : 'default'
      let edgeKind = 'default'

      return {
        id: edge.id,
        source: edge.sources[0]!,
        target: edge.targets[0]!,

        label: edge.labels?.[0]?.text,

        type: edgeKind,

        ... { style: colorLabel ? { stroke: colorLabel.text } : {} },

        sourceHandle: outputHandleName(0),
        targetHandle: inputHandleName(index),
      }});

  const childEdges = (elk.children ?? []).flatMap(collectElkEdges);

  const theEdges = [...localEdges, ...childEdges];
  
  console.log('theEdges: ', theEdges);

  return theEdges
}