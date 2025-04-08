import { addRangePropagator, exactly, lessThanEqualPropagator } from "../../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../../constraint/propagator/Propagator";
import { PortBarType } from "../../../../../components/Nodes/nodeTypes";
import { Constraint } from "../../Constraint";
import { LayoutTree } from "../../LayoutTree";

export class PortBarVerticalConstraint implements Constraint {
  private readonly _PADDING_VERTICAL = 10;

  constructor(
    private _nodeId: string,
    private _nestingParentId: string,
    private _portBarType: PortBarType
  ) {}

  apply(layoutTree: LayoutTree): void {
    const nodeLayout = layoutTree.getNodeLayout(this._nodeId);
    const parentLayout = layoutTree.getNodeLayout(this._nestingParentId);
    const paddingCell = layoutTree.net.newCell(
      `PortBarVerticalConstraint: [vertical padding] ${this._nodeId}`,
      known(exactly(this._PADDING_VERTICAL))
    );

    if (!nodeLayout) {
      console.warn(`Node layout for ${this._nodeId} not found`);
      return;
    }

    if (!parentLayout) {
      console.warn(`Parent layout for ${this._nestingParentId} not found`);
      return;
    }

    const topWithPadding = layoutTree.net.newCell(
      `PortBarVerticalConstraint: [top] ${this._nodeId} with padding`,
      unknown()
    );
    const bottomWithPadding = layoutTree.net.newCell(
      `PortBarVerticalConstraint: [bottom] ${this._nodeId} with padding`,
      unknown()
    );

    // topWithPadding = nodeLayout.top - _PADDING_VERTICAL
    addRangePropagator(
      `PortBarVerticalConstraint: [top] ${this._nodeId} with padding`,
      layoutTree.net,
      nodeLayout.intrinsicBox.top,
      paddingCell,
      topWithPadding
    );

    // bottomWithPadding = nodeLayout.bottom + _PADDING_VERTICAL
    addRangePropagator(
      `PortBarVerticalConstraint: [bottom] ${this._nodeId} with padding`,
      layoutTree.net,
      nodeLayout.intrinsicBox.bottom,
      paddingCell,
      bottomWithPadding
    );

    layoutTree.net.addDebugCell(
      `PortBarVerticalConstraint: [node, debug] ${this._nodeId}`,
      nodeLayout.intrinsicBox.top
    );

    if (this._portBarType === 'parameter-bar') {
      lessThanEqualPropagator(
        `PortBarVerticalConstraint: [top] ${this._nodeId}`,
        layoutTree.net,
        topWithPadding,
        parentLayout.intrinsicBox.top,
      );
    } else if (this._portBarType === 'result-bar') {
      layoutTree.net.equalPropagator(
        `PortBarVerticalConstraint: [bottom] ${this._nodeId}`,
        // layoutTree.net,
        bottomWithPadding,
        parentLayout.intrinsicBox.bottom,
      );
    }
  }
}