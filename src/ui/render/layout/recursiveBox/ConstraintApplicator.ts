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
import { PortBarVerticalConstraint } from "./constraints/PortBar/PortBarVerticalConstraint";
import { PortBarHorizontalConstraint } from "./constraints/PortBar/PortBarHorizontalConstraint";
import { ContainerSizeConstraint } from "./constraints/container/ContainerSizeConstraint";
import { PortBarContainedConstraint } from "./constraints/container/PortBarContainedConstraint";
import { Constraint } from "./Constraint";
import { Minimizer } from "../../../../constraint/propagator/Minimize";

export class ConstraintApplicator {
  private _constraints: Constraint[] = [];

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

  public processLayout(layoutTree: LayoutTree): void {
    const layouts = layoutTree.nodeLayouts.values()
    const rootIds = new Set(layoutTree.allRoots);

    for (const layout of layouts) {
      ConstraintApplicator.debugLeaves(layoutTree, layout.nodeId);

      // if (layout.portBarType) {
      //   if (!layout.nestingParentId) {
      //     console.warn(`Port bar layout with nodeId ${layout.nodeId} has no nestingParentId`);
      //     continue
      //   }

      //   this.portBarConstraints(layoutTree, layout.nodeId, layout.nestingParentId, layout.portBarType);
      // }

      if (rootIds.has(layout.nodeId)) {
        const topCell = layout.intrinsicBox.top;
        console.log(`Attempting to pin root node ${layout.nodeId} top (Cell ID: ${layoutTree.net.cellDescription(topCell)}) to 0`);
        layoutTree.net.writeCell(
            {description: `Top cell for ${layout.nodeId}`, inputs: [topCell], outputs: []},
            topCell,
            known(exactly(0))
        );
      }
      
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

  private portBarConstraints(layoutTree: LayoutTree, nodeId: string, nestingParentId: string, portBarType: PortBarType): void {
    const portBarVerticalConstraint = new PortBarVerticalConstraint(nodeId, nestingParentId, portBarType);
    this.applyConstraint(portBarVerticalConstraint, layoutTree);

    const portBarHorizontalConstraint = new PortBarHorizontalConstraint(nodeId, nestingParentId);
    this.applyConstraint(portBarHorizontalConstraint, layoutTree);
  }

  private containerConstraints(layoutTree: LayoutTree, containerId: string, nestedIds: string[]): void {
    const containerSizeConstraint = new ContainerSizeConstraint(
      containerId,
      nestedIds
    );
    this.applyConstraint(containerSizeConstraint, layoutTree);

    const parameterPortBarId = layoutTree.getParameterPortBar(containerId);
    const resultPortBarId = layoutTree.getResultPortBar(containerId);

    const portBarContainedConstraint = new PortBarContainedConstraint(
      nestedIds,
      parameterPortBarId!,
      resultPortBarId!
    )
    this.applyConstraint(portBarContainedConstraint, layoutTree)
  }

  private applyConstraint(constraint: Constraint, layoutTree: LayoutTree): void {
    constraint.apply(layoutTree);
    this._constraints.push(constraint);
  }
}