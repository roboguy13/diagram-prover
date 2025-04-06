import { NumericRange, partialSemigroupNumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { ConflictHandler, PropagatorNetwork } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { StringDiagram } from "../../../../ir/StringDiagram";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { ConstraintLayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { ConstraintApplicator } from "./ConstraintApplicator";
import { LayoutTree } from "./LayoutTree";

const LOG_PROPAGATOR_NETWORK_SIZE = true 

export class RecursiveBoxEngine implements ConstraintLayoutEngine<LayoutTree> {
  private _conflictHandlers: ConflictHandler<NumericRange>[]

  constructor() {
    this._conflictHandlers = []
  }

  addConflictHandler(handler: ConflictHandler<NumericRange>) {
    this._conflictHandlers.push(handler)
  }

  fromSemanticNode(n: SemanticNode<void>, activeRedexId: string | null): Promise<LayoutTree> {
    const net = new PropagatorNetwork<NumericRange>(printNumericRange, partialSemigroupNumericRange(), this._conflictHandlers)
    return Promise.resolve(LayoutTree.buildFromSemanticNode(net, n));
  }

  fromStringDiagram(diagram: StringDiagram, activeRedexId: string | null): Promise<LayoutTree> {
    const net = new PropagatorNetwork<NumericRange>(printNumericRange, partialSemigroupNumericRange(), this._conflictHandlers)
    return Promise.resolve(LayoutTree.buildFromStringDiagram(net, diagram));
  }

  toReactFlow(layoutTree: LayoutTree): Promise<NodesAndEdges> {
    console.log("Layout tree:", layoutTree);
    const constraintApplicator = new ConstraintApplicator();

    try {
      constraintApplicator.processLayout(layoutTree);

      layoutTree.printDebugInfo();
      layoutTree.net.printDebugCells(printNumericRange);

      const nodesAndEdges = layoutTree.toNodesAndEdges();
      console.log("Nodes and Edges:", nodesAndEdges);

      if (LOG_PROPAGATOR_NETWORK_SIZE) {
        console.log("Propagator network cell count:", layoutTree.net.cells().length)
        console.log("Propagator count:", layoutTree.net.propagatorConnections.length)
      }

      return Promise.resolve(nodesAndEdges);
    } catch (e) {
      console.error("Error applying constraints:", e);
      throw e
      return Promise.resolve({ nodes: new Map<string, AppNode>(), edges: new Array() });
    }
  }

  // TODO: Implement this method
  renderDebugInfo(layoutTree: LayoutTree): Promise<NodesAndEdges> {
    return layoutTree.renderDebugInfo();
  }
}
