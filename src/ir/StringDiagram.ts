import { inputHandleName, outputHandleName } from "../ui/NodeUtils";

export type PortId = string;
export type NodeId = string;

export type PortLocation =
| { type: 'PortLocation', id: NodeId, portId: PortId }

export type PortInterface = {
  inputPorts: PortId[];
  outputPorts: PortId[];
}

export type LocatedPortInterface = {
  inputPorts: PortLocation[];
  outputPorts: PortLocation[];
}

export type Connection = {
  id: string;
  source: PortLocation;
  target: PortLocation;
}

export abstract class StringNode {
  abstract get portInterface(): PortInterface;
  abstract get nodeId(): NodeId;
  abstract get label(): string;

  protected abstract get diagram(): StringDiagram;

  nestInNode(nestingParentId: string): void {
    this.diagram.setNestedParentId({ childId: this.nodeId, parentId: nestingParentId });
  }

  connectToInput(otherOutputPort: PortLocation, whichInput: number): void {
    if (whichInput < 0 || whichInput >= this.portInterface.inputPorts.length) {
      throw new Error(`Invalid input port index: ${whichInput}`);
    }

    const inputPort: PortLocation = { type: 'PortLocation', id: this.nodeId, portId: this.portInterface.inputPorts[whichInput]! };

    this.diagram.addConnection({
      source: otherOutputPort,
      target: inputPort
    });
  }
}

export class UnitNode extends StringNode {
  portInterface: PortInterface;
  nodeId: NodeId;
  diagram: StringDiagram;
  readonly label: string = '()'

  constructor(diagram: StringDiagram, nodeId: NodeId) {
    super()
    this.portInterface = StringDiagram.makePortInterface({ inputCount: 0, outputCount: 1 });
    this.diagram = diagram;

    this.nodeId = nodeId;
  }
}

export class AppNode extends StringNode {
  portInterface: PortInterface;
  nodeId: NodeId;
  diagram: StringDiagram;
  readonly label: string = '@';

  constructor(diagram: StringDiagram, nodeId: NodeId) {
    super()
    this.portInterface = StringDiagram.makePortInterface({ inputCount: 2, outputCount: 1 });
    this.diagram = diagram;

    this.nodeId = nodeId
  }
}

export class BindingNode extends StringNode {
  portInterface: PortInterface
  nodeId: NodeId;
  diagram: StringDiagram;
  nestedDiagram: StringDiagram;
  boundVars: PortLocation[];
  readonly label: string = '';

  constructor(diagram: StringDiagram, nodeId: NodeId, nestedDiagram: StringDiagram, boundVars: PortLocation[]) {
    super()

    this.portInterface = StringDiagram.makePortInterface({
      inputCount: boundVars.length,
      outputCount: 1
    });

    this.boundVars = boundVars;

    this.diagram = diagram;
    this.nestedDiagram = nestedDiagram;

    this.nodeId = nodeId;
  }

  get freeVars(): PortLocation[] {
    return this.nestedDiagram.externalInterface.inputPorts.filter(portLoc => (
      !this.boundVars.some(boundVar => boundVar.id === portLoc.id && boundVar.portId === portLoc.portId)
    ));

  }
}

export class LamNode extends StringNode {
  portInterface: PortInterface;
  nodeId: NodeId;
  diagram: StringDiagram;
  bindingNode: BindingNode;
  readonly label: string = '';

  constructor(diagram: StringDiagram, nodeId: NodeId, bindingNode: BindingNode, boundVars: PortLocation[]) {
    super()

    this.bindingNode = bindingNode;

    const freeVars = bindingNode.freeVars;

    this.portInterface = StringDiagram.makePortInterface({
      inputCount: freeVars.length,
      outputCount: 1
    });

    this.nodeId = nodeId
    this.diagram = diagram;
  }
}

/**
 * This class maps free variables to port locations
 */
export class InputUsageMap {
  private _map: Map<string, PortLocation[]> = new Map();

  addUsage(varId: string, portLocation: PortLocation): void {
    if (!this._map.has(varId)) {
      this._map.set(varId, []);
    }
    this._map.get(varId)!.push(portLocation);
  }

  getUsages(varId: string): PortLocation[] {
    const locs = this._map.get(varId);

    if (!locs) {
      return []
    }

    return locs
  }

  getFreeVars(): string[] {
    return Array.from(this._map.keys());
  }
}

export class StringDiagram {
  private _connections: Connection[] = [];
  private _nodes: Map<NodeId, StringNode> = new Map();
  private _nestedParentIds: Map<NodeId, NodeId> = new Map();
  private _inputUsageMap: InputUsageMap = new InputUsageMap();

  private static _uniqueId = 0;

  addNode(nodeId: NodeId, node: StringNode): void {
    this._nodes.set(nodeId, node);
  }

  addConnection(rec: { source: PortLocation, target: PortLocation }): string {
    const connection: Connection = {
      id: StringDiagram.newConnectionId(),
      source: rec.source,
      target: rec.target
    };
    this._connections.push(connection);
    return connection.id;
  }

  addDiagram(diagram: StringDiagram): void {
    for (const [nodeId, node] of diagram.nodes.entries()) {
      this.addNode(nodeId, node);
    }

    for (const connection of diagram.connections) {
      this.addConnection(connection);
    }

    for (const [nodeId, parentId] of diagram._nestedParentIds.entries()) {
      this.setNestedParentId({ childId: nodeId, parentId });
    }
  }

