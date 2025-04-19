import { inputHandleName, outputHandleName } from "../ui/NodeUtils";

export type PortId = string;
export type WireId = string;
export type NodeId = string;

export type PortRef = {
  nodeId: NodeId;
  portId: PortId;
}

export type Wire = {
  id: WireId;
  from: PortRef;
  to: PortRef;
}

export type NodeKind = 'app' | 'lam' | 'pi' | 'unit' | 'portBar';

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
      .map(p => ({ nodeId: this.nodeId, portId: p.id }))
  }

  get outputs(): PortRef[] {
    return this.ports
      .filter(p => p.direction === 'output')
      .map(p => ({ nodeId: this.nodeId, portId: p.id }))
  }

  bidirectional(): PortRef[] {
    return this.ports
      .filter(p => p.direction === 'bidirectional')
      .map(p => ({ nodeId: this.nodeId, portId: p.id }))
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

export type PortSpec = {
  id: PortId;
  direction: PortDirection;
  /** If this port is merely exposing a deeper port, point to it */
  inner?: { nodeId: NodeId; portId: PortId };
}

export class Diagram {
  kind: 'Diagram' = 'Diagram';
  private _nestingParents: Map<NodeId, NodeId> = new Map()

  constructor(
    public nodes: Map<NodeId, DiagramNode>,
    public wires: Map<WireId, Wire>,
  ) {
    for (const [nodeId, node] of nodes) {
      for (const port of node.ports) {
        if (port.inner) {
          this._nestingParents.set(port.inner.nodeId, nodeId);
        }
      }
    }
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
}

export type Box = {
  diagram: Diagram;
  output: PortRef;
}

export class DiagramBuilder {
  private static uniqueId = 0;
  private _nodes: Map<NodeId, DiagramNode> = new Map();
  private _wires: Map<WireId, Wire> = new Map();

  protected get nodes(): Map<NodeId, DiagramNode> {
    return this._nodes;
  }

  protected static generateId(prefix: string): string {
    return `${prefix}-${this.uniqueId++}`;
  }

  constructor(builder: DiagramBuilder | null = null) {
    this._nodes = builder?._nodes || new Map();
    this._wires = builder?._wires || new Map();
  }

  app(f: PortRef, arg: PortRef): PortRef {
    const appId = DiagramBuilder.generateId('app');

    const inPortF = { nodeId: appId, portId: inputHandleName(0) };
    const inPortArg = { nodeId: appId, portId: inputHandleName(1) };
    const outPort = { nodeId: appId, portId: outputHandleName(0) };

    const appNode: SimpleNode = new SimpleNode({
      kind: 'SimpleNode',
      nodeId: appId,
      nodeKind: 'app',
      ports: [
        { id: inPortF.portId, direction: 'input' },
        { id: inPortArg.portId, direction: 'input' },
        { id: outPort.portId, direction: 'output' }
      ]
    });

    this._nodes.set(appId, appNode);
    this.wire(f, inPortF);
    this.wire(arg, inPortArg);

    return outPort;
  }

  unit(): PortRef {
    const unitId = DiagramBuilder.generateId('unit');

    const outPort = { nodeId: unitId, portId: outputHandleName(0) };

    const unitNode: SimpleNode = new SimpleNode({
      kind: 'SimpleNode',
      nodeId: unitId,
      nodeKind: 'unit',
      ports: [
        { id: outPort.portId, direction: 'output' }
      ]
    });

    this._nodes.set(unitId, unitNode);

    return outPort;
  }

  lam(paramCount: number,
    body: (inner: DiagramBuilder, params: PortRef[]) => PortRef
  ): PortRef {
    const lamId = DiagramBuilder.generateId('lam');

    /* create parameter *bridge* ports on the λ‑node itself */
    const paramPorts = Array.from({ length: paramCount }, (_, i) => ({
      nodeId: lamId,
      portId: inputHandleName(i)
    }));

    /* build the nested body diagram */
    const inner = new DiagramBuilder();
    const bodyRef = body(inner, paramPorts);
    const bodyDia = inner.finish();

    const resultPort = { nodeId: lamId, portId: outputHandleName(0) };

    const lamNode: NestedNode = new NestedNode(bodyDia, {
      kind: 'NestedNode',
      nodeId: lamId,
      nodeKind: 'lam',
      ports: [
        // bound‑variable ports
        ...paramPorts.map((p, i) => ({
          id: p.portId,
          direction: 'input' as const,
          inner: { nodeId: bodyRef.nodeId, portId: bodyRef.portId }, // bridge
        })),
        // result port
        { id: resultPort.portId, direction: 'output' }
      ],
    });

    this._nodes.set(lamId, lamNode);

    for (const node of bodyDia.nodes.values()) {
      this._nodes.set(node.nodeId, node);
    }

    for (const wire of bodyDia.wires.values()) {
      this._wires.set(wire.id, wire);
    }

    return resultPort;
  }

  finish(): Diagram {
    return new Diagram(
      this._nodes,
      this._wires
    )
  }

  private wire(from: PortRef, to: PortRef): void {
    const wireId = `${from.nodeId}-${from.portId}-${to.nodeId}-${to.portId}`;
    const wire: Wire = {
      id: wireId,
      from,
      to
    };

    this._wires.set(wireId, wire);
  }
}

export class OpenDiagram extends Diagram {
  private _freeVars: Map<string, PortRef>;

  constructor(diagram: Diagram, freeVars: Map<string, PortRef>) {
    super(diagram.nodes, diagram.wires);
    this._freeVars = freeVars;
  }

  public get freeVars(): Map<string, PortRef> {
    return this._freeVars;
  }
}

export class OpenDiagramBuilder extends DiagramBuilder {
  private _freeVars: Map<string, PortRef>;
  private readonly _portBarId: NodeId;

  constructor(builder: DiagramBuilder = new DiagramBuilder(), freeVars: Map<string, PortRef> = new Map(), portBarId: NodeId = DiagramBuilder.generateId('portBar')) {
    super(builder);
    this._freeVars = freeVars;
    this._portBarId = portBarId;
  }

  freeVar(name: string): PortRef {
    const cached = this.freeVars.get(name);
    if (cached) {
      return cached;
    }

    const barNode = this.nodes.get(this['portBarId']) as SimpleNode;
    const portId = outputHandleName(barNode.ports.length);

    barNode.ports.push({
      id: portId,
      direction: 'output',
    });

    const ref = { nodeId: barNode.nodeId, portId };
    this.freeVars.set(name, ref);
    return ref;
  }

  public get freeVars(): Map<string, PortRef> {
    return this._freeVars;
  }

  public override finish(): OpenDiagram {
    return new OpenDiagram(super.finish(), this._freeVars);
  }

  public get portBarId(): NodeId {
    return this._portBarId;
  }
}
