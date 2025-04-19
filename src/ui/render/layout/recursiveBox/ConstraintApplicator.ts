// src/ui/render/layout/recursiveBox/ConstraintApplicator.ts

import { layout } from "dagre";
import { LayoutTree } from "../recursiveBox/LayoutTree";
import { exactly, getMin } from "../../../../constraint/propagator/NumericRange";
import { known } from "../../../../constraint/propagator/Propagator";
// Import isNodePortLocation
import { isNode } from "reactflow";
import { determineLayers } from "../../../../utils/LevelOrder";
import { NodeId } from "../../../../engine/Term";
import { PortBarType } from "../../../components/Nodes/nodeTypes";
import { Constraint } from "./Constraint";
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { ContainerSizeConstraint } from "./constraints/container/ContainerSizeConstraint";

export class ConstraintApplicator {
  private _constraints: Constraint[] = [];

  public processLayout(layoutTree: LayoutTree): void {
    const layouts = layoutTree.nodeLayouts.values()

    for (const layout of layouts) {
      ConstraintApplicator.debugLeaves(layoutTree, layout.nodeId);

      // // if (layout.portBarType) {
      // //   if (!layout.nestingParentId) {
      // //     console.warn(`Port bar layout with nodeId ${layout.nodeId} has no nestingParentId`);
      // //     continue
      // //   }

      // //   this.portBarConstraints(layoutTree, layout.nodeId, layout.nestingParentId, layout.portBarType);
      // // }

      // if (rootIds.has(layout.nodeId)) {
      //   const topCell = layout.intrinsicBox.top;
      //   console.log(`Attempting to pin root node ${layout.nodeId} top (Cell ID: ${layoutTree.net.cellDescription(topCell)}) to 0`);
      //   layoutTree.net.writeCell(
      //       {description: `Top cell for ${layout.nodeId}`, inputs: [topCell], outputs: []},
      //       topCell,
      //       known(exactly(0))
      //   );
      // }
      
      const nestingChildren = layoutTree.getNestingChildren(layout.nodeId);
      console.log(`Nesting children for ${layout.nodeId}:`, nestingChildren);

      if (nestingChildren.length > 0) {
        this.containerConstraints(layoutTree, layout.nodeId, nestingChildren);
      }
    }

    this.performMinimization(layoutTree);
  }

  private performMinimization(layoutTree: LayoutTree): void {
    const cellsToMinimize = this._constraints
      .flatMap(constraint => constraint.cellsToMinimize())

    const minimizer = new Minimizer(layoutTree.net, cellsToMinimize);
    minimizer.minimize();
  }

  private containerConstraints(layoutTree: LayoutTree, containerId: string, nestedIds: string[]): void {
    const containerLayout = layoutTree.getNodeLayout(containerId);
    if (!containerLayout) {
      console.warn(`Container layout not found for ID: ${containerId}`);
      return;
    }
    const nestedLayouts = nestedIds.map(id => layoutTree.getNodeLayout(id)).filter(layout => layout !== undefined);
    if (nestedLayouts.length === 0) {
      console.warn(`No nested layouts found for IDs: ${nestedIds}`);
      return;
    }

    this.applyConstraint(
      new ContainerSizeConstraint(containerId, nestedIds),
      layoutTree
    );
  }


  private applyConstraint(constraint: Constraint, layoutTree: LayoutTree): void {
    constraint.apply(layoutTree);
    this._constraints.push(constraint);
  }

  private static debugLeaves(layoutTree: LayoutTree, nodeId: string): void {
    if (layoutTree.getChildren(nodeId).length === 0) {
      ConstraintApplicator.debugNode('leaf', layoutTree, nodeId);
    } else {
      ConstraintApplicator.debugNode('non-leaf', layoutTree, nodeId)
    }
  }

  private static debugNode(prefix: string, layoutTree: LayoutTree, nodeId: string): void {
    const nodeLayout = layoutTree.getNodeLayout(nodeId);
    if (nodeLayout) {
      const intrinsicBox = nodeLayout.intrinsicBox;
      const subtreeBox = nodeLayout.subtreeExtentBox;

      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.centerX);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.left);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.right);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.top);
      layoutTree.net.addDebugCell(prefix + `(${nodeLayout.label})` + ': ' + nodeId, intrinsicBox.bottom);
    }
  }
}