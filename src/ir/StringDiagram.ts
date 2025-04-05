import { uniqueId } from "lodash";
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

export type StringNode = LamNode | AppNode | UnitNode;

export type UnitNode = {
  kind: 'UnitNode';
  id?: NodeId;
  label?: string;
}

export type AppNode = {
  kind: 'AppNode';
  id?: NodeId;
  label?: string;
}

export type LamNode = {
  kind: 'LamNode';
  id?: NodeId;
  label?: string;
  internalInterface: PortInterface;
  nestedDiagram: StringDiagram;
}

export class StringDiagram {
  private _connections: Connection[] = [];
  private _nodes: Map<NodeId, StringNode> = new Map();

  private _externalInterface: PortInterface
  private static _currUniqueId = 0;

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

  private merge(otherDiagram: StringDiagram): StringDiagram {
    let newDiagram = new StringDiagram();
    newDiagram._connections = [...this._connections, ...otherDiagram._connections];
    newDiagram._nodes = new Map([...this._nodes, ...otherDiagram._nodes]);
    return newDiagram;
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

  // Method intended only for builder/internal use
  /** @internal */
  _populateInternal(
    nodes: Map<NodeId, StringNode>,
    connections: Connection[],
    externalInterface: PortInterface
  ): void {
    this._nodes = nodes;
    this._connections = connections;
    this._externalInterface = externalInterface;
  }
}


