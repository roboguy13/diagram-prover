// src/ui/render/layout/recursiveBox/ConstraintApplicator.ts

import { layout } from "dagre";
import { LayoutTree } from "../recursiveBox/LayoutTree";
import { exactly } from "../../../../constraint/propagator/NumericRange";
import { known } from "../../../../constraint/propagator/Propagator";
// Import isNodePortLocation
import { Connection, isNodePortLocation } from "../../../../ir/StringDiagram";
import { isNode } from "reactflow";
import { determineLayers } from "../../../../utils/LevelOrder";
import { Constraint } from "@lume/kiwi";
import { NodeId } from "../../../../engine/Term";
import { PortBarType } from "../../../components/Nodes/nodeTypes";
import { PortBarVerticalConstraint } from "./constraints/PortBar/PortBarVerticalConstraint";
import { PortBarHorizontalConstraint } from "./constraints/PortBar/PortBarHorizontalConstraint";
import { ContainerSizeConstraint } from "./constraints/container/ContainerSizeConstraint";
import { PortBarContainedConstraint } from "./constraints/container/PortBarContainedConstraint";

export class ConstraintApplicator {
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
    for (const layout of layouts) {
      ConstraintApplicator.debugLeaves(layoutTree, layout.nodeId);

      if (layout.portBarType) {
        if (!layout.nestingParentId) {
          console.warn(`Port bar layout with nodeId ${layout.nodeId} has no nestingParentId`);
          continue
        }

        this.portBarConstraints(layoutTree, layout.nodeId, layout.nestingParentId, layout.portBarType);
      }

      const nestingChildren = layoutTree.getNestingChildren(layout.nodeId);
      console.log(`Nesting children for ${layout.nodeId}:`, nestingChildren);

      // Filter out port bars from nesting children
      const nonPortBarChildren = nestingChildren.filter(childId => {
        const childLayout = layoutTree.getNodeLayout(childId);
        return !childLayout?.portBarType;
      });

      if (nonPortBarChildren.length > 0) {

        this.containerConstraints(layoutTree, layout.nodeId, nonPortBarChildren);
      }
    }
  }

  private portBarConstraints(layoutTree: LayoutTree, nodeId: string, nestingParentId: string, portBarType: PortBarType): void {
    const portBarVerticalConstraint = new PortBarVerticalConstraint(nodeId, nestingParentId, portBarType);
    portBarVerticalConstraint.apply(layoutTree);

    const portBarHorizontalConstraint = new PortBarHorizontalConstraint(nodeId, nestingParentId);
    portBarHorizontalConstraint.apply(layoutTree);
  }

  private containerConstraints(layoutTree: LayoutTree, containerId: string, nestedIds: string[]): void {
    const containerSizeConstraint = new ContainerSizeConstraint(
      containerId,
      nestedIds
    );
    containerSizeConstraint.apply(layoutTree);

    const parameterPortBarId = layoutTree.getParameterPortBar(containerId);
    const resultPortBarId = layoutTree.getResultPortBar(containerId);

    const portBarContainedConstraint = new PortBarContainedConstraint(
      nestedIds,
      parameterPortBarId!,
      resultPortBarId!
    )
    portBarContainedConstraint.apply(layoutTree)
  }
}