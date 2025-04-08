import { add } from "lodash";
import { addRangePropagator, exactly, lessThan, lessThanEqualPropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { PortBarType } from "../../../../components/Nodes/nodeTypes";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";

export class PortBarVerticalConstraint implements Constraint {
  // Remove padding constant - padding handled by ContainerSizeConstraint now

  constructor(
      private _nodeId: string, // This is the ID of the PortBarNode itself
      private _portBarType: PortBarType
  ) {}

  apply(layoutTree: LayoutTree): void {
      const portBarLayout = layoutTree.getNodeLayout(this._nodeId);
      if (!portBarLayout || !portBarLayout.nestingParentId) {
          console.warn(`PortBarVerticalConstraint: Port bar layout or parent ID not found for ${this._nodeId}.`);
          return;
      }
      const parentLayout = layoutTree.getNodeLayout(portBarLayout.nestingParentId);
      if (!parentLayout) {
           console.warn(`PortBarVerticalConstraint: Parent layout not found for ${portBarLayout.nestingParentId}.`);
          return;
      }

      const net = layoutTree.net;
      const portBarBox = portBarLayout.intrinsicBox;
      const parentBox = parentLayout.intrinsicBox;

      if (this._portBarType === 'parameter-bar') {
          console.log(`PortBarVerticalConstraint [Simple]: Aligning ${this._nodeId}.top = ${parentLayout.nodeId}.top`);
          // Enforce portBarBox.top = parentBox.top
          net.equalPropagator( // Or simulate equality
              `align_param_bar_${this._nodeId}_top_to_parent_top`,
              portBarBox.top,
              parentBox.top
          );
      } else if (this._portBarType === 'result-bar') {
          console.log(`PortBarVerticalConstraint [Simple]: Aligning ${this._nodeId}.bottom = ${parentLayout.nodeId}.bottom`);
           // Enforce portBarBox.bottom = parentBox.bottom
          net.equalPropagator( // Or simulate equality
              `align_result_bar_${this._nodeId}_bottom_to_parent_bottom`,
              portBarBox.bottom,
              parentBox.bottom
          );
      }
  }
}

// export class PortBarVerticalConstraint implements Constraint {
//   private readonly _VERTICAL_SPACING = 10;

//   constructor(
//     private _nodeId: string,
//     private _portBarType: PortBarType) { }

//   apply(layoutTree: LayoutTree): void {
//     const nodeLayout = layoutTree.getNodeLayout(this._nodeId);
//     if (!nodeLayout) {
//       console.warn(`PortBarVerticalConstraint: Node layout for ID ${this._nodeId} not found.`);
//       return;
//     }

//     const net = layoutTree.net;
//     const intrinsicBox = nodeLayout.intrinsicBox;

//     if (this._portBarType === 'parameter-bar') {
//       console.log(`PortBarVerticalConstraint: [Top] Applying constraint for node ${this._nodeId} with portBarType ${this._portBarType}`);

//       // Align the top of the node with the top of its parent
//       const parentLayout = layoutTree.getNodeLayout(nodeLayout.nestingParentId!);
//       if (parentLayout) {
//         const parentBox = parentLayout.intrinsicBox;

//         const spacingCell = net.newCell(
//           `padding_${this._nodeId}_to_parent_${nodeLayout.nestingParentId}`,
//           known(exactly(this._VERTICAL_SPACING))
//         )

//         const topWithSpacing = net.newCell(
//           `temp_${this._nodeId}.top+${this._VERTICAL_SPACING}`,
//           unknown()
//         );

//         addRangePropagator(
//           `calc_${net.cellDescription(topWithSpacing)}`,
//           net,
//           intrinsicBox.top,
//           spacingCell,
//           topWithSpacing
//         );

//         net.equalPropagator(
//           `align_${this._nodeId}_top_to_parent_${nodeLayout.nestingParentId}`,
//           intrinsicBox.top,
//           topWithSpacing,
//         );
//       }
//     } else if (this._portBarType === 'result-bar') {
//       console.log(`PortBarVerticalConstraint: [Bottom] Applying constraint for node ${this._nodeId} with portBarType ${this._portBarType}`);
//       // Align the bottom of the node with the bottom of its parent
//       const parentLayout = layoutTree.getNodeLayout(nodeLayout.nestingParentId!);
//       if (parentLayout) {
//         const parentBox = parentLayout.intrinsicBox;
//         lessThanEqualPropagator(
//           `align_${this._nodeId}_bottom_to_parent_${nodeLayout.nestingParentId}`,
//           net,
//           intrinsicBox.bottom,
//           parentBox.bottom
//         );
//       }
//     }
//   }
// }