  get nodes(): Map<NodeId, StringNode> {
    return this._nodes;
  }

  get connections(): Connection[] {
    return this._connections;
  }

  lookupNode(nodeId: NodeId): StringNode {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`);
    }
    return node;
  }

  getNestedParentId(nodeId: NodeId): NodeId | undefined {
    return this._nestedParentIds.get(nodeId);
  }

  setNestedParentId(rec: { childId: NodeId, parentId: NodeId }): void {
    this._nestedParentIds.set(rec.childId, rec.parentId);
  }

  connectToFreeVar(nodeId: NodeId, varId: string, whichInput: number): void {
    const node = this.lookupNode(nodeId) as StringNode;

    const usages: PortLocation[] = this._inputUsageMap.getUsages(varId);

    if (usages.length === 0) {
      throw new Error(`No usages found for variable ${varId}`);
    }

    if (whichInput < 0 || whichInput >= node.portInterface.inputPorts.length) {
      throw new Error(`Invalid input port index: ${whichInput}`);
    }

    for (const usage of usages) {
      node.connectToInput(usage, whichInput);
    }
  }

  get externalInterface(): LocatedPortInterface {
    const inputPorts: PortLocation[] = [];
    const outputPorts: PortLocation[] = [];

    // TODO: Get this to be the correct order?
    for (const node of this._nodes.values()) {
      const interfaceRec = node.portInterface;

      const inputPortLocations = this._inputUsageMap.getFreeVars().map(varId => {
        const portId = interfaceRec.inputPorts[0]!;
        return {
          type: 'PortLocation' as const,
          id: node.nodeId,
          portId
        };
      });

      const outputPortLocations = interfaceRec.outputPorts.map(portId => ({
        type: 'PortLocation' as const,
        id: node.nodeId,
        portId
      }));

      inputPorts.push(...inputPortLocations);
      outputPorts.push(...outputPortLocations);
    }

    return {
      inputPorts,
      outputPorts,
    };
  }

  static makePortInterface(rec: { inputCount: number, outputCount: number }): PortInterface {
    return {
      inputPorts: Array.from({ length: rec.inputCount }, (_, i) => `${inputHandleName(i)}`),
      outputPorts: Array.from({ length: rec.outputCount }, (_, i) => `${outputHandleName(i)}`)
    }
  }

  private static newConnectionId(): string {
    return `conn-${StringDiagram._uniqueId++}`;
  }

  static newNodeId(): string {
    return `node-${StringDiagram._uniqueId++}`;
  }
}

export class StringDiagramBuilder {
  private _diagram: StringDiagram;

  constructor() {
    this._diagram = new StringDiagram();
  }

  addUnitNode(): NodeId {
    const nodeId = StringDiagram.newNodeId();
    const node = new UnitNode(this._diagram, nodeId);
    this._diagram.addNode(nodeId, node);
    return nodeId
  }

  addAppNode(): NodeId {
    const nodeId = StringDiagram.newNodeId();
    const node = new AppNode(this._diagram, nodeId);
    this._diagram.addNode(nodeId, node);
    return nodeId;
  }

  addLamNode(nestedDiagram: StringDiagram, boundVars: PortLocation[]): NodeId {
    const nodeId = StringDiagram.newNodeId();
    const bindingNodeId = this.addBindingNode(nestedDiagram, boundVars);
    const bindingNode = this._diagram.lookupNode(bindingNodeId) as BindingNode;
    const node = new LamNode(this._diagram, nodeId, bindingNode, boundVars);

    this._diagram.addNode(nodeId, node);
    this._diagram.setNestedParentId({ parentId: nodeId, childId: bindingNode.nodeId });

    return nodeId;
  }

  private addBindingNode(nestedDiagram: StringDiagram, boundVars: PortLocation[]): NodeId {
    const nodeId = StringDiagram.newNodeId();
    const node = new BindingNode(this._diagram, nodeId, nestedDiagram, boundVars);

    this._diagram.addNode(nodeId, node);

    this._diagram.addDiagram(nestedDiagram);

    for (const [_nestedNodeId, nestedNode] of nestedDiagram.nodes.entries()) {
      nestedNode.nestInNode(nodeId);
    }

    for (let i = 0; i < boundVars.length; i++) {
      const boundVar = boundVars[i]!;

      this._diagram.addConnection({
        source: { type: 'PortLocation', id: nodeId, portId: node.portInterface.outputPorts[i]! },
        target: boundVar,
      });
    }

    this._diagram.addConnection({
      source: { type: 'PortLocation', id: nodeId, portId: node.portInterface.outputPorts[0]! },
      target: { type: 'PortLocation', id: nestedDiagram.externalInterface.inputPorts[0]!.id, portId: nestedDiagram.externalInterface.inputPorts[0]!.portId }
    });

    return nodeId;
  }

  get diagram(): StringDiagram {
    return this.diagram;
  }
}

export class ExprDiagramBuilder {
  private _builder: StringDiagramBuilder;

  constructor() {
    this._builder = new StringDiagramBuilder()
  }

  get diagram(): StringDiagram {
    return this._builder.diagram;
  }

  public unit(): LocatedPortInterface {
    this._builder.addUnitNode();
    return this._builder.diagram.externalInterface;
  }

  public app(f: LocatedPortInterface, arg: LocatedPortInterface): LocatedPortInterface {
  }

  public lam(body: LocatedPortInterface, boundVars: LocatedPortLocation[]): LocatedPortInterface {
  }

  public var(varId: string): LocatedPortInterface {
  }
}
