import { Edge, XYPosition } from "@xyflow/react";
import { NodeLayout } from "./NodeLayout";
import { BoundingBox } from "./BoundingBox";
import { addRangeListPropagator, exactly, getMin, NumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { getNodeDimensions } from "../../../NodeDimensions";
import { NodesAndEdges } from "../LayoutEngine";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elk } from "../elk/ElkEngine";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { PropagatorNetworkToJson } from "../../../../constraint/propagator/PropagatorToJson";

export class LayoutTree {
  private _nodeLayouts: Map<string, NodeLayout> = new Map();
  private _children: Map<string, string[]> = new Map();
  private _nestingChildren: Map<string, string[]> = new Map();

  private _rootNodeId: string;

  private _net: PropagatorNetwork<NumericRange>;

  private static _STANDARD_V_SPACING = 80;
  private static _STANDARD_H_SPACING = 80;

  private _standardVSpacing: CellRef;
  private _standardHSpacing: CellRef;

  constructor(net: PropagatorNetwork<NumericRange>, root: SemanticNode<any>) {
    this._net = net;

    this._standardVSpacing = net.newCell(`standardVSpacing`, known(exactly(LayoutTree._STANDARD_V_SPACING)));
    this._standardHSpacing = net.newCell(`standardHSpacing`, known(exactly(LayoutTree._STANDARD_H_SPACING)));

    this._rootNodeId = root.id
    const rootDims = getNodeDimensions(root);

    this._nodeLayouts.set(root.id, {
      nodeId: root.id,
      nestingParentId: null,
      intrinsicBox: new BoundingBox(
        net,
        'intrinsic',
        root.id,
        net.newCell(`intrinsic minX [node ${root.id}]`, unknown()),
        net.newCell(`intrinsic minY [node ${root.id}]`, unknown()),
        net.newCell(`intrinsic width [node ${root.id}]`, known(rootDims.width)),
        net.newCell(`intrinsic height [node ${root.id}]`, known(rootDims.height))
      ),
      subtreeExtentBox: new BoundingBox(
        net,
        'subtree extent',
        root.id,
        net.newCell(`subtree extent minX [node ${root.id}]`, known(exactly(0))),
        net.newCell(`subtree extent minY [node ${root.id}]`, unknown()),
        net.newCell(`subtree extent width [node ${root.id}]`, unknown()),
        net.newCell(`subtree extent height [node ${root.id}]`, unknown())
      ),
      // subtreeExtentBox: BoundingBox.createNew(net, 'subtree extent', root.id),
      position: null,
      kind: root.kind,
      label: root.label ?? '',
    });

    this._net.writeCell(
      { description: `intrinsicBox.minY [node ${root.id}]`, inputs: [], outputs: [this._nodeLayouts.get(root.id)!.intrinsicBox.bottom] },
      this._nodeLayouts.get(root.id)!.intrinsicBox.bottom,
      known(exactly(0))
    )
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
    const nodes: AppNode[] = [];
    const edges: Edge[] = [];

    this._nodeLayouts.forEach((layout) => {
      nodes.push(this.nodeToAppNode(layout.nodeId));
    });

    this._children.forEach((children, parentId) => {
      children.forEach((childId) => {
        edges.push({ id: `${parentId}-${childId}`, source: parentId, target: childId });
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

  // TODO: Support for nested nodes
  static buildFromSemanticNode<A>(net: PropagatorNetwork<NumericRange>, rootNode: SemanticNode<A>): LayoutTree {
    const layoutTree = new LayoutTree(net, rootNode);

    function traverse(node: SemanticNode<A>, parentId: string | null) {
      const initialNodeDims = getNodeDimensions(node);

      if (node.id !== rootNode.id) {
        const nodeLayout: NodeLayout = {
          nodeId: node.id,
          nestingParentId: null,
          intrinsicBox: BoundingBox.createNewWithDims(net, 'intrinsic', node.id, initialNodeDims),
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
        traverse(child, node.id);
      }
    }

    traverse(rootNode, null);
    return layoutTree
  }
}
