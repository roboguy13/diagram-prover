// import * as dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled.js'
import { NodesAndEdges, elkToReactFlow } from './NodesAndEdges';
import { Position } from 'reactflow';

import { Model } from '../architecture/Model';
import { getNextChangedId } from '../architecture/Model';
import { build } from 'esbuild';

import { AppNode } from '../components/Nodes/nodeTypes';
import { SemanticNode } from '../../ir/SemanticGraph';
import { semanticNodeToElk } from '../../ir/ToElk';

const elk = new ELK();

export async function toFlow(g: SemanticNode): Promise<NodesAndEdges> {
  let graph = semanticNodeToElk(g);

  let promise = elk
    .layout(graph)
    .catch(console.error);

  let result = await promise

  if (result) {
    return elkToReactFlow(result);
  } else {
    return { nodes: new Map<string, AppNode>(), edges: new Array() };
  }
}
