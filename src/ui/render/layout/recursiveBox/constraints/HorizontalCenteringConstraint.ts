// --- New/Adapted File: src/ui/render/layout/recursiveBox/constraints/HorizontalCenteringConstraint.ts ---
import { addRangePropagator, divNumericRangeNumberPropagator } from "../../../../../constraint/propagator/NumericRange";
import { unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class HorizontalCenteringConstraint implements Constraint {
    private _parentId: string;

    constructor(parentId: string) {
        this._parentId = parentId;
    }

    public apply(layoutTree: LayoutTree): void {
        const parentLayout = layoutTree.getNodeLayout(this._parentId);
        if (!parentLayout) return;

        const childrenIds = layoutTree.getChildren(this._parentId);
        const net = layoutTree.net;
        const parentCenterX = parentLayout.intrinsicBox.centerX;

        if (childrenIds.length === 0) {
            // Optional: If you had subtree boxes, you'd equate them here.
            // Since we don't, maybe do nothing, or ensure intrinsic center is used somehow?
            // For now, let's assume parent centerX is determined by its own box if no children.
             console.log(`Centering ${this._parentId}: No children.`);
            return;
        }

        if (childrenIds.length === 1) {
            const childLayout = layoutTree.getNodeLayout(childrenIds[0]!);
            if (childLayout) {
                console.log(`Centering ${this._parentId}: 1 child (${childrenIds[0]!}).`);
                net.equalPropagator(
                    `CenterParentOnSingleChild: ${this._parentId}`,
                    parentCenterX,
                    childLayout.intrinsicBox.centerX
                );
            }
            return;
        }

        // More than 1 child
        // Assume childrenIds are implicitly ordered by the sibling constraint (left-to-right)
        const firstChildLayout = layoutTree.getNodeLayout(childrenIds[0]!);
        const lastChildLayout = layoutTree.getNodeLayout(childrenIds[childrenIds.length - 1]!);

        if (!firstChildLayout || !lastChildLayout) {
            console.warn(`Centering ${this._parentId}: Could not find first or last child layout.`);
            return;
        }
        console.log(`Centering ${this._parentId}: >1 child (${childrenIds[0]!}...${childrenIds[childrenIds.length - 1]!}).`);


        const firstChildCenterX = firstChildLayout.intrinsicBox.centerX;
        const lastChildCenterX = lastChildLayout.intrinsicBox.centerX;

        const centerSum = net.newCell(`${this._parentId}_child_center_sum`, unknown());
        const halfCenterSum = net.newCell(`${this._parentId}_child_half_center_sum`, unknown());

        // centerSum = firstChildCenterX + lastChildCenterX
        addRangePropagator(
            `calc_centerSum_${this._parentId}`,
            net,
            firstChildCenterX,
            lastChildCenterX,
            centerSum
        );

        // halfCenterSum = centerSum / 2
        divNumericRangeNumberPropagator(
            `calc_halfCenterSum_${this._parentId}`,
            net,
            centerSum,
            2,
            halfCenterSum
        );

        // parentCenterX = halfCenterSum
        net.equalPropagator(
             `ApplyCenter_${this._parentId}`,
             parentCenterX,
             halfCenterSum
        );
    }
}