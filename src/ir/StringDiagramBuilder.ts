import { Term, VarTerm, LamTerm, AppTerm, Type, Context as TermContext } from "../engine/Term"; // Renamed Context to TermContext
import { NodeId, StringNode, Connection, PortLocation, StringDiagram, PortId, PortInterface, LamNode, AppNode, UnitNode, PortBarNode } from "./StringDiagram"; // Added node types
import { produce } from 'immer'; // If needed for immutable updates of maps/arrays

// Define the type for the bound variable environment
type BoundVarEnv = ReadonlyArray<PortLocation>;

class StringDiagramBuilder {
  readonly nodes: ReadonlyMap<NodeId, StringNode>;
  readonly connections: ReadonlyArray<Connection>;
  readonly outputPortLocation: PortLocation | null; // Allow null for empty/intermediate states
  readonly freeVarInputTargets: ReadonlyMap<string, PortLocation>;
  readonly nestingParents: ReadonlyMap<NodeId, NodeId>; // Track nesting parents

  constructor(
    nodes: ReadonlyMap<NodeId, StringNode>,
    connections: ReadonlyArray<Connection>,
    outputPortLocation: PortLocation | null, // Allow null
    freeVars: ReadonlyMap<string, PortLocation>,
    nestingParents: ReadonlyMap<NodeId, NodeId>
  ) {
    this.nodes = nodes;
    this.connections = connections;
    this.outputPortLocation = outputPortLocation;
    this.freeVarInputTargets = freeVars;
    this.nestingParents = nestingParents;
  }

  static empty(): StringDiagramBuilder {
    return new StringDiagramBuilder(new Map(), [], null, new Map(), new Map());
  }

  addNestingParent(nodeId: NodeId, parentId: NodeId): StringDiagramBuilder {
    const newNestingParents = new Map(this.nestingParents);
    newNestingParents.set(nodeId, parentId);
    return new StringDiagramBuilder(this.nodes, this.connections, this.outputPortLocation, this.freeVarInputTargets, newNestingParents);
  }


  addConnection(source: PortLocation, target: PortLocation): StringDiagramBuilder {
    // Ensure source and target are valid before adding
    if (!source || !target) {
        console.warn("Attempted to add connection with null source or target", { source, target });
        // Decide how to handle: throw error or return unchanged builder?
        return this; // Returning unchanged for now
    }
    const id = StringDiagram.createConnectionId();
    const newConnections = [...this.connections, {
      id: id,
      source,
      target
    }];
    console.log("Adding connection", { id, source, target });
    return new StringDiagramBuilder(this.nodes, newConnections, this.outputPortLocation, this.freeVarInputTargets, this.nestingParents);
  }

  addNode(node: StringNode): StringDiagramBuilder {
    if (!node.id) {
        throw new Error("Node must have an ID to be added to the builder.");
    }
    const newNodes = new Map(this.nodes).set(node.id, node);
    return new StringDiagramBuilder(newNodes, this.connections, this.outputPortLocation, this.freeVarInputTargets, this.nestingParents);
  }

  // Method to merge another builder's state (nodes, connections, free vars)
  merge(other: StringDiagramBuilder): StringDiagramBuilder {
      const newNodes = new Map([...this.nodes, ...other.nodes]);
      const newConnections = [...this.connections, ...other.connections];
      // Merge free vars - if a var is free in both, ensure targets are consistent or handle error
      // For simplicity, assume targets will be the same placeholder if generated independently
      const newFreeVars = new Map([...this.freeVarInputTargets, ...other.freeVarInputTargets]);
      const newNestingParents = new Map([...this.nestingParents, ...other.nestingParents]);

      // Output location is typically determined by the composing operation (e.g., AppNode output)
      // So we don't merge output locations directly here.
      return new StringDiagramBuilder(newNodes, newConnections, this.outputPortLocation, newFreeVars, newNestingParents);
  }


  withOutputLocation(outputLocation: PortLocation | null): StringDiagramBuilder {
    return new StringDiagramBuilder(this.nodes, this.connections, outputLocation, this.freeVarInputTargets, this.nestingParents);
  }

