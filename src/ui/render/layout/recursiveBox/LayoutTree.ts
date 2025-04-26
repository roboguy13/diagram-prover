import { Edge, XYPosition } from "@xyflow/react";
import { NodeLayout } from "./NodeLayout";
import { SimpleBoundingBox } from "./BoundingBox";
import { addRangeListPropagator, between, exactly, getMax, getMin, NumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { Dimensions, getNodeDimensions, getStringNodeDimensions, } from "../../../NodeDimensions";
import { NodeListAndEdges, NodesAndEdges } from "../LayoutEngine";
import { ApplicationNode, PortBarType, TermNodeData } from "../../../components/Nodes/nodeTypes";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elk } from "../elk/ElkEngine";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { PropagatorNetworkToJson } from "../../../../constraint/propagator/PropagatorToJson";
import { parameterHandleName, inputHandleName, outputHandleName } from "../../../NodeUtils";
import { layout } from "dagre";
import { Graph, GraphEdge, spanningForest } from "../../../../utils/SpanningForest";
import { buildRootedHierarchy, findForestRoots } from "../../../../utils/RootedHierarchy";
import { DiagramBuilder, DiagramNode, DiagramNodeKind, NestedNode, NodeId, NodeKind, OpenDiagram, PortRef, Wire } from "../../../../ir/StringDiagram";
import { ElkRouter } from "../../routing/ElkRouter";

export class LayoutTree {
  private _nodeLayouts: Map<string, NodeLayout> = new Map();
  private _children: Map<string, string[]> = new Map();
  private _nestingChildren: Map<string, string[]> = new Map();

  private _nestingNodeParameterPortBar: Map<string, string> = new Map()
  private _nestingNodeResultPortBar: Map<string, string> = new Map()

  private _stringDiagram: OpenDiagram | null = null;

  private _net: PropagatorNetwork<NumericRange>;

  private static _STANDARD_V_SPACING = 80;
  private static _STANDARD_H_SPACING = 80;

  private static _STANDARD_H_NESTING_SPACING = 80;
  private static _STANDARD_V_NESTING_SPACING = 80;

  private _standardVSpacing: CellRef;
  private _standardHSpacing: CellRef;

  private _standardHNestingSpacing: CellRef;
  private _standardVNestingSpacing: CellRef;

  private _originalConnections: Wire[];
  private _pinnedNodeId: NodeId | null = null;

  constructor(net: PropagatorNetwork<NumericRange>, originalConnections: Wire[]) {
    this._net = net;

    this._originalConnections = originalConnections;

    this._standardVSpacing = net.newCell(`standardVSpacing`, known(exactly(LayoutTree._STANDARD_V_SPACING)));
    this._standardHSpacing = net.newCell(`standardHSpacing`, known(exactly(LayoutTree._STANDARD_H_SPACING)));

    this._standardHNestingSpacing = net.newCell(`standardHNestingSpacing`, known(exactly(LayoutTree._STANDARD_H_NESTING_SPACING)));
    this._standardVNestingSpacing = net.newCell(`standardVNestingSpacing`, known(exactly(LayoutTree._STANDARD_V_NESTING_SPACING)));
  }

  get net(): PropagatorNetwork<NumericRange> {
    return this._net;
  }

  get standardVSpacing(): CellRef {
    return this._standardVSpacing;
  }

  get standardHSpacing(): CellRef {
    return this._standardHSpacing;
  }

  get standardHNestingSpacing(): CellRef {
    return this._standardHNestingSpacing;
  }

  get standardVNestingSpacing(): CellRef {
    return this._standardVNestingSpacing;
  }

  public get originalConnections(): Wire[] {
    return this._originalConnections;
  }

  addNodeLayout(layout: NodeLayout): void {
    this._nodeLayouts.set(layout.nodeId, layout);
  }

  getNodeLayout(nodeId: string): NodeLayout | undefined {
    return this._nodeLayouts.get(nodeId);
  }

