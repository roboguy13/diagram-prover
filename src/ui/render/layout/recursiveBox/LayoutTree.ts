import { Edge, XYPosition } from "@xyflow/react";
import { NodeLayout } from "./NodeLayout";
import { SimpleBoundingBox } from "./BoundingBox";
import { addRangeListPropagator, between, exactly, getMin, NumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { Dimensions, getNodeDimensions, getStringNodeDimensions, } from "../../../NodeDimensions";
import { NodesAndEdges } from "../LayoutEngine";
import { ApplicationNode, PortBarType } from "../../../components/Nodes/nodeTypes";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elk } from "../elk/ElkEngine";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { PropagatorNetworkToJson } from "../../../../constraint/propagator/PropagatorToJson";
import { inputHandleName, outputHandleName } from "../../../NodeUtils";
import { layout } from "dagre";
import { Connection, StringDiagram } from "../../../../ir/StringDiagram";
import { Graph, spanningForest } from "../../../../utils/SpanningForest";
import { buildRootedHierarchy, findForestRoots } from "../../../../utils/RootedHierarchy";

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

  private _rootNodeId: string;

  private _stringDiagram: StringDiagram | null = null;

  private _net: PropagatorNetwork<NumericRange>;

  private static _STANDARD_V_SPACING = 80;
  private static _STANDARD_H_SPACING = 80;

  private static _STANDARD_H_NESTING_SPACING = 80;
  private static _STANDARD_V_NESTING_SPACING = 80;

  private _standardVSpacing: CellRef;
  private _standardHSpacing: CellRef;

  private _standardHNestingSpacing: CellRef;
  private _standardVNestingSpacing: CellRef;

  private _originalConnections: Connection[];
  // private _allRoots: string[] = [];

  constructor(net: PropagatorNetwork<NumericRange>, originalConnections: Connection[], allRoots: string[], rootNodeId: string, rootDims: Dimensions, rootLabel: string, rootKind: string) {
    this._net = net;

    // this._allRoots = allRoots;

    this._originalConnections = originalConnections;

    this._standardVSpacing = net.newCell(`standardVSpacing`, known(exactly(LayoutTree._STANDARD_V_SPACING)));
    this._standardHSpacing = net.newCell(`standardHSpacing`, known(exactly(LayoutTree._STANDARD_H_SPACING)));

    this._standardHNestingSpacing = net.newCell(`standardHNestingSpacing`, known(exactly(LayoutTree._STANDARD_H_NESTING_SPACING)));
    this._standardVNestingSpacing = net.newCell(`standardVNestingSpacing`, known(exactly(LayoutTree._STANDARD_V_NESTING_SPACING)));

    this._rootNodeId = rootNodeId

    this._nodeLayouts.set(rootNodeId, {
      nodeId: rootNodeId,
      nestingParentId: null,
      intrinsicBox: SimpleBoundingBox.create(
        net,
        'intrinsic',
        rootNodeId,
        net.newCell(`intrinsic minX [node ${rootNodeId}]`, known(exactly(0))),
        net.newCell(`intrinsic minY [node ${rootNodeId}]`, known(exactly(0))),
        net.newCell(`intrinsic width [node ${rootNodeId}]`, known(rootDims.width)),
        net.newCell(`intrinsic height [node ${rootNodeId}]`, known(rootDims.height))
      ),
      subtreeExtentBox: SimpleBoundingBox.create(
        net,
        'subtree extent',
        rootNodeId,
        net.newCell(`subtree extent minX [node ${rootNodeId}]`, unknown()),
        net.newCell(`subtree extent minY [node ${rootNodeId}]`, unknown()),
        net.newCell(`subtree extent width [node ${rootNodeId}]`, unknown()),
        net.newCell(`subtree extent height [node ${rootNodeId}]`, unknown())
      ),
      // subtreeExtentBox: BoundingBox.createNew(net, 'subtree extent', root.id),
      position: null,
      kind: rootKind,
      label: rootLabel ?? '',
      portBarType: null,
    });

    // this._net.writeCell(
    //   { description: `intrinsicBox.minY [node ${rootNodeId}]`, inputs: [], outputs: [this._nodeLayouts.get(rootNodeId)!.intrinsicBox.bottom] },
    //   this._nodeLayouts.get(rootNodeId)!.intrinsicBox.bottom,
    //   known(exactly(0))
    // )
  }

  get rootNodeId(): string {
    return this._rootNodeId;
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

  public get originalConnections(): Connection[] {
    return this._originalConnections;
  }

  addNodeLayout(layout: NodeLayout): void {
    if (layout.nodeId === this._rootNodeId) {
      throw new Error("Cannot add layout for root node");
    }

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

  toNodesAndEdges(): NodesAndEdges {
    console.log("Converting layout tree to nodes and edges...");
    const nodes: ApplicationNode[] = [];
    const edges: Edge[] = [];

    try {
      this._nodeLayouts.forEach((layout) => {
        nodes.push(this.nodeToApplicationNode(layout.nodeId));
      });
    } catch (e) {
      console.error("Error converting node layouts to ApplicationNode:", e);
      return { nodes: new Map<string, ApplicationNode>(), edges: [] };
    }

    console.log(`originalConnections: ${JSON.stringify(this._originalConnections)}`);

    this._originalConnections.forEach((conn: Connection) => {
      let sourceId: string | null = null;
      let targetId: string | null = null;
      let sourceHandle: string | null = null;
      let targetHandle: string | null = null;

      // Determine React Flow source node ID and source handle ID
      if (conn.source.type === 'NodeOutput') {
        sourceId = conn.source.id;
        sourceHandle = conn.source.portId; // Use the specific portId from the connection
      } else if (conn.source.type === 'DiagramInput') {
        sourceId = 'input-bar'; // Use the actual ID of your input bar node
        sourceHandle = conn.source.id; // Diagram port ID often serves as handle ID
      }
      // Add cases for other source types if necessary (e.g., internal ports)

      // Determine React Flow target node ID and target handle ID
      if (conn.target.type === 'NodeInput') {
        targetId = conn.target.id;
        targetHandle = conn.target.portId; // Use the specific portId from the connection
      } else if (conn.target.type === 'DiagramOutput') {
        targetId = 'output-bar'; // Use the actual ID of your output bar node
        targetHandle = conn.target.id; // Diagram port ID often serves as handle ID
      }
      // Add cases for other target types if necessary

      // Create the React Flow edge if source and target were found
      if (sourceId && targetId) {
        // Basic validation for handles - you might need defaults
        if (!sourceHandle) console.warn(`Edge ${conn.id}: Missing source handle for source ${sourceId}`);
        if (!targetHandle) console.warn(`Edge ${conn.id}: Missing target handle for target ${targetId}`);

        edges.push({
          id: conn.id,
          source: sourceId,
          target: targetId,
          // Provide default handles if null, or ensure portIds are always valid handle names
          sourceHandle: sourceHandle ?? 'default_source_handle', // Adjust default if needed
          targetHandle: targetHandle ?? 'default_target_handle', // Adjust default if needed
          // type: 'floating', // Optional: Specify edge type
          // animated: true, // Optional: Add animation
        });
      } else {
        console.warn("Could not determine source/target node ID for connection:", conn);
      }
    });
    // this._children.forEach((children, parentId) => {
    //   children.forEach((childId, index) => {
    //     edges.push({ id: `${parentId}-${childId}`, source: parentId, target: childId, sourceHandle: inputHandleName(index) });
    //   });
    // });

    const nodeMap = new Map<string, ApplicationNode>();

    nodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });

    return { nodes: nodeMap, edges };
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

    let x = getMin(this._net.readKnownOrError(xCell, 'x'));
    let y = getMin(this._net.readKnownOrError(yCell, 'y'));
    let width = getMin(this._net.readKnownOrError(widthCell, 'width'));
    let height = getMin(this._net.readKnownOrError(heightCell, 'height'));

    const position: XYPosition = { x, y }

    const nodeLayout = this.getNodeLayout(nodeId);
    if (!nodeLayout) {
      throw new Error(`Node layout not found for node ID: ${nodeId}`);
    }
    const diagramNode = this._stringDiagram!.getNode(nodeId);
    const nodeInterface = diagramNode?.externalInterface ?? { inputPorts: [], outputPorts: [] };

    let portBarType: PortBarType | null = null

    if (diagramNode instanceof PortBarNode) {
      portBarType = diagramNode.isParameterBar ? 'parameter-bar' : 'result-bar';
    }

    const nodeData: any = {
      label: layout.label,
      width,
      height,
      isActiveRedex: false, // TODO
      inputPortIds: nodeInterface.inputPorts,
      outputPortIds: nodeInterface.outputPorts,
      outputCount: nodeInterface.outputPorts.length,
      inputCount: nodeInterface.inputPorts.length,
      portBarType: portBarType,
    }

    const commonProps = {
      id: nodeId,
      data: nodeData,
      position,
      ...(layout.nestingParentId ? { parentId: layout.nestingParentId, extent: 'parent' as const } : {}),
    };

    switch (layout.kind) {
      case 'Transpose':
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

  public async renderDebugInfo(): Promise<NodesAndEdges> {
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

  static buildFromStringDiagram(net: PropagatorNetwork<NumericRange>, diagram: StringDiagram): LayoutTree {
    console.log("Building layout tree from string diagram...")
    console.log("Diagram:", diagram);

    const allNodeIds = Array.from(diagram.nodes.keys());
    if (allNodeIds.length === 0) { throw new Error("No nodes in diagram"); }
    allNodeIds.sort(); // Sort alphabetically
    let firstNodeId = allNodeIds[0]!; // Pick the first one

    if (!firstNodeId) {
      throw new Error("No nodes in diagram"); // TODO: Handle this case
    }

    console.log("First node ID:", firstNodeId);

    let firstNode = diagram.nodes.get(firstNodeId)!

    const layoutTree = new LayoutTree(net, diagram.connections, [], firstNodeId, getStringNodeDimensions(firstNode), firstNode.label ?? '', firstNode.kind);

    const nodeIds = Array.from(diagram.nodes.keys()); // TODO: Do I want to skip the first node here?

    for (const nodeId of nodeIds) {
      const node = diagram.nodes.get(nodeId)!;

      const intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', nodeId, getStringNodeDimensions(node));
      const subtreeExtentBox = SimpleBoundingBox.createNew(net, 'subtree extent', nodeId);

      const nestingParentId = diagram.nestingParents.get(nodeId) ?? null;

      const portBarType: PortBarType | null = node instanceof PortBarNode ? (node.isParameterBar ? 'parameter-bar' : 'result-bar') : null;

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

      if (nodeId !== firstNodeId) {
        layoutTree.addNodeLayout(nodeLayout);
      }

      if (nestingParentId) {
        layoutTree.addNestingChild(nestingParentId, nodeId);
      }

      if (portBarType === 'parameter-bar') {
        if (!nestingParentId) {
          console.warn(`LayoutTree.buildFromStringDiagram: parameter port bar ${nodeId} doesn't have nesting parent`)
        } else {
          layoutTree._nestingNodeParameterPortBar.set(nestingParentId, nodeId)
        }
      } else if (portBarType === 'result-bar') {
        if (!nestingParentId) {
          console.warn(`LayoutTree.buildFromStringDiagram: result port bar ${nodeId} doesn't have nesting parent`)
        } else {
          layoutTree._nestingNodeResultPortBar.set(nestingParentId, nodeId)
        }
      }
    }

    const nodeToNodeConnections = diagram.connections.filter(conn =>
      isNodePortLocation(conn.source) && isNodePortLocation(conn.target)
    );

    let graph: Graph<string> = { vertices: nodeIds, edges: nodeToNodeConnections.map((e) => ({ source: e.source.id, target: e.target.id })) };
    const forestEdges = spanningForest(graph);
    // layoutTree.allRoots = findForestRoots(nodeIds, layoutTree._children);
    const allRoots = layoutTree.getHierarchyRoots(layoutTree);
    const rootedHierarchy = buildRootedHierarchy<string>(allRoots, [...forestEdges]);

    for (const edge of rootedHierarchy.edges) {
      console.log(`Processing hierarchy edge: ${edge.source} -> ${edge.target}`);
      layoutTree.addChild(edge.source, edge.target);
      console.log(`Called addChild for: ${edge.source} -> ${edge.target}`);
    }
    console.log("Final _children map after processing hierarchy edges:", layoutTree._children);

    console.log("All roots found:", layoutTree.allRoots);

    layoutTree._stringDiagram = diagram;
    return layoutTree;
  }

  public get allRoots(): string[] {
    return this.getHierarchyRoots(this);
  }

  // Helper function perhaps in ConstraintApplicator or a utility file
  getHierarchyRoots(layoutTree: LayoutTree): string[] {
    const allNodes = new Set(this._nodeLayouts.keys());
    const childrenNodes = new Set<string>();
    for (const children of layoutTree._children.values()) {
      children.forEach(childId => childrenNodes.add(childId));
    }

    const hierarchyRoots: string[] = [];
    allNodes.forEach(nodeId => {
      if (!childrenNodes.has(nodeId)) {
        hierarchyRoots.push(nodeId);
      }
    });
    // Handle edge case: if graph is single node, it might be missed.
    if (hierarchyRoots.length === 0 && allNodes.size > 0) {
      const firstNode = allNodes.values().next().value;
      if (firstNode) return [firstNode];
    }
    console.log("Determined Hierarchy Roots:", hierarchyRoots);
    return hierarchyRoots;
  }

  static buildFromSemanticNode<A>(net: PropagatorNetwork<NumericRange>, rootNode: SemanticNode<A>): LayoutTree {
    const layoutTree = new LayoutTree(net, [], [rootNode.id], rootNode.id, getNodeDimensions(rootNode), rootNode.label ?? '', rootNode.kind);

    function traverse(node: SemanticNode<A>, parentId: string | null, nestingParentId: string | null): void {
      let intrinsicBox: SimpleBoundingBox | null = null;

      if (node.kind === 'Transpose') {
        intrinsicBox = SimpleBoundingBox.createNewWithUnknowns(net, 'intrinsic', node.id);
      } else {
        let initialNodeDims = getNodeDimensions(node);
        intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', node.id, initialNodeDims)
      }

      if (node.id !== rootNode.id) {
        const nodeLayout: NodeLayout = {
          nodeId: node.id,
          nestingParentId: nestingParentId,
          intrinsicBox: intrinsicBox,
          subtreeExtentBox: SimpleBoundingBox.createNew(net, 'subtree extent', node.id),
          position: null,
          kind: node.kind,
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