  // Remove a free variable target (used when binding in LamNode)
  withoutFreeVariable(varName: string): StringDiagramBuilder {
      const newFreeVars = new Map(this.freeVarInputTargets);
      newFreeVars.delete(varName);
      return new StringDiagramBuilder(this.nodes, this.connections, this.outputPortLocation, newFreeVars, this.nestingParents);
  }


  // --- Final Assembly Methods ---

  // buildDiagram now takes the final interface
  buildDiagram(externalInterface: PortInterface): StringDiagram {
    const diagram = new StringDiagram();
    // Pass the calculated interface
    diagram._populateInternal(new Map(this.nodes), [...this.connections], externalInterface, this.nestingParents);
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
      this.nodes,
      [...this.connections, newConnection], // Add the boundary connection
      this.outputPortLocation,
      newFreeVars,
      this.nestingParents // TODO: Is this right?
    );

    return { builder: newBuilder, portId: inputPortId };
  }

  connectOutputToDiagramOutput(): { builder: StringDiagramBuilder; portId: PortId; } {
    if (!this.outputPortLocation) {
      // It's valid for some terms (like just a free var) to not have an output before final connection
      // Let's re-evaluate if this check is needed here or if the caller handles it.
      // If called, we assume there *is* an output to connect.
       throw new Error("Builder has no output location to connect.");
    }
    const outputPortId = StringDiagram.createOutputId();
    const target: PortLocation = { type: 'DiagramOutput', id: outputPortId };
    const newConnection: Connection = {
      id: StringDiagram.createConnectionId(),
      source: this.outputPortLocation,
      target
    };

    const newBuilder = new StringDiagramBuilder(
      this.nodes,
      [...this.connections, newConnection], // Add the boundary connection
      this.outputPortLocation, // Keep internal source location for reference
      this.freeVarInputTargets,
      this.nestingParents // TODO: Is this right?
    );
    return { builder: newBuilder, portId: outputPortId };
  }

  // Removed calculateExternalInterface
}

// --- Top-Level Conversion Function ---
export function termToStringDiagram(term: Term): StringDiagram {
  // Start recursion with empty contexts
  const builderResult = termToStringDiagramBuilder(term, new Map(), [], null);

  let finalBuilder = builderResult;
  const finalInputPorts: PortId[] = [];
  const finalOutputPorts: PortId[] = [];

  // Connect free variables to diagram inputs
  // Iterate over keys of the *original* free var map from builderResult
  for (const varName of builderResult.freeVarInputTargets.keys()) {
      const { builder, portId } = finalBuilder.connectFreeVarToDiagramInput(varName);
      finalBuilder = builder; // Update builder state after adding connection
      finalInputPorts.push(portId);
  }

  // Connect output to diagram output, if one exists
  if (finalBuilder.outputPortLocation) {
      const { builder, portId } = finalBuilder.connectOutputToDiagramOutput();
      finalBuilder = builder; // Update builder state
      finalOutputPorts.push(portId);
  }

  // Construct the final interface based on generated ports
  const finalInterface: PortInterface = { inputPorts: finalInputPorts, outputPorts: finalOutputPorts };

  console.log('finalBuilder connections', JSON.stringify(finalBuilder.connections));
  // Build the diagram using the final builder state and the calculated interface
  return finalBuilder.buildDiagram(finalInterface);
}


// --- Recursive Builder Function ---
function termToStringDiagramBuilder(
  term: Term,
  freeVarContext: ReadonlyMap<string, PortLocation>,
  boundVarEnv: BoundVarEnv,
  currentNestingParentId: NodeId | null
): StringDiagramBuilder {
  switch (term.type) {
    case 'Var':
      return termToVarBuilder(term, freeVarContext, boundVarEnv);

    case 'Lam':
      return termToLamBuilder(term, freeVarContext, boundVarEnv, currentNestingParentId);

    case 'App':
      return termToAppBuilder(term, freeVarContext, boundVarEnv, currentNestingParentId);

    case 'unit':
       // Create a UnitNode
       const unitNode: UnitNode = new UnitNode('()');
       const portId = unitNode.externalInterface.outputPorts[0]
       if (!portId) {
         throw new Error("UnitNode has no output port defined.");
       }
       const outputLoc: PortLocation = { type: 'NodeOutput', id: unitNode.id, portId };

       let stringDiagramBuilder = StringDiagramBuilder.empty()
                .addNode(unitNode)
                .withOutputLocation(outputLoc);

      if (currentNestingParentId) {
        stringDiagramBuilder = stringDiagramBuilder.addNestingParent(unitNode.id, currentNestingParentId);
      }

       return stringDiagramBuilder

    case 'Ann':
      // Ignore annotation for diagram structure, process the inner term
      return termToStringDiagramBuilder(term.term, freeVarContext, boundVarEnv, currentNestingParentId);

    // Cases to ignore or handle specifically:
    case 'UnitTy':
    case 'Empty':
    case 'Type':
    case 'Pi':
      // These types don't typically have a direct diagrammatic representation
      // in the same way as terms. Return an empty builder.
      // If Pi types need representation, add specific logic here.
      return StringDiagramBuilder.empty();

    default:
       // Ensure all cases are handled (requires TS config for exhaustiveness checks)
       const _exhaustiveCheck: never = term;
       throw new Error(`Unhandled term type in termToStringDiagramBuilder: ${(_exhaustiveCheck as any)?.type}`);
  }
}