  get nodeLayouts(): Map<string, NodeLayout> {
    return this._nodeLayouts;
  }

  setNodePosition(nodeId: string, position: XYPosition): void {
    const layout = this._nodeLayouts.get(nodeId);
    if (layout) {
      layout.position = position;
    }
  }

  addChild(parentId: string, childId: string): void {
    if (!this._children.has(parentId)) {
      this._children.set(parentId, []);
    }

    const children = this._children.get(parentId);
    if (children!.find(id => id === childId)) {
      // console.warn(`Child ${childId} already exists for parent ${parentId}. Skipping.`);
      return;
    }
    this._children.get(parentId)!.push(childId);
  }

  getChildren(parentId: string): string[] {
    return this._children.get(parentId) ?? [];
  }

  addNestingChild(parentId: string, childId: string): void {
    if (!this._nestingChildren.has(parentId)) {
      this._nestingChildren.set(parentId, []);
    }
    this._nestingChildren.get(parentId)!.push(childId);
  }

  getNestingChildren(parentId: string): string[] {
    return this._nestingChildren.get(parentId) ?? [];
  }

  toNodesAndEdges(): NodeListAndEdges {
    console.log("Converting layout tree to nodes and edges (handling port bars)...");
    const finalNodes: ApplicationNode[] = [];
    const finalEdges: Edge[] = [];

    // --- 1. Filter out portBar nodes ---
    this._nodeLayouts.forEach((layout) => {
      const diagramNode = this._stringDiagram?.nodes.get(layout.nodeId);
      // Only add nodes that are NOT port bars
      if (diagramNode) {
        try {
          const appNode = this.nodeToApplicationNode(layout.nodeId);
          finalNodes.push(appNode);
          // console.log(`  Added node: ${layout.nodeId} (Parent: ${appNode.parentId ?? 'none'})`);
        } catch (e) {
          console.error(`Error converting node layout ${layout.nodeId} to ApplicationNode:`, e, layout);
        }
      } else if (!diagramNode) {
        console.warn(`Diagram node not found for layout node ${layout.nodeId} during node filtering.`);
      } else {
        // console.log(`  Skipping portBar node: ${layout.nodeId}`);
      }
    });

    // --- 2. Process connections to bypass portBars ---
    console.log(`Original connections: ${this._originalConnections.length}`);
    // Temporary storage for connections involving port bars
    const portBarInputs = new Map<NodeId, { sourceNodeId: NodeId, sourcePortId: string, wireId: string }>();
    const portBarOutputs = new Map<NodeId, { targetNodeId: NodeId, targetPortId: string, wireId: string }>();

    for (const conn of this._originalConnections) {
      const sourceNode = this._stringDiagram?.nodes.get(conn.from.nodeId);
      const targetNode = this._stringDiagram?.nodes.get(conn.to.nodeId);

      if (!sourceNode || !targetNode) {
        console.warn(`Skipping wire ${conn.id}: Source (${conn.from.nodeId}) or Target (${conn.to.nodeId}) node not found in diagram.`);
        continue;
      }

      // --- Case 1: Direct Connection ---
      finalEdges.push({
        id: conn.id,
        source: conn.from.nodeId,
        target: conn.to.nodeId,
        sourceHandle: conn.from.portId,
        targetHandle: conn.to.portId,
        // type: 'invertedBezier'
      });
      // console.log(`  Added direct edge: ${conn.id}`);
    }

    // --- 3. Create bypassed edges ---
    portBarInputs.forEach((inputInfo, portBarId) => {
      const outputInfo = portBarOutputs.get(portBarId);
      if (outputInfo) {
        // Creates bypassed edge
      } // ...
    });
    // --- 4. Warn about unmatched outputs (optional) ---
    portBarOutputs.forEach((outputInfo, portBarId) => {
      console.warn(`Port bar ${portBarId} has an output connection (${outputInfo.wireId}) but no corresponding input connection.`);
    });

    const nodeLayouts = Array.from(this._nodeLayouts.values());

    for (const nodeLayout of nodeLayouts) {
      const nodeId = nodeLayout.nodeId;
      const node = this._stringDiagram?.nodes.get(nodeId);
      console.log(`Processing node ${nodeId}:`, node);
      if (node && node instanceof NestedNode) {
        const portBarId = this.getPortBarId(nodeId);
        const portBarConnectionTargets = this.getPortBarConnectionTargets(portBarId);
        console.log(`Port bar ${portBarId} connection targets:`, portBarConnectionTargets);

        for (let i = 0; i < portBarConnectionTargets.length; i++) {
          const target = portBarConnectionTargets[i]!;
          const targetNode = this._stringDiagram?.nodes.get(target.nodeId);
          if (targetNode) {
            finalEdges.push({
              id: DiagramBuilder.generateId('var-wire'),
              source: node.nodeId,
              target: target.nodeId,
              sourceHandle: boundVarHandleName(i),
              targetHandle: target.portId,
              type: 'invertedBezier',
            });
            // console.log(`  Added edge from port bar ${portBarId} to ${target.nodeId}`);
          } else {
            console.warn(`Target node ${target.nodeId} not found for port bar connection.`);
          }
        }
      }
    }

    console.log(`Final node count: ${finalNodes.length}, Final edge count: ${finalEdges.length}`);

    const router = new ElkRouter();
    const newEdges = router.route(finalNodes, finalEdges);
    console.log("New Edges:", newEdges);

    // console.log("Final nodes:", finalNodes.map(n => ({ id: n.id, parentId: n.parentId })));
    // console.log("Final edges:", finalEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })));
    return { nodes: finalNodes, edges: finalEdges };
  }

