import { uniqueId } from "lodash";
import { AppTerm, collectLams, LamTerm, Term, VarTerm } from "../engine/Term";
import { inputHandleName, outputHandleName } from "../ui/NodeUtils";

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

class StringDiagramBuilder {
  private _diagram: StringDiagram;
  private _outputPortLocation: PortLocation;
  private freeVarInputTargets: Map<string, PortLocation> = new Map();

  constructor() {
    this._diagram = new StringDiagram();
  }

  // Connect portId to the input represented by freeVar
  public connectToInput(freeVar: string, portId: PortId): StringDiagramBuilder {
    let connections = this._diagram.connections;

    return {
      ... this,
      diagram: this._diagram._populateInternal(
        this._diagram.nodes,
        [... connections,
          { id: StringDiagram.createConnectionId(),
            source: { type: 'NodeInput', id: freeVar, portId }, // TODO: Fix id?
            target: this._outputPortLocation
          }],
        this._diagram.externalInterface
      )
    };
  }

  // Connect portId to the output of this diagram
  public connectToOutput(portId: PortId): StringDiagramBuilder {
    let connections = this._diagram.connections;

    return {
      ... this,
      diagram: this._diagram._populateInternal(
        this._diagram.nodes,
        [... connections,
          { id: StringDiagram.createConnectionId(),
            source: this._outputPortLocation,
            target: { type: 'NodeOutput', id: portId, portId: portId }  // TODO: Fix id?
          }],
        this._diagram.externalInterface
      )
    };
  }
}

export function termToStringDiagramBuilder(term: Term, context: Map<string, PortLocation>): StringDiagramBuilder {
}

// type ConversionResult = {
//   nodes: Map<NodeId, StringNode>;
//   connections: Connection[];

//   // Location where the main output of this sub-diagram terminates
//   outputLocation: PortLocation;

//   // Map from *free variable names* in this sub-diagram
//   // to the location where their input wire should connect *to*.
//   freeVarInputTargets: Map<string, PortLocation>;
// }

// export function termToConversionResult(term: Term, context: Map<string, PortLocation>): ConversionResult {
// }

// export function constructBindingForm(params: string[], body: Term, context: Map<string, PortLocation>): ConversionResult {
//   const absNodeId = StringDiagram.createNodeId();
//   const inputPortIds = params.map(_ => StringDiagram.createInputId()); // Assuming StringDiagram has these static methods
//   const outputPortId = StringDiagram.createOutputId();

//   const newContext = new Map(context);
//   params.forEach((paramName, index) => {
//     const paramInputLocation: PortLocation = {
//       type: 'NodeInput',
//       id: absNodeId,
//       portId: inputPortIds[index]!,
//     };
//     newContext.set(paramName, paramInputLocation);
//   });


//   const bodyResult = termToConversionResult(body, newContext);

//   const binderNode: LamNode = {
//     kind: 'LamNode',
//     id: absNodeId,
//     label: `λ ${params.join(' ')}`,
//     internalInterface: {
//       inputPorts: inputPortIds,
//       outputPorts: [outputPortId],
//     },
//     nestedDiagram: bodyResult,
//   };
//   const finalNodes = new Map(bodyResult.nodes);
//   finalNodes.set(absNodeId, binderNode);

//   const finalConnections = [...bodyResult.connections];

//   if (bodyResult.outputLocation) {
//     const outputConnection: Connection = {
//       id: StringDiagram.createConnectionId(),
//       source: bodyResult.outputLocation,
//       target: { type: 'NodeOutput', id: absNodeId, portId: outputPortId },
//     };
//     finalConnections.push(outputConnection);
//   }

//   const absFreeVarInputTargets = bodyResult.freeVarInputTargets;

//   const absOutputLocation: PortLocation = { type: 'NodeOutput', id: absNodeId, portId: outputPortId };

//   return {
//     nodes: finalNodes,
//     connections: finalConnections,
//     outputLocation: absOutputLocation,
//     freeVarInputTargets: absFreeVarInputTargets,
//   };
// }

// // export function termToStringDiagram(term: Term): StringDiagram {
// //   switch (term.type) {
// //     case 'Var':
// //       return StringDiagram.createVarNode(term.name.name);
// //     case 'UnitTy':
// //       throw new Error("Not implemented: termToStringDiagram for UnitTy");
// //     case 'Empty':
// //       throw new Error("Not implemented: termToStringDiagram for Empty");
// //     case 'Type':
// //       throw new Error("Not implemented: termToStringDiagram for Type");
// //     case 'Pi':
// //       throw new Error("Not implemented: termToStringDiagram for Pi");
// //     case 'unit':
// //       return StringDiagram.createUnitNode({ kind: 'UnitNode' });

// //     case 'Lam': {
// //       const firstParam = term.paramName!
// //       const restLams = collectLams(term.body);
// //       const params = [firstParam, ...restLams.params];
// //       const body = restLams.body;

// //       const bodyDiagram = termToStringDiagram(body);

// //       const lamNode: LamNode = {
// //         kind: 'LamNode',
// //         label: `λ ${params.join(' ')}`,
// //         internalInterface: StringDiagram.createPortInterface(params.length, 1),
// //         nestedDiagram: bodyDiagram,
// //       }

// //       return StringDiagram.createLamNodeDiagram(lamNode);
// //     }

// //     case 'App': {
// //       const funcDiagram = termToStringDiagram(term.func);
// //       const argDiagram = termToStringDiagram(term.arg);

// //       const appNode: AppNode = {
// //         kind: 'AppNode',
// //         label: '@'
// //       };

// //       // 1) Create the node’s own diagram: 2 inputs, 1 output
// //       const appDiagram = StringDiagram.createAppNode(appNode);

// //       // 2) Parallel compose func & arg
// //       const partial = funcDiagram.parallelCompose(argDiagram);

// //       // 3) Then connect the outputs (funcOut, argOut) to the appNode’s inputs.
// //       //    We assume each of funcDiagram & argDiagram has exactly 1 output.
// //       return partial.connectByIndex(appDiagram, [
// //         [0, 0], // function's 0th output → appNode's 0th input
// //         [1, 1], // argument's 0th output → appNode's 1st input
// //       ]);
// //     }

// //     case 'Ann':
// //       return termToStringDiagram(term.term);
// //   }
// // }