// --- Specific Term Handlers ---

function termToVarBuilder(
  term: VarTerm,
  freeVarContext: ReadonlyMap<string, PortLocation>,
  boundVarEnv: BoundVarEnv
): StringDiagramBuilder {
  if (term.kind === 'BoundVar') {

    const index = term.index;
    if (index < 0 || index >= boundVarEnv.length) {
      throw new Error(`De Bruijn index ${index} out of bounds.`);
    }
    const location = boundVarEnv[index]!; // Index directly corresponds to env array index
    // Return a builder representing just this location as output
    console.log("termToVarBuilder:", term, "found in boundVarEnv", location);
    return StringDiagramBuilder.empty().withOutputLocation(location);
  } else { // term.kind === 'FreeVar'
    const varName = term.name;
    const locationInFreeContext = freeVarContext.get(varName);

    if (locationInFreeContext) {
      // Free variable already seen in an outer scope (passed down)
      console.log("termToVarBuilder:", term, "found in freeVarContext", locationInFreeContext);
      return StringDiagramBuilder.empty().withOutputLocation(locationInFreeContext);
    } else {
      // Globally free variable - create placeholder and record it
      // Using a temporary node ID for the placeholder location
      const placeholderNodeId = `freevar_${varName}_${StringDiagram.createNodeId()}`;
      const placeholderPortId = StringDiagram.createInputId(); // Represents the needed input
      const placeholderLocation: PortLocation = { type: 'NodeInput', id: placeholderNodeId, portId: placeholderPortId };

      console.log("termToVarBuilder:", term, "not found in freeVarContext, creating placeholder", placeholderLocation);

      // The builder's output *is* this placeholder, and it requires input *at* this placeholder
      const freeVarsMap = new Map([[varName, placeholderLocation]]);
      return new StringDiagramBuilder(new Map(), [], placeholderLocation, freeVarsMap, new Map());
    }
  }
}