  // getPortBarId(nodeId: string): NodeId {
  //   const diagramNode = this._stringDiagram?.nodes.get(nodeId);
  //   if (!diagramNode) {
  //     throw new Error(`Diagram node not found for node ID: ${nodeId}`);
  //   }
  //   if (diagramNode instanceof NestedNode) {
  //     return diagramNode.portBarId
  //   } else {
  //     throw new Error(`Node ID ${nodeId} is not a nested node.`);
  //   }
  // }

  getPortBarConnectionTargets(nodeId: string): PortRef[] {
    const portBarNode = this._stringDiagram?.nodes.get(nodeId);
    const wires = Array.from(this._stringDiagram!.wires.values())

    const portBarConnections = wires.filter(wire => wire.from.nodeId === nodeId);
    const portBarTargets = portBarConnections.map(wire => wire.to);
    return portBarTargets
  }

  public logDebugInfo(): void {
    this._nodeLayouts.forEach((layout) => {
      const intrinsicBox = layout.intrinsicBox;
      const subtreeExtentBox = layout.subtreeExtentBox;

      console.log(`Node ID: ${layout.nodeId}`);
      console.log(`Intrinsic Box: ${intrinsicBox.getDebugInfo(this._net)}`);
      console.log(`Subtree Extent Box: ${subtreeExtentBox.getDebugInfo(this._net)}`);
    });
  }

  private extractRangeValue(cell: CellRef, name: string): number {
    const range = this._net.readKnownOrError(cell, name);

    // if (getMin(range) <= -Infinity) {
    //   return getMax(range)
    // }
    return getMin(range)
  }

