import { freeVarHandleName, inputHandleName, outputHandleName, parameterHandleName } from "../ui/NodeUtils";
import { assert } from "chai";

export type PortId = string;
export type WireId = string;
export type NodeId = string;

export class PortRef {
  nodeId: NodeId;
  portId: PortId;

  constructor(rec: { nodeId: NodeId, portId: PortId }) {
    const { nodeId, portId } = rec;
    this.nodeId = nodeId;
    this.portId = portId;
  }

  equals(other: PortRef): boolean {
    return this.nodeId === other.nodeId && this.portId === other.portId;
  }
}

export type Wire = {
  id: WireId;
  from: PortRef;
  to: PortRef;
}

export type NodeKind = 'app' | 'lam' | 'pi' | 'unit';

export type DiagramNodeKind = 'SimpleNode' | 'NestedNode';

export interface DiagramNodeData {
  kind: 'SimpleNode' | 'NestedNode';
  nodeId: NodeId;
  nodeKind: NodeKind;
  ports: PortSpec[];
}

export abstract class DiagramNode implements DiagramNodeData {
  abstract kind: 'SimpleNode' | 'NestedNode';
  abstract nodeId: NodeId;
  abstract nodeKind: NodeKind;
  abstract ports: PortSpec[];

  get label(): string {
    return this.nodeKind;
  }

  get inputs(): PortRef[] {
    return this.ports
      .filter(p => p.direction === 'input')
      .map(p => p.portRef)
  }

  get outputs(): PortRef[] {
    return this.ports
      .filter(p => p.direction === 'output')
      .map(p => p.portRef)
  }

  bidirectional(): PortRef[] {
    return this.ports
      .filter(p => p.direction === 'bidirectional')
      .map(p => p.portRef)
  }

  getPortSpec(portId: PortId): PortSpec {
    for (const port of this.ports) {
      if (port.portRef.portId === portId) {
        return port;
      }
    }

    throw new Error(`Port with ID ${portId} not found in node ${this.nodeId}`);
  }
}

export class SimpleNode extends DiagramNode {
  kind: 'SimpleNode' = 'SimpleNode';
  nodeId: string;
  nodeKind: NodeKind;
  ports: PortSpec[];

  constructor(data: DiagramNodeData) {
    super()
    this.nodeId = data.nodeId;
    this.nodeKind = data.nodeKind;
    this.ports = data.ports;
  }
}

export class NestedNode extends DiagramNode {
  kind: 'NestedNode' = 'NestedNode';
  nodeId: NodeId;
  nodeKind: NodeKind;
  ports: PortSpec[];

  inner: Diagram

  constructor(inner: Diagram, data: DiagramNodeData) {
    super()
    this.nodeId = data.nodeId;
    this.nodeKind = data.nodeKind;
    this.ports = data.ports;
    this.inner = inner;
  }
}

export type PortDirection = 'input' | 'output' | 'bidirectional';

export interface PortSpec {
  portRef: PortRef;
  direction: PortDirection;
  nestedInterfacePort: boolean;
}

export class InputPort implements PortSpec {
  private readonly _portRef: PortRef;

  constructor(
    nodeId: NodeId,
    portIndex: number
  ) {
    this._portRef = new PortRef({ nodeId, portId: inputHandleName(portIndex) });
  }

  get portRef() { return this._portRef }
  get direction(): PortDirection { return 'input' }
  get nestedInterfacePort(): boolean { return false }
}

export class OutputPort implements PortSpec {
  private readonly _portRef: PortRef;

  constructor(
    nodeId: NodeId,
    portIndex: number
  ) {
    this._portRef = new PortRef({ nodeId, portId: outputHandleName(portIndex) });
  }

  get portRef() { return this._portRef }
  get direction(): PortDirection { return 'output' }
  get nestedInterfacePort(): boolean { return false }
}

export class ParameterPort implements PortSpec {
  private readonly _portRef: PortRef;

  constructor(
    nodeId: NodeId,
    portIndex: number
  ) {
    this._portRef = new PortRef({ nodeId, portId: parameterHandleName(portIndex) });
  }

  get portRef() { return this._portRef }
  get direction(): PortDirection { return 'output' }
  get nestedInterfacePort(): boolean { return true }
}

export class FreeVarPort implements PortSpec {
  private readonly _portRef: PortRef;

  constructor(
    nodeId: NodeId,
    portIndex: number,
  ) {
    this._portRef = new PortRef({ nodeId, portId: freeVarHandleName(portIndex) });
  }

  get portRef() { return this._portRef }

  get direction(): PortDirection { return 'bidirectional' }
  get nestedInterfacePort(): boolean { return true }
}

export class NestedOutputPort implements PortSpec {
  private readonly _portRef: PortRef;

