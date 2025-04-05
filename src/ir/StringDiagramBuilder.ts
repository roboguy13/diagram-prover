import { Term, VarTerm } from "../engine/Term";
import { NodeId, StringNode, Connection, PortLocation, StringDiagram, PortId, PortInterface } from "./StringDiagram";

class StringDiagramBuilder {
  private readonly _nodes: ReadonlyMap<NodeId, StringNode>;
  private readonly _connections: ReadonlyArray<Connection>;
  private readonly _outputPortLocation: PortLocation;
  private readonly freeVarInputTargets: ReadonlyMap<string, PortLocation>;

  constructor(
    nodes: ReadonlyMap<NodeId, StringNode>,
    connections: ReadonlyArray<Connection>,
    outputPortLocation: PortLocation,
    freeVars: ReadonlyMap<string, PortLocation>
  ) {
    this._nodes = nodes;
    this._connections = connections;
    this._outputPortLocation = outputPortLocation;
    this.freeVarInputTargets = freeVars;
  }

  addConnection(source: PortLocation, target: PortLocation): StringDiagramBuilder {
    const newConnections = [...this._connections, {
      id: StringDiagram.createConnectionId(),
      source,
      target
    }];
    return new StringDiagramBuilder(this._nodes, newConnections, this._outputPortLocation, this.freeVarInputTargets);
  }

  withOutputLocation(outputLocation: PortLocation): StringDiagramBuilder {
    return new StringDiagramBuilder(this._nodes, this._connections, outputLocation, this.freeVarInputTargets);
  }



  buildDiagram(): StringDiagram {
    const diagram = new StringDiagram();
    diagram._populateInternal(new Map(this._nodes), [...this._connections], this.calculateExternalInterface());
    return diagram;
  }

  connectFreeVarToDiagramInput(varName: string): { builder: StringDiagramBuilder; portId: PortId; } {
    const targetLocation = this.freeVarInputTargets.get(varName);
    if (!targetLocation) {
      throw new Error(`Free variable ${varName} not found in builder state.`);
    }

    const inputPortId = StringDiagram.createInputId();
    const source: PortLocation = { type: 'DiagramInput', id: inputPortId };
    const newConnection: Connection = {
      id: StringDiagram.createConnectionId(),
      source,
      target: targetLocation
    };

    // Remove the free variable target as it's now connected
    const newFreeVars = new Map(this.freeVarInputTargets);
    newFreeVars.delete(varName);

    const newBuilder = new StringDiagramBuilder(
      this._nodes,
      [...this._connections, newConnection],
      this._outputPortLocation,
      newFreeVars
    );

    return { builder: newBuilder, portId: inputPortId };
  }

  connectOutputToDiagramOutput(): { builder: StringDiagramBuilder; portId: PortId; } {
    if (!this._outputPortLocation) {
      throw new Error("Builder has no output location to connect.");
    }
    const outputPortId = StringDiagram.createOutputId();
    const target: PortLocation = { type: 'DiagramOutput', id: outputPortId };
    const newConnection: Connection = {
      id: StringDiagram.createConnectionId(),
      source: this._outputPortLocation,
      target
    };
    // Output is now connected to the boundary, so clear internal location? Or keep for reference?
    // Let's assume we keep it but know it's connected externally.
    const newBuilder = new StringDiagramBuilder(
      this._nodes,
      [...this._connections, newConnection],
      this._outputPortLocation, // Keep original source location
      this.freeVarInputTargets
    );
    return { builder: newBuilder, portId: outputPortId };
  }

  private calculateExternalInterface(): PortInterface {
    const inputPorts = [...this.freeVarInputTargets.values()].map(v => v.id);
    const outputPorts = [this._outputPortLocation.id];
    return { inputPorts, outputPorts };
  }
}

export function termToStringDiagram(term: Term): StringDiagram {
  return termToStringDiagramBuilder(term, new Map()).buildDiagram();
}

function termToStringDiagramBuilder(term: Term, context: ReadonlyMap<string, PortLocation>): StringDiagramBuilder {
  switch (term.type) {
    case 'Var':
      return termToVarBuilder(term, context);
  }
}

function termToVarBuilder(term: VarTerm, context: ReadonlyMap<string, PortLocation>): StringDiagramBuilder {
  const varName = term.name;
}