  private nodeToApplicationNode(nodeId: string): ApplicationNode {
    const layout = this.getNodeLayout(nodeId);

    if (!layout) {
      throw new Error(`Node layout not found for node ID: ${nodeId}`);
    }

    const intrinsicBox = layout.intrinsicBox;

    let xCell = intrinsicBox.left;
    let yCell = intrinsicBox.top;
    let widthCell = intrinsicBox.width;
    let heightCell = intrinsicBox.height;

    let x = this.extractRangeValue(xCell, 'x');
    let y = this.extractRangeValue(yCell, 'y');
    let width = this.extractRangeValue(widthCell, 'width');
    let height = this.extractRangeValue(heightCell, 'height');

    const position: XYPosition = { x, y }

    const nodeLayout = this.getNodeLayout(nodeId);
    if (!nodeLayout) {
      throw new Error(`Node layout not found for node ID: ${nodeId}`);
    }
    const diagramNode = this._stringDiagram!.nodes.get(nodeId);
    if (!diagramNode) {
      throw new Error(`Diagram node not found for node ID: ${nodeId}`);
    }
    // const nodeInterface = diagramNode?.externalInterface ?? { inputPorts: [], outputPorts: [] };

    let portBarType: PortBarType | null = null

    if (diagramNode.nodeKind === 'portBar') {
      portBarType = 'parameter-bar' //diagramNode.isParameterBar ? 'parameter-bar' : 'result-bar';
    }

    const inputPorts = diagramNode.inputs
    const outputPorts = diagramNode.outputs
    console.log(`  [DEBUG] Node ${nodeId}: Input Ports = ${JSON.stringify(inputPorts.map(p => p.portId))}, Output Ports = ${JSON.stringify(outputPorts.map(p => p.portId))}`);

    const nodeData: TermNodeData = {
      label: layout.label,
      width,
      height,
      isActiveRedex: false, // TODO
      inputPortIds: inputPorts.map(port => port.portId),
      outputPortIds: outputPorts.map(port => port.portId),
      outputCount: outputPorts.length,
      inputCount: inputPorts.length,
      ...(portBarType ? { portBarType: portBarType } : {}),
    }

    console.log(`node: ${layout.nodeId}, nesting parentId: ${layout.nestingParentId}, portBarType: ${portBarType}`);

    const commonProps = {
      id: nodeId,
      data: nodeData,
      position,
      ...(layout.nestingParentId ? { parentId: layout.nestingParentId, extent: 'parent' as const } : {}),
    };

    if (nodeId === 'lam-8') {
      console.log(`[DEBUG] layout.kind for ${nodeId}:`, layout.kind);
    }

    switch (layout.kind) {
      case 'NestedNode':
        return {
          type: 'grouped',
          ...commonProps,
        };
      default:
        return {
          type: 'term',
          ...commonProps,
        };
    }
  }

  public async renderDebugInfo(): Promise<NodeListAndEdges> {
    let elkNode = propagatorNetworkToElkNode(this._net);
    let positioned = await elk.layout(elkNode);

    return elkToReactFlow(positioned);
  }

  public printDebugInfo(): void {
    let jsonConverter = new PropagatorNetworkToJson<NumericRange>()
    let jsonText = jsonConverter.toJson(this._net)
    console.log(jsonText)
  }

  public getParameterPortBar(nodeId: string): string | null {
    return this._nestingNodeParameterPortBar.get(nodeId) ?? null;
  }

  public getResultPortBar(nodeId: string): string | null {
    return this._nestingNodeResultPortBar.get(nodeId) ?? null;
  }

  private pinNode(nodeId: string, portBarType: PortBarType): void {
    console.log(`Pinning node ${nodeId} to (0,0) with port bar type ${portBarType}`);
    const layout = this.getNodeLayout(nodeId);
    if (layout) {
      this.net.writeCell(
        { description: `pinNode [node ${nodeId}]`, inputs: [], outputs: [layout.intrinsicBox.left] },
        layout.intrinsicBox.left,
        known(exactly(0))
      );

      this.net.writeCell(
        { description: `pinNode [node ${nodeId}]`, inputs: [], outputs: [layout.intrinsicBox.top] },
        layout.intrinsicBox.top,
        known(exactly(0))
      );
    } else {
      console.warn(`LayoutTree.pinNode: Layout not found for node ${nodeId}`);
    }
  }

  private pinFirstUnnested(): void {
    for (const [nodeId, layout] of this._nodeLayouts.entries()) {
      if (layout.nestingParentId === null && layout.portBarType === null) {
        this.pinNode(nodeId, layout.portBarType!);
        return
      }
    }
  }

  public get roots(): NodeLayout[] {
    const nodeLayouts = Array.from(this._nodeLayouts.values());
    return nodeLayouts.filter(layout => layout.nestingParentId === null);
  }