function termToLamBuilder(
  term: LamTerm,
  freeVarContext: ReadonlyMap<string, PortLocation>,
  boundVarEnv: BoundVarEnv,
  currentNestingParentId: NodeId | null // The LamNode containing *this* LamNode (if any)
): StringDiagramBuilder {
  // 1. Create the LamNode and its internal PortBarNodes
  // const lamNode: LamNode = new LamNode('λ'); // The main container node
  const lamNode: LamNode = new LamNode(''); // The main container node
  const paramBarNode: PortBarNode = new PortBarNode('param', true);
  const resultBarNode: PortBarNode = new PortBarNode('result', false);

  // Optional: Link IDs if you added properties to LamNode
  lamNode.parameterBarId = paramBarNode.id;
  lamNode.resultBarId = resultBarNode.id;

  // 2. Define the source for the bound variable within the body
  // It now comes from the output of the parameter bar
  const portId = paramBarNode.externalInterface.outputPorts[0];
  if (!portId) {
      throw new Error("Parameter bar node has no output port defined.");
  }
  const paramSourceLocationForBody: PortLocation = {
      type: 'NodeOutput',
      id: paramBarNode.id,
      portId
  };
  console.log("paramSourceLocationForBody (from paramBar):", paramSourceLocationForBody);

  // 3. Recursively build the body, passing the *lamNode.id* as the new nesting parent
  const newBoundVarEnv: BoundVarEnv = [paramSourceLocationForBody, ...boundVarEnv];
  // IMPORTANT: Pass lamNode.id as the currentNestingParentId for the body
  const bodyBuilder = termToStringDiagramBuilder(term.body, freeVarContext, newBoundVarEnv, lamNode.id);

  // 4. Start assembling the result builder
  let resultBuilder = StringDiagramBuilder.empty()
                          .merge(bodyBuilder); // Merge body nodes/connections first

  // 5. Add the LamNode and PortBarNodes
  resultBuilder = resultBuilder
                      .addNode(lamNode)
                      .addNode(paramBarNode)
                      .addNode(resultBarNode);

  // 6. Set nesting relationships
  resultBuilder = resultBuilder
                      .addNestingParent(paramBarNode.id, lamNode.id)
                      .addNestingParent(resultBarNode.id, lamNode.id);
                      // Note: The body's nodes should have already had their nesting parent
                      // set during the recursive call in step 3.

  // 7. Connect Body Output to Result Bar Input
  if (bodyBuilder.outputPortLocation) {
    const resultBarInputTarget: PortLocation = {
        type: 'NodeInput',
        id: resultBarNode.id,
        portId: resultBarNode.externalInterface.inputPorts[0]!
    };
    resultBuilder = resultBuilder.addConnection(
        bodyBuilder.outputPortLocation,
        resultBarInputTarget
    );
  } else {
    // Handle case where lambda body has no discernible output?
    // Maybe connect a default source or leave result bar input unconnected.
     console.warn(`Lambda body for ${lamNode.id} has no output location.`);
  }

  // 8. Connect Result Bar Output to LamNode's Conceptual Output Target
  const outPortId = lamNode.externalInterface.outputPorts[0];
  if (!outPortId) {
      throw new Error("LamNode has no output port defined.");
  }
  const resultBarOutputSource: PortLocation = {
      type: 'NodeOutput',
      id: resultBarNode.id,
      portId: outPortId
  };
  // This target represents the *input side* of the LamNode's *external* output port boundary
  const externalOutPortId = lamNode.externalInterface.outputPorts[0];
  if (!externalOutPortId) {
      throw new Error("LamNode has no external output port defined.");
  }
  const lamExternalOutputTarget: PortLocation = {
      type: 'NodeInput', // Connection *into* the LamNode boundary
      id: lamNode.id,
      portId: externalOutPortId
  };
  resultBuilder = resultBuilder.addConnection(resultBarOutputSource, lamExternalOutputTarget);


  // 9. Set the Overall Output Location
  // The final output location for the *entire* lambda expression construct
  // is the *output side* of the LamNode's external boundary.
  const finalOutputPortId = lamNode.externalInterface.outputPorts[0]
  if (!finalOutputPortId) {
      throw new Error("LamNode has no external output port defined.");
  }
  const finalOutputLocation: PortLocation = {
      type: 'NodeOutput', // Connection *out of* the LamNode boundary
      id: lamNode.id,
      portId: finalOutputPortId
  };
  resultBuilder = resultBuilder.withOutputLocation(finalOutputLocation);


  // 10. Handle currentNestingParentId for the LamNode itself
  // This sets the parent if *this* LamNode is nested inside another one.
  let finalNestingParents = new Map(resultBuilder.nestingParents);
  if (currentNestingParentId) {
      finalNestingParents.set(lamNode.id, currentNestingParentId);
  }
  // Update the builder with the potentially modified nesting parents map
  resultBuilder = new StringDiagramBuilder(
      resultBuilder.nodes,
      resultBuilder.connections,
      resultBuilder.outputPortLocation,
      resultBuilder.freeVarInputTargets,
      finalNestingParents
  );

  return resultBuilder;
}

// function termToLamBuilder(
//     term: LamTerm,
//     freeVarContext: ReadonlyMap<string, PortLocation>,
//     boundVarEnv: BoundVarEnv,
//     currentNestingParentId: NodeId | null
// ): StringDiagramBuilder {
//     const lamNode: LamNode = new LamNode('λ');

//     // Location where the bound variable originates *inside* the lambda body's context
//     const paramSourceLocationForBody: PortLocation =
//       { type: 'NodeOutput',
//         id: lamNode.id,
//         portId: lamNode.internalInterface.inputPorts[0]!
//       };
//     console.log("paramSourceLocationForBody", paramSourceLocationForBody);

