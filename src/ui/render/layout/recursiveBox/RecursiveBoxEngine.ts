import { NumericRange, partialSemigroupNumericRange, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { ConflictHandler, PropagatorNetwork } from "../../../../constraint/propagator/Propagator";
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { AppNode } from "../../../components/Nodes/nodeTypes";
import { ConstraintLayoutEngine, NodesAndEdges } from "../LayoutEngine";
import { ConstraintApplicator } from "./ConstraintApplicator";
import { LayoutTree } from "./LayoutTree";

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

  toReactFlow(layoutTree: LayoutTree): Promise<NodesAndEdges> {
    const constraintApplicator = new ConstraintApplicator();

    try {
      constraintApplicator.processLayout(layoutTree);

      layoutTree.printDebugInfo();
      layoutTree.net.printDebugCells(printNumericRange);

      const nodesAndEdges = layoutTree.toNodesAndEdges();
      console.log("Nodes and Edges:", nodesAndEdges);

      return Promise.resolve(nodesAndEdges);
    } catch (e) {
      console.error("Error applying constraints:", e);
      // throw e
      return Promise.resolve({ nodes: new Map<string, AppNode>(), edges: new Array() });
    }
  }

  // TODO: Implement this method
  renderDebugInfo(layoutTree: LayoutTree): Promise<NodesAndEdges> {
    return layoutTree.renderDebugInfo();
  }
}