  static buildFromStringDiagram(net: PropagatorNetwork<NumericRange>, diagram: OpenDiagram): LayoutTree {
    console.log("Building layout tree from string diagram...")
    console.log("Diagram:", diagram);

    const allNodeIds = Array.from(diagram.nodes.keys());
    if (allNodeIds.length === 0) { throw new Error("No nodes in diagram"); }
    // allNodeIds.sort(); // Sorting might not be necessary here

    const layoutTree = new LayoutTree(net, Array.from(diagram.wires.values()))
    const nodeIds = Array.from(diagram.nodes.keys());

    // 1. Create NodeLayouts for all nodes and handle nesting
    for (const nodeId of nodeIds) {
      const node = diagram.nodes.get(nodeId)!;

      if (node.nodeKind === 'portBar') {
        continue
      }

      const intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', nodeId, getStringNodeDimensions(node));
      const subtreeExtentBox = SimpleBoundingBox.createNew(net, 'subtree extent', nodeId);
      const nestingParentId = diagram.nestingParents.get(nodeId) ?? null;
      const portBarType: PortBarType | null = null //node.nodeKind === 'portBar' ? 'parameter-bar' : null;

      console.log(`--- node id: ${nodeId}, nesting parentId: ${nestingParentId}`);

      const nodeLayout: NodeLayout = {
        nodeId: nodeId,
        nestingParentId: nestingParentId,
        intrinsicBox: intrinsicBox,
        subtreeExtentBox: subtreeExtentBox,
        position: null,
        kind: node.kind,
        label: node.label ?? '',
        portBarType: portBarType ?? null,
      }
      layoutTree.addNodeLayout(nodeLayout);

      if (nestingParentId) {
        // Keep nesting hierarchy separate
        layoutTree.addNestingChild(nestingParentId, nodeId);
      }

      // Handle port bar mapping (assuming this logic is correct)
      if (portBarType === 'parameter-bar' && nestingParentId) {
        layoutTree._nestingNodeParameterPortBar.set(nestingParentId, nodeId)
      }
    }

    layoutTree._stringDiagram = diagram; // Store diagram reference

    // 2. Build Layout Hierarchy DIRECTLY from Wires (Inverted Tree)
    console.log("Building layout hierarchy directly from wires (inverted)...");
    for (const wire of diagram.wires.values()) {
      const sourceNodeId = wire.from.nodeId; // Node providing output (Child in inverted layout)
      const targetNodeId = wire.to.nodeId;   // Node receiving input (Parent in inverted layout)

      // Ensure both nodes exist in the layout map before adding relationship
      if (layoutTree.getNodeLayout(sourceNodeId) && layoutTree.getNodeLayout(targetNodeId)) {
        console.log(`Adding layout child: ${sourceNodeId} to parent: ${targetNodeId}`);
        // Parent = target node, Child = source node
        layoutTree.addChild(targetNodeId, sourceNodeId);
      } else {
        // console.warn(`Skipping wire ${wire.id}: Node ${sourceNodeId} or ${targetNodeId} not found in layout.`);
      }
    }
    console.log("Final _children map after processing wires:", layoutTree._children);

    // 3. Determine Layout Roots (Nodes with NO layout parent)
    const allLayoutNodeIds = Array.from(layoutTree._nodeLayouts.keys());
    const childrenNodes = new Set<string>();
    for (const children of layoutTree._children.values()) {
      children.forEach(childId => childrenNodes.add(childId));
    }
    const layoutRootIds = allLayoutNodeIds.filter(nodeId => !childrenNodes.has(nodeId));
    console.log("Layout roots (nodes with no layout parent):", layoutRootIds);

    // 4. Pin a layout root node to (0,0)
    layoutTree.pinFirstUnnested();

    return layoutTree;
  }

