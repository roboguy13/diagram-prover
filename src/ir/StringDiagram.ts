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

export interface DiagramNode {
  kind: 'SimpleNode' | 'NestedNode';
  nodeId: NodeId;
  nodeKind: NodeKind;
  ports: PortSpec[];
}

export interface SimpleNode extends DiagramNode {
  kind: 'SimpleNode';
  nodeKind: NodeKind;
  ports: PortSpec[];
}

export interface NestedNode extends DiagramNode {
  kind: 'NestedNode';
  nodeId: NodeId;
  ports: PortSpec[];

  inner: Diagram
}

export type PortDirection = 'input' | 'output' | 'bidirectional';

export type PortSpec = {
  id: PortId;
  direction: PortDirection;
  /** If this port is merely exposing a deeper port, point to it */
  inner?: { node: NodeId; port: PortId };
}

export interface Diagram {
  kind: 'Diagram';
  nodes: DiagramNode[];
  wires: Wire[];
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

    const appNode: SimpleNode = {
      kind: 'SimpleNode',
      nodeId: appId,
      nodeKind: 'app',
      ports: [
        { id: inPortF.portId, direction: 'input' },
        { id: inPortArg.portId, direction: 'input' },
        { id: outPort.portId, direction: 'output' }
      ]
    };

    this._nodes.set(appId, appNode);
    this.wire(f, inPortF);
    this.wire(arg, inPortArg);

    return outPort;
  }

  unit(): PortRef {
    const unitId = DiagramBuilder.generateId('unit');

    const outPort = { nodeId: unitId, portId: outputHandleName(0) };

    const unitNode: SimpleNode = {
      kind: 'SimpleNode',
      nodeId: unitId,
      nodeKind: 'unit',
      ports: [
        { id: outPort.portId, direction: 'output' }
      ]
    };

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

    const lamNode: NestedNode = {
      kind: 'NestedNode',
      nodeId: lamId,
      nodeKind: 'lam',
      ports: [
        // bound‑variable ports
        ...paramPorts.map((p, i) => ({
          id: p.portId,
          direction: 'input' as const,
          inner: { node: bodyRef.nodeId, port: bodyRef.portId }, // bridge
        })),
        // result port
        { id: resultPort.portId, direction: 'output' }
      ],
      inner: bodyDia
    };

    this._nodes.set(lamId, lamNode);

    return resultPort;
  }

  finish(): Diagram {
    return {
      kind: 'Diagram',
      nodes: Array.from(this._nodes.values()),
      wires: Array.from(this._wires.values())
    };
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

export class OpenDiagram implements Diagram {
  kind: 'Diagram' = 'Diagram';
  nodes: DiagramNode[];
  wires: Wire[];

  private _freeVars: Map<string, PortRef>;

  constructor(diagram: Diagram, freeVars: Map<string, PortRef>) {
    this.nodes = diagram.nodes;
    this.wires = diagram.wires;
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
