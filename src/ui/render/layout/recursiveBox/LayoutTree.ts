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
import { inputHandleName, outputHandleName } from "../../../NodeUtils";
import { layout } from "dagre";
import { Graph, GraphEdge, spanningForest } from "../../../../utils/SpanningForest";
import { buildRootedHierarchy, findForestRoots } from "../../../../utils/RootedHierarchy";
import { DiagramNodeKind, NodeId, NodeKind, OpenDiagram, Wire } from "../../../../ir/StringDiagram";

// class PortBarLayouts {
//   constructor(
//     public parameterPortBarLayout: NodeLayout | null,
//     public resultPortBarLayout: NodeLayout | null,
//   ) { }
// }

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

    // this._allRoots = allRoots;

    this._originalConnections = originalConnections;

    this._standardVSpacing = net.newCell(`standardVSpacing`, known(exactly(LayoutTree._STANDARD_V_SPACING)));
    this._standardHSpacing = net.newCell(`standardHSpacing`, known(exactly(LayoutTree._STANDARD_H_SPACING)));

    this._standardHNestingSpacing = net.newCell(`standardHNestingSpacing`, known(exactly(LayoutTree._STANDARD_H_NESTING_SPACING)));
    this._standardVNestingSpacing = net.newCell(`standardVNestingSpacing`, known(exactly(LayoutTree._STANDARD_V_NESTING_SPACING)));

    // this._net.writeCell(
    //   { description: `intrinsicBox.minY [node ${rootNodeId}]`, inputs: [], outputs: [this._nodeLayouts.get(rootNodeId)!.intrinsicBox.bottom] },
    //   this._nodeLayouts.get(rootNodeId)!.intrinsicBox.bottom,
    //   known(exactly(0))
    // )
  }

  // get rootNodeId(): string {
  //   return this._rootNodeId;
  // }

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

  // TODO: Refactor?
  toNodesAndEdges(): NodeListAndEdges {
    console.log("Converting layout tree to nodes and edges using recursive traversal...");
    const nodes: ApplicationNode[] = [];
    const edges: Edge[] = [];
    const visited = new Set<string>();

    const processNode = (nodeId: string) => {
      const layout = this.getNodeLayout(nodeId);
      if (visited.has(nodeId) || !layout) {
        // if (!layout) console.warn(`processNode: Layout not found for ${nodeId}, skipping.`);
        return;
      }
      visited.add(nodeId);

      try {
        const appNode = this.nodeToApplicationNode(nodeId);
        nodes.push(appNode);
        console.log(`  Added node: ${nodeId} (Parent: ${appNode.parentId ?? 'none'})`);
      } catch (e) {
        console.error(`Error converting node layout ${nodeId} to ApplicationNode:`, e, layout);
        return;
      }

      const children = this.getChildren(nodeId);
      console.log(`  Processing children of ${nodeId}:`, children);
      for (const childId of children) {
        processNode(childId);
      }
    };

    this._nodeLayouts.forEach((layout) => {
      if (!visited.has(layout.nodeId)) {
        // console.warn(`Node ${layout.nodeId} was not visited during root traversal. Processing now (may indicate disconnected graph or hierarchy issue).`);
        processNode(layout.nodeId);
      }
    });

    console.log(`originalConnections: ${JSON.stringify(this._originalConnections)}`);
    this._originalConnections.forEach((conn: Wire) => {
      let sourceId: string | null = conn.from.nodeId;
      let targetId: string | null = conn.to.nodeId;
      let sourceHandle: string | null = conn.from.portId;
      let targetHandle: string | null = conn.to.portId;

      if (sourceId && targetId) {
        // if (!sourceHandle) console.warn(`Edge ${conn.id}: Missing source handle for source ${sourceId}`);
        // if (!targetHandle) console.warn(`Edge ${conn.id}: Missing target handle for target ${targetId}`);

        edges.push({
          id: conn.id,
          source: sourceId,
          target: targetId,
          sourceHandle: sourceHandle ?? 'default_source_handle',
          targetHandle: targetHandle ?? 'default_target_handle',
          type: 'invertedBezier'
        });
      } else {
        console.warn("Could not determine source/target node ID for connection:", conn);
      }
    });

    console.log("Final nodes array order:", nodes.map(n => ({ id: n.id, parentId: n.parentId })));
    return { nodes: nodes, edges: edges };
  }

  // toNodesAndEdges(): NodeListAndEdges {
  //   console.log("Converting layout tree to nodes and edges...");
  //   const nodes: ApplicationNode[] = [];
  //   const edges: Edge[] = [];

  //   this._nodeLayouts.forEach((layout) => {
  //     try {
  //       nodes.push(this.nodeToApplicationNode(layout.nodeId));
  //     } catch (e) {
  //       console.error("Error converting node layouts to ApplicationNode:", e, layout);
  //       // return { nodes: new Map<string, ApplicationNode>(), edges: [] };
  //     }
  //     });

  //   console.log(`originalConnections: ${JSON.stringify(this._originalConnections)}`);

  //   this._originalConnections.forEach((conn: Wire) => {
  //     let sourceId: string | null = null;
  //     let targetId: string | null = null;
  //     let sourceHandle: string | null = null;
  //     let targetHandle: string | null = null;

  //     sourceId = conn.from.nodeId
  //     targetId = conn.to.nodeId
  //     sourceHandle = conn.from.portId
  //     targetHandle = conn.to.portId

  //     // Create the React Flow edge if source and target were found
  //     if (sourceId && targetId) {
  //       // Basic validation for handles - you might need defaults
  //       if (!sourceHandle) console.warn(`Edge ${conn.id}: Missing source handle for source ${sourceId}`);
  //       if (!targetHandle) console.warn(`Edge ${conn.id}: Missing target handle for target ${targetId}`);

  //       edges.push({
  //         id: conn.id,
  //         source: sourceId,
  //         target: targetId,
  //         // Provide default handles if null, or ensure portIds are always valid handle names
  //         sourceHandle: sourceHandle ?? 'default_source_handle', // Adjust default if needed
  //         targetHandle: targetHandle ?? 'default_target_handle', // Adjust default if needed
  //         // type: 'floating', // Optional: Specify edge type
  //         // animated: true, // Optional: Add animation
  //       });
  //     } else {
  //       console.warn("Could not determine source/target node ID for connection:", conn);
  //     }
  //   });
  //   // this._children.forEach((children, parentId) => {
  //   //   children.forEach((childId, index) => {
  //   //     edges.push({ id: `${parentId}-${childId}`, source: parentId, target: childId, sourceHandle: inputHandleName(index) });
  //   //   });
  //   // });

  //   // nodes.forEach((node) => {
  //   //   nodeMap.set(node.id, node);
  //   // });

  //   return { nodes, edges };
  // }

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

  // Add a getter for layout roots, distinct from nesting roots
  public get layoutRoots(): NodeLayout[] {
    const allNodeIds = Array.from(this._nodeLayouts.keys());
    const childrenNodes = new Set<string>();
    for (const children of this._children.values()) {
      children.forEach(childId => childrenNodes.add(childId));
    }
    const rootIds = allNodeIds.filter(nodeId => !childrenNodes.has(nodeId));
    return rootIds.map(id => this.getNodeLayout(id)).filter((l): l is NodeLayout => l != null);
  }

  // Keep original 'roots' getter if it refers to nesting roots and is used elsewhere
  public get nestingRoots(): NodeLayout[] {
    const nodeLayouts = Array.from(this._nodeLayouts.values());
    return nodeLayouts.filter(layout => layout.nestingParentId === null);
  }

  // static buildFromStringDiagram(net: PropagatorNetwork<NumericRange>, diagram: OpenDiagram): LayoutTree {
  //   console.log("Building layout tree from string diagram...")
  //   console.log("Diagram:", diagram);

  //   const allNodeIds = Array.from(diagram.nodes.keys());
  //   if (allNodeIds.length === 0) { throw new Error("No nodes in diagram"); }
  //   allNodeIds.sort(); // Sort alphabetically

  //   const layoutTree = new LayoutTree(net, Array.from(diagram.wires.values()))

  //   const nodeIds = Array.from(diagram.nodes.keys()); // TODO: Do I want to skip the first node here?

  //   for (const nodeId of nodeIds) {
  //     const node = diagram.nodes.get(nodeId)!;

  //     const intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', nodeId, getStringNodeDimensions(node));
  //     const subtreeExtentBox = SimpleBoundingBox.createNew(net, 'subtree extent', nodeId);

  //     const nestingParentId = diagram.nestingParents.get(nodeId) ?? null;

  //     // const portBarType: PortBarType | null = node instanceof PortBarNode ? (node.isParameterBar ? 'parameter-bar' : 'result-bar') : null;
  //     const portBarType: PortBarType | null =
  //       node.nodeKind === 'portBar'
  //         ? 'parameter-bar'
  //         : null;

  //     console.log(`node kind: ${node.kind}, nodeId: ${nodeId}, portBarType: ${portBarType}`);
  //     console.log(`--- node id: ${nodeId}, nesting parentId: ${nestingParentId}`);

  //     const nodeLayout: NodeLayout = {
  //       nodeId: nodeId,
  //       nestingParentId: nestingParentId,
  //       intrinsicBox: intrinsicBox,
  //       subtreeExtentBox: subtreeExtentBox,
  //       position: null,
  //       kind: node.kind,
  //       label: node.label ?? '',
  //       portBarType: portBarType ?? null,
  //     }

  //     // if (nodeId !== layout._pinnedNodeId) {
  //       layoutTree.addNodeLayout(nodeLayout);
  //     // } else if (nestingParentId) {
  //     // }

  //     if (nestingParentId) {
  //       const layout = layoutTree.getNodeLayout(nodeId);
  //       if (layout) {
  //         layout.nestingParentId = nestingParentId
  //       }
  //       layoutTree.addNestingChild(nestingParentId, nodeId);
  //     }

  //     if (portBarType === 'parameter-bar') {
  //       if (!nestingParentId) {
  //         console.warn(`LayoutTree.buildFromStringDiagram: parameter port bar ${nodeId} doesn't have nesting parent`)
  //       } else {
  //         layoutTree._nestingNodeParameterPortBar.set(nestingParentId, nodeId)
  //       }
  //     } else if (portBarType === 'result-bar') {
  //       if (!nestingParentId) {
  //         console.warn(`LayoutTree.buildFromStringDiagram: result port bar ${nodeId} doesn't have nesting parent`)
  //       } else {
  //         layoutTree._nestingNodeResultPortBar.set(nestingParentId, nodeId)
  //       }
  //     }
  //   }

  //   const nodeToNodeConnections = Array.from(diagram.wires.values())

  //   layoutTree._stringDiagram = diagram;

  //   let graph: Graph<string> = { vertices: nodeIds, edges: nodeToNodeConnections.map(conn => ({ source: conn.from.nodeId, target: conn.to.nodeId })) };
  //   const forestEdges = spanningForest(graph);
  //   // layoutTree.allRoots = findForestRoots(nodeIds, layoutTree._children);
  //   const allRoots = layoutTree.getHierarchyRoots(Array.from(forestEdges));
  //   const rootedHierarchy = buildRootedHierarchy<string>(allRoots, [...forestEdges]);

  //   for (const edge of rootedHierarchy.edges) {
  //     console.log(`Processing hierarchy edge: ${edge.source} -> ${edge.target}`);
  //     // layoutTree.addChild(edge.source, edge.target);
  //     layoutTree.addChild(edge.target, edge.source);
  //     console.log(`Called addChild for: ${edge.source} -> ${edge.target}`);
  //   }
  //   console.log("Final _children map after processing hierarchy edges:", layoutTree._children);

  //   console.log("All roots found:", allRoots);

  //   layoutTree.pinFirstUnnested();

  //   return layoutTree;
  // }

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

  // getHierarchyRoots(layoutTree: LayoutTree): string[] {
  //   const allNodes = new Set(this._nodeLayouts.keys());
  //   const childrenNodes = new Set<string>();
  //   for (const children of layoutTree._children.values()) {
  //     children.forEach(childId => childrenNodes.add(childId));
  //   }

  //   const hierarchyRoots: string[] = [];
  //   allNodes.forEach(nodeId => {
  //     if (!childrenNodes.has(nodeId)) {
  //       hierarchyRoots.push(nodeId);
  //     }
  //   });
  //   // Handle edge case: if graph is single node, it might be missed.
  //   if (hierarchyRoots.length === 0 && allNodes.size > 0) {
  //     const firstNode = allNodes.values().next().value;
  //     if (firstNode) return [firstNode];
  //   }
  //   console.log("Determined Hierarchy Roots:", hierarchyRoots);
  //   return hierarchyRoots;
  // }

  static buildFromSemanticNode<A>(net: PropagatorNetwork<NumericRange>, rootNode: SemanticNode<A>): LayoutTree {
    const kind: DiagramNodeKind = rootNode.kind === 'Transpose' ? 'NestedNode' : 'SimpleNode';
    const layoutTree = new LayoutTree(net, [])

    function traverse(node: SemanticNode<A>, parentId: string | null, nestingParentId: string | null): void {
      let intrinsicBox: SimpleBoundingBox | null = null;

      if (node.kind === 'Transpose') {
        intrinsicBox = SimpleBoundingBox.createNewWithUnknowns(net, 'intrinsic', node.id);
      } else {
        let initialNodeDims = getNodeDimensions(node);
        intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', node.id, initialNodeDims)
      }

      if (node.id !== rootNode.id) {
        const kind = node.kind === 'Transpose' ? 'NestedNode' : 'SimpleNode';
        const nodeLayout: NodeLayout = {
          nodeId: node.id,
          nestingParentId: nestingParentId,
          intrinsicBox: intrinsicBox,
          subtreeExtentBox: SimpleBoundingBox.createNew(net, 'subtree extent', node.id),
          position: null,
          kind,
          label: node.label ?? '',
          portBarType: null,
        }

        layoutTree.addNodeLayout(nodeLayout);
      }

      if (parentId) {
        layoutTree.addChild(parentId, node.id);
      }

      for (const child of node.children) {
        traverse(child, node.id, null);
      }

      if (node.subgraph) {
        for (const child of node.subgraph) {
          layoutTree.addNestingChild(node.id, child.id);
          traverse(child, null, node.id);
        }
      }
    }

    traverse(rootNode, null, null);
    return layoutTree
  }
}
