import { AppTerm, collectLams, LamTerm, Term, VarTerm } from "../engine/Term";
import { inputHandleName, outputHandleName } from "../ui/NodeUtils";
import { readonlyMap } from "fp-ts";

export type PortId = string;
export type NodeId = string;

export type PortLocation =
| { type: 'DiagramInput', id: PortId }
| { type: 'DiagramOutput', id: PortId }
| { type: 'NodeInput', id: NodeId, portId: PortId }
| { type: 'NodeOutput', id: NodeId, portId: PortId }

export function isNodePortLocation(location: PortLocation): boolean {
  return location.type === 'NodeInput' || location.type === 'NodeOutput';
}

export type Connection =
  {
    id: string;
    source: PortLocation;
    target: PortLocation;
  }

export type PortInterface = {
  inputPorts: PortId[];
  outputPorts: PortId[];
}

export interface StringNode {
  kind: 'PortBarNode' | 'LamNode' | 'AppNode' | 'UnitNode';
  id: NodeId;
  label: string;
  get externalInterface(): PortInterface;
}

export class UnitNode implements StringNode {
  kind: 'UnitNode' = 'UnitNode';
  id: NodeId;
  label: string;
  private _externalInterface: PortInterface;

  constructor(label: string) {
    this.id = StringDiagram.createNodeId();
    this.label = label;
    this._externalInterface = StringDiagram.createPortInterface(0, 1);
  }

  get externalInterface(): PortInterface {
    return this._externalInterface;
  }
}

export class AppNode implements StringNode {
  kind: 'AppNode' = 'AppNode';
  id: NodeId;
  label: string;
  private _externalInterface: PortInterface;

  constructor(label: string) {
    this.id = StringDiagram.createNodeId();
    this.label = label;
    this._externalInterface = StringDiagram.createPortInterface(2, 1);
  }

  get externalInterface(): PortInterface {
    return this._externalInterface;
  }
}

export class LamNode implements StringNode {
  kind: 'LamNode' = 'LamNode';
  id: NodeId;
  label: string;
  private _externalInterface: PortInterface;
  parameterBarId: string | null = null;
  resultBarId: string | null = null;

  constructor(label: string) {
    this.id = StringDiagram.createNodeId();
    this.label = label;
    // this._internalInterface = StringDiagram.createPortInterface(1, 1);
    this._externalInterface = StringDiagram.createPortInterface(0, 1);
  }

  get externalInterface(): PortInterface {
    return this._externalInterface;
  }
}

// NOTE: Parameter bars have *output* ports, while result bars have *input* ports
export class PortBarNode implements StringNode {
  kind: 'PortBarNode' = 'PortBarNode';
  id: NodeId;
  label: string;
  private _externalInterface: PortInterface;
  private _isParameterBar: boolean;

  constructor(label: string, isParameterBar: boolean) {
    this.id = StringDiagram.createNodeId();
    this.label = '';
    this._isParameterBar = isParameterBar;

    this._externalInterface = StringDiagram.createPortInterface(isParameterBar ? 0 : 1, isParameterBar ? 1 : 0);
    console.log("PortBarNode interface:", JSON.stringify(this._externalInterface));
  }

  get externalInterface(): PortInterface {
    return this._externalInterface;
  }

  get isParameterBar(): boolean {
    return this._isParameterBar
  }
}

// export type StringNode = LamNode | AppNode | UnitNode;

// export type UnitNode = {
//   kind: 'UnitNode';
//   id?: NodeId;
//   label?: string;
// }

// export type AppNode = {
//   kind: 'AppNode';
//   id?: NodeId;
//   label?: string;
// }

// export type LamNode = {
//   kind: 'LamNode';
//   id?: NodeId;
//   label?: string;
//   nestedInterface: PortInterface;
//   // nestedDiagram: StringDiagram;
// }

export class StringDiagram {
  private _connections: Connection[] = [];
  private _nodes: Map<NodeId, StringNode> = new Map();

  private _externalInterface: PortInterface
  private static _currUniqueId = 0;

  private _nestingParents: ReadonlyMap<NodeId, NodeId> = new Map()

  constructor() {
    this._externalInterface = { inputPorts: [], outputPorts: [] };
  }

  public connect(
    otherDiagram: StringDiagram,
    connections: Connection[]
  ): StringDiagram {
    const merged = this.merge(otherDiagram);
    // Add the cross connections
    merged._connections.push(...connections);
    // unify external interface
    merged._externalInterface = merged.combineExternalInterfaces(
      otherDiagram,
      connections
    );
    return merged;
  }
  
  public parallelCompose(otherDiagram: StringDiagram): StringDiagram {
    const merged = this.merge(otherDiagram);
    merged._externalInterface = merged.combineExternalInterfaces(otherDiagram, []);
    return merged;
  }

  public connectByIndex(
    otherDiagram: StringDiagram,
    outToInPairs: Array<[number, number]>
  ): StringDiagram {
    const crossConnections = outToInPairs.map(([outI, inI]) => {
      return {
        id: StringDiagram.createConnectionId(),
        source: { type: 'DiagramOutput', id: this._externalInterface.outputPorts[outI] },
        target: { type: 'DiagramInput', id: otherDiagram._externalInterface.inputPorts[inI] },
      } as Connection;
    });
  
    // 2. Defer to the low-level connect/composeInSeries
    return this.connect(otherDiagram, crossConnections);
  }

