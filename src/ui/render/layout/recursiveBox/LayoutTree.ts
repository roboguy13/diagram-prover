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

  nodeToApplicationNode(nodeId: string): ApplicationNode {
    const nodeLayout = this.getNodeLayout(nodeId);

    if (!nodeLayout) {
      throw new Error(`Node layout not found for node ID: ${nodeId}`);
    }

    const node = this._stringDiagram?.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found in string diagram for node ID: ${nodeId}`);
    }

    const width = this.extractRangeValue(nodeLayout.intrinsicBox.width, 'width');
    const height = this.extractRangeValue(nodeLayout.intrinsicBox.height, 'height');
    const x = this.extractRangeValue(nodeLayout.intrinsicBox.left, 'left');
    const y = this.extractRangeValue(nodeLayout.intrinsicBox.top, 'top');

    if (node.kind === 'SimpleNode') {
      return {
        id: nodeId,
        type: 'term',
        data: {
          label: node.label,
          isActiveRedex: false,
          outputCount: node.outputs.length,
          inputCount: node.inputs.length,
          inputPortIds: node.inputs.map((input) => input.portId),
          outputPortIds: node.outputs.map((output) => output.portId),
          width: width,
          height: height,
        },
        position: { x, y },
      };
    } else {
      return {
        id: nodeId,
        type: 'grouped',
        data: {
          label: node.label,
          parameterCount: node.outputs.length,
          inputCount: node.inputs.length,
          width: width,
          height: height,
        },
        position: { x, y },
      }
    }
  }

  toNodesAndEdges(): NodeListAndEdges {
    const nodes: ApplicationNode[] = [];
    const edges: Edge[] = [];

    this._nodeLayouts.forEach((layout) => {
      const nodeId = layout.nodeId;
      const node = this._stringDiagram?.nodes.get(nodeId);
      if (node) {
        const appNode = this.nodeToApplicationNode(nodeId);
        nodes.push(appNode);
      } else {
        console.warn(`Diagram node not found for layout node ${nodeId}`);
      }
    });

    this._originalConnections.forEach((conn) => {
      const sourceNode = this._stringDiagram?.nodes.get(conn.from.nodeId);
      const targetNode = this._stringDiagram?.nodes.get(conn.to.nodeId);

      if (sourceNode && targetNode) {
        edges.push({
          id: conn.id,
          source: conn.from.nodeId,
          target: conn.to.nodeId,
          sourceHandle: conn.from.portId,
          targetHandle: conn.to.portId,
        });
      } else {
        console.warn(`Skipping wire ${conn.id}: Source (${conn.from.nodeId}) or Target (${conn.to.nodeId}) node not found in diagram.`);
      }
    });

    return { nodes, edges };
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

  private pinNode(nodeId: string): void {
    console.log(`Pinning node ${nodeId} to (0,0)`);
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
      if (layout.nestingParentId === null) {
        this.pinNode(nodeId);
        return
      }
    }
  }

  public get roots(): NodeLayout[] {
    const nodeLayouts = Array.from(this._nodeLayouts.values());
    return nodeLayouts.filter(layout => layout.nestingParentId === null);
  }

  static buildFromStringDiagram(net: PropagatorNetwork<NumericRange>, diagram: OpenDiagram): LayoutTree {
    const layoutTree = new LayoutTree(net, Array.from(diagram.wires.values()));

    const nodeIds = Array.from(diagram.nodes.keys());

    for (const nodeId of nodeIds) {
      const intrinsicBox = SimpleBoundingBox.createNewWithDims(net, 'intrinsic', nodeId, getStringNodeDimensions(diagram.nodes.get(nodeId)!));
      const subtreeExtentBox = SimpleBoundingBox.createNew(net, 'subtree extent', nodeId);
      const nestingParentId = diagram.nestingParents.get(nodeId) ?? null;

      const nodeLayout: NodeLayout = {
        nodeId: nodeId,
        nestingParentId: nestingParentId,
        intrinsicBox: intrinsicBox,
        subtreeExtentBox: subtreeExtentBox,
        kind: diagram.nodes.get(nodeId)!.kind,
        label: diagram.nodes.get(nodeId)!.label ?? '',
      }

      layoutTree.addNodeLayout(nodeLayout);

      if (nestingParentId) {
        layoutTree.addNestingChild(nestingParentId, nodeId);
      }
    }

    layoutTree._stringDiagram = diagram;

    const wires = Array.from(diagram.wires.values());
    for (const wire of wires) {
      const sourceNodeId = wire.from.nodeId; // Node providing output (Child in inverted layout)
      const targetNodeId = wire.to.nodeId;   // Node receiving input (Parent in inverted layout)

      // Ensure both nodes exist in the layout map before adding relationship
      if (layoutTree.getNodeLayout(sourceNodeId) && layoutTree.getNodeLayout(targetNodeId)) {
        layoutTree.addChild(targetNodeId, sourceNodeId);
      }
    }

    layoutTree.pinFirstUnnested();
    return layoutTree
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