//     const newBoundVarEnv: BoundVarEnv = [paramSourceLocationForBody, ...boundVarEnv];
//     const bodyBuilder = termToStringDiagramBuilder(term.body, freeVarContext, newBoundVarEnv, lamNode.id);

//     let resultBuilder = StringDiagramBuilder.empty().merge(bodyBuilder);

//     //    Add the LamNode itself
//     resultBuilder = resultBuilder.addNode(lamNode);

//     let finalNestingParents = new Map(resultBuilder.nestingParents);

//     if (currentNestingParentId) {
//         finalNestingParents.set(lamNode.id, currentNestingParentId);
//     }

//     let newBuilder = new StringDiagramBuilder(
//         resultBuilder.nodes,
//         resultBuilder.connections,
//         resultBuilder.outputPortLocation,
//         resultBuilder.freeVarInputTargets,
//         finalNestingParents
//     );

//     //    Connect the body's output (if it exists) to the LamNode's output port
//     if (newBuilder.outputPortLocation) {
//       const lamExternalOutputSource: PortLocation =
//         { type: 'NodeInput',
//           id: lamNode.id,
//           portId: lamNode.externalInterface.outputPorts[0]!
//         };
//         newBuilder = newBuilder.addConnection(
//             newBuilder.outputPortLocation,
//             // Target is the *input* side of the LamNode's output port boundary
//             lamExternalOutputSource
//         );
//     } else {
//         // Handle case where lambda body has no output (e.g., `λx.y` where y is free)
//         // The LamNode's output port remains unconnected from the inside.
//     }

//     //    The overall output location is now the LamNode's external output port
//     newBuilder = newBuilder.withOutputLocation({ type: 'NodeOutput', id: lamNode.id, portId: lamNode.externalInterface.outputPorts[0]! });

//     return newBuilder;
// }


function termToAppBuilder(
    term: AppTerm,
    freeVarContext: ReadonlyMap<string, PortLocation>,
    boundVarEnv: BoundVarEnv,
    currentNestingParentId: NodeId | null
): StringDiagramBuilder {
    // 1. Recursively process func and arg
    const funcBuilder = termToStringDiagramBuilder(term.func, freeVarContext, boundVarEnv, currentNestingParentId);
    const argBuilder = termToStringDiagramBuilder(term.arg, freeVarContext, boundVarEnv, currentNestingParentId);

    // 2. Create AppNode structure
    const appNode: AppNode = new AppNode('@'); // Placeholder label, adjust as needed

    // 3. Combine nodes, connections, free variables from children
    let resultBuilder = StringDiagramBuilder.empty()
                            .merge(funcBuilder)
                            .merge(argBuilder);

    // 4. Add the AppNode itself
    resultBuilder = resultBuilder.addNode(appNode);

    let finalNestingParents = new Map(resultBuilder.nestingParents);
    if (currentNestingParentId) {
        finalNestingParents.set(appNode.id, currentNestingParentId);
    }

    // 5. Add connections from func/arg outputs (if they exist) to AppNode inputs
    if (funcBuilder.outputPortLocation) {
        resultBuilder = resultBuilder.addConnection(
            funcBuilder.outputPortLocation,
            { type: 'NodeInput', id: appNode.id, portId: appNode.externalInterface.inputPorts[0]! }
        );
    }
    if (argBuilder.outputPortLocation) {
        resultBuilder = resultBuilder.addConnection(
            argBuilder.outputPortLocation,
            { type: 'NodeInput', id: appNode.id, portId: appNode.externalInterface.inputPorts[1]! }
        );
    }

    // 6. Set the final output location to the AppNode's output port
    const outPortId = appNode.externalInterface.outputPorts[0];
    if (!outPortId) {
        throw new Error("AppNode has no output port defined.");
    }
    resultBuilder = resultBuilder.withOutputLocation({ type: 'NodeOutput', id: appNode.id, portId: outPortId });

    resultBuilder = new StringDiagramBuilder(
        resultBuilder.nodes,
        resultBuilder.connections,
        resultBuilder.outputPortLocation,
        resultBuilder.freeVarInputTargets,
        finalNestingParents
    );

    return resultBuilder;
}