  public getNode(nodeId: NodeId): StringNode | undefined {
    return this._nodes.get(nodeId);
  }

  private merge(otherDiagram: StringDiagram): StringDiagram {
    let newDiagram = new StringDiagram();
    newDiagram._connections = [...this._connections, ...otherDiagram._connections];
    newDiagram._nodes = new Map([...this._nodes, ...otherDiagram._nodes]);
    return newDiagram;
  }

  public getChildConnections(nodeId: NodeId): Connection[] {
    return this._connections.filter((connection) => {
      return connection.source.type === 'NodeOutput' && connection.source.id === nodeId;
    });
  }

  // TODO: Improve efficiency
  public getChildren(nodeId: NodeId): StringNode[] {
    const node = this._nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    const children: StringNode[] = [];
    this._connections.forEach((connection) => {
      if (connection.source.type === 'NodeOutput' && connection.source.id === nodeId) {
        const childNode = this._nodes.get(connection.target.id);
        if (childNode) {
          children.push(childNode);
        }
      }
    });
    return children;
  }

  public get externalInterface(): PortInterface {
    return this._externalInterface;
  }

  public get connections(): Connection[] {
    return this._connections;
  }

  public get nodes(): Map<NodeId, StringNode> {
    return this._nodes;
  }

  private combineExternalInterfaces(otherDiagram: StringDiagram, connections: Connection[]): PortInterface {
    let inputPorts = [...this._externalInterface.inputPorts, ...otherDiagram._externalInterface.inputPorts];
    let outputPorts = [...this._externalInterface.outputPorts, ...otherDiagram._externalInterface.outputPorts];

    connections.forEach((connection) => {
      if (connection.source.type === 'DiagramOutput') {
        outputPorts = outputPorts.filter((port) => port !== connection.source.id);
      } else if (connection.target.type === 'DiagramInput') {
        inputPorts = inputPorts.filter((port) => port !== connection.target.id);
      }
    });

    return { inputPorts, outputPorts };
  }

  static createVarNode(label?: string): StringDiagram {
    const diagram = new StringDiagram();
    // 1 input, 1 output
    diagram._externalInterface = StringDiagram.createPortInterface(1, 1);
  
    const inPort = diagram._externalInterface.inputPorts[0]!;
    const outPort = diagram._externalInterface.outputPorts[0]!;
  
    diagram._connections.push({
      id: StringDiagram.createConnectionId(),
      source: { type: 'DiagramInput', id: inPort },
      target: { type: 'DiagramOutput', id: outPort },
    });

    return diagram;
  }

  static createUnitNode(node: UnitNode): StringDiagram {
    node.id = StringDiagram.createNodeId();
    let diagram = new StringDiagram();
    diagram.addNode(node);
    diagram._externalInterface = StringDiagram.createPortInterface(0, 1)
    return diagram;
  }

  static createAppNode(node: AppNode): StringDiagram {
    node.id = StringDiagram.createNodeId();
    let diagram = new StringDiagram();
    diagram.addNode(node);
    diagram._externalInterface = StringDiagram.createPortInterface(2, 1)
    return diagram;
  }

  static createLamNodeDiagram(node: LamNode): StringDiagram {
    node.id = StringDiagram.createNodeId();
    let diagram = new StringDiagram();
    diagram.addNode(node);
    diagram._externalInterface = StringDiagram.createPortInterface(0, 1)
    return diagram;
  }

  public static createPortInterface(inputCount: number, outputCount: number): PortInterface {
    let inputPorts = Array.from({ length: inputCount }, (_, i) => StringDiagram.createInputId());
    let outputPorts = Array.from({ length: outputCount }, (_, i) => StringDiagram.createOutputId());
    console.log("Created port interface with input ports:", inputPorts, "and output ports:", outputPorts);
    return { inputPorts, outputPorts };
  }

  public static createNodeId(): string {
    return "node-" + String(this._currUniqueId++);
  }

  public static createInputId(): string {
    return inputHandleName(this._currUniqueId++);
  }

  public static createOutputId(): string {
    return outputHandleName(this._currUniqueId++);
  }

  public static createConnectionId(): string {
    return "conn-" + String(this._currUniqueId++);
  }

  private addNode(node: StringNode): void {
    this._nodes.set(node.id!, node);
  }

  public get nestingParents(): ReadonlyMap<NodeId, NodeId> {
    return this._nestingParents;
  }

  // Method intended only for builder/internal use
  /** @internal */
  _populateInternal(
    nodes: Map<NodeId, StringNode>,
    connections: Connection[],
    externalInterface: PortInterface,
    nestingParents: ReadonlyMap<NodeId, NodeId>
  ): void {
    this._nodes = nodes;
    this._connections = connections;
    this._externalInterface = externalInterface;
    this._nestingParents = nestingParents;
  }
}


