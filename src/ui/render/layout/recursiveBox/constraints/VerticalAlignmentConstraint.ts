import { CellRef } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeId } from "../../../../../ir/StringDiagram";
import { PropagatorInterpreter } from "../../../../../constraint/propagator/PropagatorLanguage";

// Aligns the top edges of sibling nodes' subtree extents.
export class VerticalAlignmentConstraint implements Constraint {
  constructor(private _siblingNodeIds: NodeId[]) {}

  apply(layoutTree: LayoutTree): void {
    if (this._siblingNodeIds.length < 2) {
      return; // No alignment needed for 0 or 1 node
    }

    const net = layoutTree.net;
    const solver = new PropagatorInterpreter(net, 'VerticalAlignmentConstraint');
    const layouts = this._siblingNodeIds.map(id => layoutTree.getNodeLayout(id));

    if (layouts.some(l => !l)) {
      console.warn(`VerticalAlignmentConstraint: Layout not found for one or more siblings: ${this._siblingNodeIds.filter((id, i) => !layouts[i]).join(', ')}`);
      return;
    }

    const firstSiblingTop = layouts[0]!.subtreeExtentBox.top;

    for (let i = 1; i < layouts.length; i++) {
      const siblingTop = layouts[i]!.subtreeExtentBox.top;

      solver.addRelation`${siblingTop} = ${firstSiblingTop}`;
    }
  }

  cellsToMinimize(): CellRef[] {
    return [];
  }

  get debugBoxes() {
    return [];
  }
}