  constructor(
    nodeId: NodeId,
    portIndex: number,
  ) {
    this._portRef = new PortRef({ nodeId, portId: outputHandleName(portIndex) });
  }

  get portRef(): PortRef { return this._portRef }
  get direction(): PortDirection { return 'bidirectional' }
  get nestedInterfacePort(): boolean { return true }
}

export class Diagram {
  kind: 'Diagram' = 'Diagram';

  constructor(
    public nodes: Map<NodeId, DiagramNode>,
    public wires: Map<WireId, Wire>,
    private _nestingParents: Map<NodeId, NodeId>
  ) {
  }

  get nestingParents(): Map<NodeId, NodeId> {
    return this._nestingParents;
  }

  getNode(nodeId: NodeId): DiagramNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    return node;
  }

  getWire(wireId: WireId): Wire {
    const wire = this.wires.get(wireId);
    if (!wire) {
      throw new Error(`Wire with ID ${wireId} not found`);
    }
    return wire;
  }

  getNestingDepth(nodeId: NodeId): number {
    let depth = 0;
    let currentNodeId = nodeId;

    while (this._nestingParents.has(currentNodeId)) {
      currentNodeId = this._nestingParents.get(currentNodeId)!;
      depth++;
    }

    return depth;
  }

  isNestedInterfaceWire(wire: Wire): boolean {
    const toPort = this.getPortSpec(wire.to);
    const fromPort = this.getPortSpec(wire.from);

    const toNode = this.getNode(wire.to.nodeId);
    const fromNode = this.getNode(wire.from.nodeId);

    return (toPort.nestedInterfacePort && this.isNestedInNode(fromNode, toNode))
           || (fromPort.nestedInterfacePort && this.isNestedInNode(toNode, fromNode));
  }

  isNestedInNode(nodeId: DiagramNode, candidateNestingParentId: DiagramNode): boolean {
    const nestingParentId = this._nestingParents.get(nodeId.nodeId);
    if (!nestingParentId) {
      return false;
    }

    if (nestingParentId === candidateNestingParentId.nodeId) {
      return true;
    }

    const parentNode = this.nodes.get(nestingParentId);
    if (!parentNode) {
      throw new Error(`Parent node with ID ${nestingParentId} not found`);
    }

    return this.isNestedInNode(parentNode, candidateNestingParentId);
  }

  private getPortSpec(portRef: PortRef): PortSpec {
    const node = this.nodes.get(portRef.nodeId);
    if (!node) {
      throw new Error(`Node with ID ${portRef.nodeId} not found`);
    }

    const portSpec = node.getPortSpec(portRef.portId);
    if (!portSpec) {
      throw new Error(`Port with ID ${portRef.portId} not found in node ${portRef.nodeId}`);
    }

    return portSpec;
  }
}

export type Box = {
  diagram: Diagram;
  output: PortRef;
}

export class DiagramBuilder {
  private static uniqueId = 0;
  protected _nodes: Map<NodeId, DiagramNode> = new Map();
  private _wires: Map<WireId, Wire> = new Map();
  private _nestingParents: Map<NodeId, NodeId> = new Map();

  protected get nodes(): Map<NodeId, DiagramNode> {
    return this._nodes;
  }

  public static generateId(prefix: string): string {
    return `${prefix}-${this.uniqueId++}`;
  }

  constructor(builder: DiagramBuilder | null = null) {
    this._nodes = builder?._nodes || new Map();
    this._wires = builder?._wires || new Map();
    this._nestingParents = builder?._nestingParents || new Map();
  }

  private static makeParameterPorts(nodeId: NodeId, paramCount: number): ParameterPort[] {
    return Array.from({ length: paramCount }, (_, i) => new ParameterPort(nodeId, i));
  }

  app(f: PortRef, arg: PortRef): PortRef {
    const appId = DiagramBuilder.generateId('app');

    const inPortArg = new InputPort(appId, 0);
    const inPortF = new InputPort(appId, 1);
    const outPort = new OutputPort(appId, 0);

    const appNode: SimpleNode = new SimpleNode({
      kind: 'SimpleNode',
      nodeId: appId,
      nodeKind: 'app',
      ports: [ inPortF, inPortArg, outPort ]
    });

    this._nodes.set(appId, appNode);
    this.wire(f, inPortF.portRef);
    this.wire(arg, inPortArg.portRef);

    return outPort.portRef;
  }

  unit(): PortRef {
    const unitId = DiagramBuilder.generateId('unit');

    const outPort = new OutputPort(unitId, 0);

    const unitNode: SimpleNode = new SimpleNode({
      kind: 'SimpleNode',
      nodeId: unitId,
      nodeKind: 'unit',
      ports: [ outPort ]
    });

    this._nodes.set(unitId, unitNode);

    return outPort.portRef;
  }

