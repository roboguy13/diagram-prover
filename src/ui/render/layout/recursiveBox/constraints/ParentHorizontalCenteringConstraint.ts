import { CellRef, PropagatorNetwork, unknown, known } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { addList, divNumber, sub, equal, addDebugPExpr } from "../../../../../constraint/propagator/PropagatorExpr";
import { NumericRange } from "../../../../../constraint/propagator/NumericRange";
import { runPropagatorExpr, runPropagatorRelation } from "../../../../../constraint/propagator/PropagatorLanguage";

// 
export class ParentHorizontalCenteringConstraint implements Constraint {
  constructor(
    private _parentId: string,
    private _childrenIds: string[]
  ) { }

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net;

    const parentLayout = layoutTree.getNodeLayout(this._parentId);
    if (!parentLayout) throw new Error(`Layout for node ${this._parentId} not found`);

    const childrenLayouts = this._childrenIds.map(id => layoutTree.getNodeLayout(id)).filter((l): l is NonNullable<typeof l> => l != null);
    if (childrenLayouts.length === 0) return;

    const parentBox = parentLayout.intrinsicBox;
    const childSubtreeWidths = childrenLayouts.map(l => l.subtreeExtentBox.width);

    // collectiveWidth = addList(childSubtreeWidths)
    const collectiveWidthExpr = addList(
        childSubtreeWidths,
        `collectiveWidth_${this._parentId}`
    );

    // --- Position the first child to center the group ---
    const firstChildLayout = childrenLayouts[0]!;
    const firstChildIntrinsicBox = firstChildLayout.intrinsicBox; // We position the node's own box

    // // targetFirstChildLeft = parentBox.centerX - halfCollectiveWidth
    // const targetFirstChildLeftExpr =
    //   sub(parentBox.centerX,
    //     divNumber(collectiveWidthExpr, 2),
    //     `targetFirstChildLeft_${firstChildLayout.nodeId}`
    //   );

    // // firstChildIntrinsicBox.left = parentBox.centerX - halfCollectiveWidth
    // equal(
    //     firstChildIntrinsicBox.left,
    //     targetFirstChildLeftExpr,
    //     `ParentHCenterAnchor: ${firstChildLayout.nodeId}.left = target`
    // )(net);

    runPropagatorRelation(net)`${firstChildIntrinsicBox.left} = ${parentBox.centerX} - (add(${childSubtreeWidths}) / 2)`;

    const debugPrefix = `ParentHCenter (${this._parentId} -> ${firstChildLayout.nodeId},...)`;
    addDebugPExpr(net, `${debugPrefix}: Parent CenterX`, parentBox.centerX);
    addDebugPExpr(net, `${debugPrefix}: Collective Width (Expr)`, collectiveWidthExpr);
    childSubtreeWidths.forEach((widthCell, i) => {
        addDebugPExpr(net, `${debugPrefix}: Child ${i} Subtree Width`, widthCell);
    });
    addDebugPExpr(net, `${debugPrefix}: First Child Left (Before)`, firstChildIntrinsicBox.left);
    // addDebugPExpr(net, `${debugPrefix}: Target First Child Left`, targetFirstChildLeftExpr);
    addDebugPExpr(net, `${debugPrefix}: First Child Left (After)`, firstChildIntrinsicBox.left);
  }

  cellsToMinimize(): CellRef[] {
    return [];
  }
}
