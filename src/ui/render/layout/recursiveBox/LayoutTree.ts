import { Edge, XYPosition } from "@xyflow/react";
import { NodeLayout } from "./NodeLayout";
import { BoundingBox } from "./BoundingBox";
import { addRangeListPropagator, between, exactly, getMin, NumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { Dimensions, getNodeDimensions, getStringNodeDimensions, } from "../../../NodeDimensions";
import { NodesAndEdges } from "../LayoutEngine";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elk } from "../elk/ElkEngine";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { PropagatorNetworkToJson } from "../../../../constraint/propagator/PropagatorToJson";
import { inputHandleName, outputHandleName } from "../../../NodeUtils";
import { layout } from "dagre";
import { Connection, isNodePortLocation, StringDiagram } from "../../../../ir/StringDiagram";
import { Graph, spanningForest } from "../../../../utils/SpanningForest";
import { buildRootedHierarchy, findForestRoots } from "../../../../utils/RootedHierarchy";

export class LayoutTree {
  private _nodeLayouts: Map<string, NodeLayout> = new Map();
  private _children: Map<string, string[]> = new Map();
  private _nestingChildren: Map<string, string[]> = new Map();

  private _rootNodeId: string;

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
  private _allRoots: string[] = [];

  constructor(net: PropagatorNetwork<NumericRange>, originalConnections: Connection[], allRoots: string[], rootNodeId: string, rootDims: Dimensions, rootLabel: string, rootKind: string) {
    this._net = net;

    this._allRoots = allRoots;

    this._originalConnections = originalConnections;

    this._standardVSpacing = net.newCell(`standardVSpacing`, known(exactly(LayoutTree._STANDARD_V_SPACING)));
    this._standardHSpacing = net.newCell(`standardHSpacing`, known(exactly(LayoutTree._STANDARD_H_SPACING)));

    this._standardHNestingSpacing = net.newCell(`standardHNestingSpacing`, known(exactly(LayoutTree._STANDARD_H_NESTING_SPACING)));
    this._standardVNestingSpacing = net.newCell(`standardVNestingSpacing`, known(exactly(LayoutTree._STANDARD_V_NESTING_SPACING)));

    this._rootNodeId = rootNodeId

    this._nodeLayouts.set(rootNodeId, {
      nodeId: rootNodeId,
      nestingParentId: null,
      intrinsicBox: new BoundingBox(
        net,
        'intrinsic',
        rootNodeId,
        net.newCell(`intrinsic minX [node ${rootNodeId}]`, known(exactly(0))),
        net.newCell(`intrinsic minY [node ${rootNodeId}]`, known(exactly(0))),
        net.newCell(`intrinsic width [node ${rootNodeId}]`, known(rootDims.width)),
        net.newCell(`intrinsic height [node ${rootNodeId}]`, known(rootDims.height))
      ),
      subtreeExtentBox: new BoundingBox(
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
    const nodes: AppNode[] = [];
    const edges: Edge[] = [];

    this._nodeLayouts.forEach((layout) => {
      nodes.push(this.nodeToAppNode(layout.nodeId));
    });

    this._children.forEach((children, parentId) => {
      children.forEach((childId, index) => {
        edges.push({ id: `${parentId}-${childId}`, source: parentId, target: childId, sourceHandle: inputHandleName(index) });
      });
    });

    const nodeMap = new Map<string, AppNode>();

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

  private nodeToAppNode(nodeId: string): AppNode {
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

    switch (layout.kind) {
      case 'Transpose':
        return {
          id: nodeId,
          type: 'grouped',
          data: {
            label: layout.label,
            width,
            height
          },
          position,
        };
      default:
        return {
          id: nodeId,
          type: 'term',
          data: {
            label: layout.label,
            width,
            height,
            isActiveRedex: false,
            outputCount: 1,
            inputCount: this._children.get(nodeId)?.length ?? 0,
          },
          position,
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

      const intrinsicBox = BoundingBox.createNewWithDims(net, 'intrinsic', nodeId, getStringNodeDimensions(node));
      const subtreeExtentBox = BoundingBox.createNew(net, 'subtree extent', nodeId);

      const nodeLayout: NodeLayout = {
        nodeId: nodeId,
        nestingParentId: null, // TODO: Handle nesting
        intrinsicBox: intrinsicBox,
        subtreeExtentBox: subtreeExtentBox,
        position: null,
        kind: node.kind,
        label: node.label ?? '',
      }

      if (nodeId !== firstNodeId) {
        layoutTree.addNodeLayout(nodeLayout);
      }
    }

    const nodeToNodeConnections = diagram.connections.filter(conn =>
      isNodePortLocation(conn.source) && isNodePortLocation(conn.target)
    );

    let graph: Graph<string> = { vertices: nodeIds, edges: nodeToNodeConnections.map((e) => ({ source: e.source.id, target: e.target.id })) };
    const forestEdges = spanningForest(graph);
    layoutTree.allRoots = findForestRoots(nodeIds, layoutTree._children);
    const rootedHierarchy = buildRootedHierarchy<string>(layoutTree._allRoots, [...forestEdges]);

    for (const edge of rootedHierarchy.edges) {
      console.log(`Processing hierarchy edge: ${edge.source} -> ${edge.target}`);
      layoutTree.addChild(edge.source, edge.target);
      console.log(`Called addChild for: ${edge.source} -> ${edge.target}`);
    }
    console.log("Final _children map after processing hierarchy edges:", layoutTree._children);

    console.log("All roots found:", layoutTree.allRoots);

    return layoutTree;
  }

  public get allRoots(): string[] {
    return this._allRoots;
  }

  private set allRoots(roots: string[]) {
    this._allRoots = roots;
  }

  private canReach(startNodeId: string, targetNodeId: string): boolean {
    const visited = new Set<string>();
    const stack: string[] = [startNodeId]; // Start DFS from the potential child

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;

      // If we reached the target (the potential parent), a cycle would be formed
      if (currentNodeId === targetNodeId) {
        return true;
      }

      if (visited.has(currentNodeId)) {
        continue;
      }
      visited.add(currentNodeId);

      // Traverse to children based on the tree built so far
      const children = this.getChildren(currentNodeId);
      for (const child of children) {
        // No need to check visited here for cycle detection path finding
        stack.push(child);
      }
    }
    // If the target was never reached, adding the edge is safe
    return false;
  }

  static buildFromSemanticNode<A>(net: PropagatorNetwork<NumericRange>, rootNode: SemanticNode<A>): LayoutTree {
    const layoutTree = new LayoutTree(net, [], [rootNode.id], rootNode.id, getNodeDimensions(rootNode), rootNode.label ?? '', rootNode.kind);

    function traverse(node: SemanticNode<A>, parentId: string | null, nestingParentId: string | null): void {
      let intrinsicBox: BoundingBox | null = null;

      if (node.kind === 'Transpose') {
        intrinsicBox = BoundingBox.createNewWithUnknowns(net, 'intrinsic', node.id);
      } else {
        let initialNodeDims = getNodeDimensions(node);
        intrinsicBox = BoundingBox.createNewWithDims(net, 'intrinsic', node.id, initialNodeDims)
      }

      if (node.id !== rootNode.id) {
        const nodeLayout: NodeLayout = {
          nodeId: node.id,
          nestingParentId: nestingParentId,
          intrinsicBox: intrinsicBox,
          subtreeExtentBox: BoundingBox.createNew(net, 'subtree extent', node.id),
          position: null,
          kind: node.kind,
          label: node.label ?? '',
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