  lam(paramCount: number,
    body: (inner: OpenDiagramBuilder, params: PortRef[]) => PortRef
  ): PortRef {
    const lamId = DiagramBuilder.generateId('lam');
    const innerBuilder = new OpenDiagramBuilder(
      new DiagramBuilder(null),
      new FreeVarBuilder(lamId)
    );

    const paramPorts: ParameterPort[] = DiagramBuilder.makeParameterPorts(lamId, paramCount);

    const bodyResultRef = body(innerBuilder, paramPorts.map(p => p.portRef));
    const bodyDiagram = innerBuilder.finish();

    const lamOutPort = new NestedOutputPort(lamId, 0);

    const freeVars = innerBuilder.freeVars;

    const freeVarPorts = Array.from(freeVars.values()).map((port, i) => {
      return new FreeVarPort(lamId, i);
    });

    const lamNode: NestedNode = new NestedNode(
      bodyDiagram,
      {
        kind: 'NestedNode',
        nodeId: lamId,
        nodeKind: 'lam',
        ports: [ lamOutPort, ...paramPorts, ...freeVarPorts ]
      }
    );

    this._nodes.set(lamId, lamNode);
    this.addNestedDiagram(bodyDiagram);

    for (const bodyNode of bodyDiagram.nodes.values()) {
      this._nestingParents.set(bodyNode.nodeId, lamId);
    }

    return lamOutPort.portRef;
  }

  finish(): Diagram {
    return new Diagram(
      this._nodes,
      this._wires,
      this._nestingParents
    )
  }

  private addNestedDiagram(diagram: Diagram) {
    for (const [nodeId, node] of diagram.nodes) {
      if (this._nodes.has(nodeId)) {
        throw new Error(`Node with ID ${nodeId} already exists`);
      }
      this._nodes.set(nodeId, node);
    }

    for (const [wireId, wire] of diagram.wires) {
      if (this._wires.has(wireId)) {
        throw new Error(`Wire with ID ${wireId} already exists`);
      }
      this._wires.set(wireId, wire);
    }
  }

  private wire(from: PortRef, to: PortRef): void {
    const wireId = `${from.nodeId}:${from.portId}-${to.nodeId}:${to.portId}`;
    const wire: Wire = {
      id: wireId,
      from,
      to
    };

    this._wires.set(wireId, wire);
  }

  protected get nestingParents(): Map<NodeId, NodeId> {
    return this._nestingParents;
  }
}

export class OpenDiagram extends Diagram {
  private _freeVars: Map<string, PortRef>;

  constructor(diagram: Diagram, freeVars: Map<string, PortRef>, nestingParents: Map<NodeId, NodeId>
  ) {
    super(diagram.nodes, diagram.wires, nestingParents);
    this._freeVars = freeVars;
  }

  public get freeVars(): Map<string, PortRef> {
    return this._freeVars;
  }
}

export class FreeVarBuilder {
  private _freeVars: Map<string, PortRef> = new Map();
  private _currPortIndex = 0;

  constructor(
    private nodeId: NodeId
  ) { }

  public addFreeVar(name: string): PortRef {
    const freeVarPort = this._freeVars.get(name);

    if (freeVarPort) {
      return freeVarPort;
    }
    
    const portRef: PortRef = new PortRef({ nodeId: this.nodeId, portId: freeVarHandleName(this._currPortIndex) });
    ++this._currPortIndex
    this._freeVars.set(name, portRef);
    return portRef
  }

  public get freeVarPortRefs(): PortRef[] {
    return Array.from(this._freeVars.values());
  }

  public get freeVarMap(): Map<string, PortRef> {
    return this._freeVars;
  }
}

export class OpenDiagramBuilder extends DiagramBuilder {
  constructor(
    builder: DiagramBuilder = new DiagramBuilder(),
    private _freeVarBuilder: FreeVarBuilder | null = null,
  ) {
    super(builder);
  }

  freeVar(name: string): PortRef {
    if (!this._freeVarBuilder) {
      // TODO: Implement handling for top-level free variables
      throw new Error('FreeVarBuilder is not initialized');
    }
    return this._freeVarBuilder.addFreeVar(name);
  }

  public get freeVars(): PortRef[] {
    if (!this._freeVarBuilder) {
      return [];
    }
    return this._freeVarBuilder.freeVarPortRefs
  }

  public override finish(): OpenDiagram {
    return new OpenDiagram(super.finish(), this.freeVarMap, this.nestingParents);
  }

  private get freeVarMap(): Map<string, PortRef> {
    if (!this._freeVarBuilder) {
      return new Map();
    }
    return this._freeVarBuilder.freeVarMap;
  }
}
