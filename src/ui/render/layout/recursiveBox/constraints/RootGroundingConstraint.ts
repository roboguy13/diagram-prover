import { atLeast, exactly } from "../../../../../constraint/propagator/NumericRange";
import { known } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeLayout } from "../NodeLayout"; // Assuming NodeLayout is exported or adjust path
import { HorizontalSpacingConstraint } from "./HorizontalSpacingConstraint"; // Import the horizontal constraint
// Add necessary imports for PropagatorNetwork types if needed directly

export class RootGroundingConstraint implements Constraint {

  constructor() { }

  apply(layoutTree: LayoutTree): void {
    const net = layoutTree.net;
    // Sort roots for consistent horizontal placement order
    // Ensure allRoots is accessible, might need a getter in LayoutTree
    const sortedRoots = [...layoutTree.allRoots].sort();

    if (sortedRoots.length === 0) {
        console.warn("RootGroundingConstraint: No roots found in LayoutTree.");
        return;
    }

    let previousRootLayout: NodeLayout | null = null;

    for (let i = 0; i < sortedRoots.length; i++) {
        const rootId = sortedRoots[i]!;
        const rootLayout = layoutTree.getNodeLayout(rootId);

        if (!rootLayout) {
            console.warn(`RootGroundingConstraint: Layout for root node ${rootId} not found.`);
            continue;
        }
        const rootBox = rootLayout.intrinsicBox;

        // Ground all roots vertically: root.top >= 0
        net.writeCell(
            { description: `Ground root ${rootId} top >= 0`, inputs: [], outputs: [rootBox.top] },
            rootBox.top,
            known(atLeast(0))
        );

        if (i === 0) {
            // Ground the very first root horizontally at left = 0
            net.writeCell(
                { description: `Ground first root ${rootId} left = 0`, inputs: [], outputs: [rootBox.left] },
                rootBox.left,
                known(exactly(0))
            );
        } else if (previousRootLayout) {
            // Apply horizontal spacing between this root and the previous one
            // Using the existing HorizontalSpacingConstraint class
            const horizontalConstraint = new HorizontalSpacingConstraint(
                previousRootLayout.nodeId, // Previous root ID
                rootId                    // Current root ID
            );
            horizontalConstraint.apply(layoutTree);
        }
        previousRootLayout = rootLayout;
    }
  }
}