  public get layoutRoots(): NodeLayout[] {
    const allNodeIds = Array.from(this._nodeLayouts.keys());
    const childrenNodes = new Set<string>();
    for (const children of this._children.values()) {
      children.forEach(childId => childrenNodes.add(childId));
    }
    const rootIds = allNodeIds.filter(nodeId => !childrenNodes.has(nodeId) && !this._nestingChildren.has(nodeId));
    return rootIds.map(id => this.getNodeLayout(id)).filter((l): l is NodeLayout => l != null);
  }

  // Keep original 'roots' getter if it refers to nesting roots and is used elsewhere
  public get nestingRoots(): NodeLayout[] {
    const nodeLayouts = Array.from(this._nodeLayouts.values());
    return nodeLayouts.filter(layout => layout.nestingParentId === null);
  }

  // Roots are nodes without parents
  getHierarchyRoots(edges: GraphEdge<string>[]): string[] {
    const nodeIds = Array.from(this._stringDiagram!.nodes.keys());

    const rootIds: string[] = []

    for (const nodeId of nodeIds) {
      const isChild = edges.some(edge => edge.target === nodeId);
      if (!isChild) {
        rootIds.push(nodeId);
      }
    }

    return rootIds
  }
}

function processConnections(connections: Wire[], diagram: OpenDiagram): Edge[] {
  const { directEdges, portBarInputs, outputs } = processDirectEdges(connections, diagram);
  const bypassedEdges = processBypassedEdges(portBarInputs, outputs);

  return [...directEdges, ...bypassedEdges];
}

type InputConnection = {
  sourceNodeId: NodeId;
  sourcePortId: string;
  wireId: string;
}

type OutputConnection = {
  targetNodeId: NodeId;
  targetPortId: string;
  wireId: string;
}

type InputConnectionMap = Map<NodeId, InputConnection>;
type OutputConnectionMap = Map<NodeId, OutputConnection>;

function processDirectEdges(connections: Wire[], diagram: OpenDiagram): {
  directEdges: Edge[],
  portBarInputs: InputConnectionMap,
  outputs: OutputConnectionMap
} {
  const directEdges: Edge[] = [];
  const portBarInputs: InputConnectionMap = new Map();
  const outputs: OutputConnectionMap = new Map();

  for (const conn of connections) {
    const sourceNode = diagram.nodes.get(conn.from.nodeId);
    const targetNode = diagram.nodes.get(conn.to.nodeId);

    if (!sourceNode || !targetNode) {
      console.warn(`Skipping wire ${conn.id}: Source (${conn.from.nodeId}) or Target (${conn.to.nodeId}) node not found in diagram.`);
      continue;
    }

    if (isDirectConnection(sourceNode, targetNode)) {
      directEdges.push({
        id: conn.id,
        source: conn.from.nodeId,
        target: conn.to.nodeId,
        sourceHandle: conn.from.portId,
        targetHandle: conn.to.portId,
      });
    } else if (isParameterBarConnection(sourceNode, targetNode)) {
      // The target (portBar) acts as an input point for the container
      portBarInputs.set(conn.to.nodeId, {
        sourceNodeId: conn.from.nodeId,
        sourcePortId: conn.from.portId,
        wireId: conn.id
      });
    } else {
      throw new Error(`Unexpected connection type: ${sourceNode.nodeKind} to ${targetNode.nodeKind}`);
    }
  }

  return { directEdges, portBarInputs, outputs };
}

function processBypassedEdges(portBarInputs: InputConnectionMap, outputs: OutputConnectionMap): Edge[] {
  const bypassedEdges: Edge[] = [];

  portBarInputs.forEach((inputInfo, portBarId) => {
    const outputInfo = outputs.get(portBarId);
    if (outputInfo) {
      bypassedEdges.push({
        id: DiagramBuilder.generateId('var-wire'),
        source: inputInfo.sourceNodeId,
        target: outputInfo.targetNodeId,
        sourceHandle: inputInfo.sourcePortId,
        targetHandle: outputInfo.targetPortId,
        type: 'invertedBezier',
      });
    }
  });

  return bypassedEdges;
}
