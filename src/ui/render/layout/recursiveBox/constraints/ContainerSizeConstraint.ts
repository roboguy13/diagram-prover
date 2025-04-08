// src/ui/render/layout/recursiveBox/constraints/ContainerSizeConstraint.ts
import { layout } from "dagre";
import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator, writeAtLeastPropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeLayout } from "../NodeLayout";

export class ContainerSizeConstraint implements Constraint {
    // Use overall padding constants
    public static readonly _PADDING_X = 20; // Total horizontal padding
    public static readonly _PADDING_Y = 20; // Total vertical padding
    // Remove specific edge padding constants if not used elsewhere
    // public static readonly _PADDING_LEFT = 10;
    // public static readonly _PADDING_TOP = 10;
    // public static readonly _PADDING_BOTTOM = 10;

    constructor(private _containerNodeId: string) {}

    apply(layoutTree: LayoutTree) {
        const net = layoutTree.net;
        const containerLayout = layoutTree.getNodeLayout(this._containerNodeId);

        if (!containerLayout) {
            console.warn(`ContainerSizeConstraint: Layout not found for ${this._containerNodeId}`);
            return;
        }

        const containerBox = containerLayout.intrinsicBox;

        // 1. Get ALL nested children
        const allChildLayouts: NodeLayout[] = [];
        for (const layout of layoutTree.nodeLayouts.values()) {
            if (layout.nestingParentId === this._containerNodeId) {
                allChildLayouts.push(layout);
            }
        }

        if (allChildLayouts.length === 0) {
            console.log(`ContainerSizeConstraint: No children for ${this._containerNodeId}`);
             // Optional: Apply minimum size constraints if desired
            // writeAtLeastPropagator(net, containerBox.width, 30);
            // writeAtLeastPropagator(net, containerBox.height, 30);
            return;
        }

        // 2. Get relevant edges for ALL children
        const allChildLefts = allChildLayouts.map(cl => cl.intrinsicBox.left);
        const allChildRights = allChildLayouts.map(cl => cl.intrinsicBox.right);
        const allChildTops = allChildLayouts.map(cl => cl.intrinsicBox.top);
        const allChildBottoms = allChildLayouts.map(cl => cl.intrinsicBox.bottom);

        // 3. Calculate overall min/max from ALL children
        const minOverallChildLeft = net.newCell(`minOverallChildLeft_${this._containerNodeId}`, unknown());
        const maxOverallChildRight = net.newCell(`maxOverallChildRight_${this._containerNodeId}`, unknown());
        const minOverallChildTop = net.newCell(`minOverallChildTop_${this._containerNodeId}`, unknown());
        const maxOverallChildBottom = net.newCell(`maxOverallChildBottom_${this._containerNodeId}`, unknown());

        minRangeListPropagator(`minOverallChildLeft_${this._containerNodeId}`, net, allChildLefts, minOverallChildLeft);
        maxRangeListPropagator(`maxOverallChildRight_${this._containerNodeId}`, net, allChildRights, maxOverallChildRight);
        minRangeListPropagator(`minOverallChildTop_${this._containerNodeId}`, net, allChildTops, minOverallChildTop);
        maxRangeListPropagator(`maxOverallChildBottom_${this._containerNodeId}`, net, allChildBottoms, maxOverallChildBottom);


        // 4. --- Simplified Width Constraint (Container width >= children width + padding) ---
        const childSpanX = net.newCell(`childSpanX_${this._containerNodeId}`, unknown());
        subtractRangePropagator( // childSpanX = maxOverallChildRight - minOverallChildLeft
            `calc_childSpanX_${this._containerNodeId}`, net, maxOverallChildRight, minOverallChildLeft, childSpanX
        );
        const childSpanXPlusPadding = net.newCell(`childSpanXPlusPadding_${this._containerNodeId}`, unknown());
        const paddingX = net.newCell(`paddingX_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_X))); // Use total X padding
        addRangePropagator( // childSpanXPlusPadding = childSpanX + paddingX
            `calc_childSpanXPlusPadding_${this._containerNodeId}`, net, childSpanX, paddingX, childSpanXPlusPadding
        );
        lessThanEqualPropagator( // childSpanXPlusPadding <= containerBox.width
            `childSpanXPlusPadding <= containerBox.width_${this._containerNodeId}`, net, childSpanXPlusPadding, containerBox.width
        );

        // 5. --- Simplified Height Constraint (Container height >= children height + padding) ---
        const childSpanY = net.newCell(`childSpanY_${this._containerNodeId}`, unknown());
        subtractRangePropagator( // childSpanY = maxOverallChildBottom - minOverallChildTop
             `calc_childSpanY_${this._containerNodeId}`, net, maxOverallChildBottom, minOverallChildTop, childSpanY
        );
        const childSpanYPlusPadding = net.newCell(`childSpanYPlusPadding_${this._containerNodeId}`, unknown());
        const paddingY = net.newCell(`paddingY_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_Y))); // Use total Y padding
         addRangePropagator( // childSpanYPlusPadding = childSpanY + paddingY
             `calc_childSpanYPlusPadding_${this._containerNodeId}`, net, childSpanY, paddingY, childSpanYPlusPadding
         );
         lessThanEqualPropagator( // childSpanYPlusPadding <= containerBox.height
             `childSpanYPlusPadding <= containerBox.height_${this._containerNodeId}`, net, childSpanYPlusPadding, containerBox.height
         );

        // *** REMOVED specific top/bottom padding logic ***
    }
}
// // src/ui/render/layout/recursiveBox/constraints/ContainerSizeConstraint.ts
// import { layout } from "dagre";
// import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator, writeAtLeastPropagator } from "../../../../../constraint/propagator/NumericRange";
// import { known, unknown } from "../../../../../constraint/propagator/Propagator";
// import { Constraint } from "../Constraint";
// import { LayoutTree } from "../LayoutTree";
// import { NodeLayout } from "../NodeLayout";

// export class ContainerSizeConstraint implements Constraint {
//     // Keep padding constants
//     public static readonly _PADDING_X = 20;
//     public static readonly _PADDING_Y = 20;
//     public static readonly _PADDING_LEFT = 10;
//     public static readonly _PADDING_TOP = 10; // Used for top padding calc
//     public static readonly _PADDING_BOTTOM = 10; // Used for bottom padding calc

//     constructor(private _containerNodeId: string) {}

//     apply(layoutTree: LayoutTree) {
//         const net = layoutTree.net;
//         const containerLayout = layoutTree.getNodeLayout(this._containerNodeId);

//         if (!containerLayout) {
//             console.warn(`ContainerSizeConstraint: Layout not found for ${this._containerNodeId}`);
//             return;
//         }

//         const containerBox = containerLayout.intrinsicBox;

//         // 1. Get ALL nested children first
//         const allChildLayouts: NodeLayout[] = [];
//         for (const layout of layoutTree.nodeLayouts.values()) {
//             if (layout.nestingParentId === this._containerNodeId) {
//                 allChildLayouts.push(layout);
//             }
//         }

//         if (allChildLayouts.length === 0) {
//             console.log(`ContainerSizeConstraint: No children for ${this._containerNodeId}`);
//             // Optional: Apply minimum size constraints to the container itself?
//             // writeAtLeastPropagator(net, containerBox.width, 30); // Example min width
//             // writeAtLeastPropagator(net, containerBox.height, 30); // Example min height
//             return;
//         }

//         // 2. Get relevant edges for ALL children (potentially needed for overall width/height)
//         const allChildLefts = allChildLayouts.map(cl => cl.intrinsicBox.left);
//         const allChildRights = allChildLayouts.map(cl => cl.intrinsicBox.right);
//         const allChildTops = allChildLayouts.map(cl => cl.intrinsicBox.top);
//         const allChildBottoms = allChildLayouts.map(cl => cl.intrinsicBox.bottom);

//         // 3. Calculate overall min/max from ALL children (useful for width/height constraints)
//         const minOverallChildLeft = net.newCell(`minOverallChildLeft_${this._containerNodeId}`, unknown());
//         const maxOverallChildRight = net.newCell(`maxOverallChildRight_${this._containerNodeId}`, unknown());
//         const minOverallChildTop = net.newCell(`minOverallChildTop_${this._containerNodeId}`, unknown());
//         const maxOverallChildBottom = net.newCell(`maxOverallChildBottom_${this._containerNodeId}`, unknown());

//         minRangeListPropagator(`minOverallChildLeft_${this._containerNodeId}`, net, allChildLefts, minOverallChildLeft);
//         maxRangeListPropagator(`maxOverallChildRight_${this._containerNodeId}`, net, allChildRights, maxOverallChildRight);
//         minRangeListPropagator(`minOverallChildTop_${this._containerNodeId}`, net, allChildTops, minOverallChildTop); // Use this if general top alignment needed
//         maxRangeListPropagator(`maxOverallChildBottom_${this._containerNodeId}`, net, allChildBottoms, maxOverallChildBottom); // Use this if general bottom alignment needed

//         // 4. *** Filter SPECIFICALLY for Top Padding Constraint ***
//         // We only want to ensure the container's top is above the topmost NON-PARAMETER-BAR child.
//         const childrenForTopPadding = allChildLayouts.filter(cl =>
//             !(cl.kind === 'PortBarNode' && cl.portBarType === 'parameter-bar') // Filter out parameter bar
//         );
//         const topsForTopPadding = childrenForTopPadding.map(cl => cl.intrinsicBox.top);
//         const minChildTopForPadding = net.newCell(`minChildTopForPadding_${this._containerNodeId}`, unknown()); // Cell specific to this calculation

//         if (topsForTopPadding.length > 0) {
//             minRangeListPropagator(`minChildTopForPadding_${this._containerNodeId}`, net, topsForTopPadding, minChildTopForPadding);
//         } else {
//             // If only a parameter bar exists, this constraint might not be needed or could use a default.
//             // For now, if no relevant children, minChildTopForPadding remains unknown,
//             // effectively making the top padding constraint non-binding in that dimension.
//              console.log(`ContainerSizeConstraint: No children found for top padding calculation for ${this._containerNodeId}`);
//         }

//         // --- Top Padding Constraint Logic (using specifically filtered minChildTop) ---
//         const paddingTop = net.newCell(`paddingTop_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_TOP)));
//         const containerTopPlusPadding = net.newCell(`containerTopPlusPadding_${this._containerNodeId}`, unknown());

//         addRangePropagator( // containerTopPlusPadding = containerBox.top + paddingTop
//             `calc_containerTopPlusPadding_${this._containerNodeId}`,
//             net,
//             containerBox.top,
//             paddingTop,
//             containerTopPlusPadding
//         );

//         // Apply constraint only if minChildTopForPadding could be determined
//         if (topsForTopPadding.length > 0) {
//              lessThanEqualPropagator( // containerTopPlusPadding <= minChildTopForPadding
//                  `containerTopPlusPadding <= minChildTopForPadding_${this._containerNodeId}`,
//                  net,
//                  containerTopPlusPadding,
//                  minChildTopForPadding // Use the specifically calculated min top
//              );
//         }
//         // --- End Top Padding ---


//         // 5. *** Filter SPECIFICALLY for Bottom Padding Constraint ***
//         // Ensure container bottom is below the bottommost NON-RESULT-BAR child.
//         const childrenForBottomPadding = allChildLayouts.filter(cl =>
//              !(cl.kind === 'PortBarNode' && cl.portBarType === 'result-bar') // Filter out result bar
//         );
//         const bottomsForBottomPadding = childrenForBottomPadding.map(cl => cl.intrinsicBox.bottom);
//         const maxChildBottomForPadding = net.newCell(`maxChildBottomForPadding_${this._containerNodeId}`, unknown()); // Cell specific to this calculation

//         if (bottomsForBottomPadding.length > 0) {
//             maxRangeListPropagator(`maxChildBottomForPadding_${this._containerNodeId}`, net, bottomsForBottomPadding, maxChildBottomForPadding);
//         } else {
//              console.log(`ContainerSizeConstraint: No children found for bottom padding calculation for ${this._containerNodeId}`);
//         }

//         // --- Bottom Padding Constraint Logic (using specifically filtered maxChildBottom) ---
//         const paddingBottom = net.newCell(`paddingBottom_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_BOTTOM)));
//         const maxChildBottomPlusPadding = net.newCell(`maxChildBottomPlusPadding_${this._containerNodeId}`, unknown());

//         // Apply constraint only if maxChildBottomForPadding could be determined
//         if (bottomsForBottomPadding.length > 0) {
//              addRangePropagator( // maxChildBottomPlusPadding = maxChildBottomForPadding + paddingBottom
//                `calc_maxChildBottomPlusPadding_${this._containerNodeId}`, net, maxChildBottomForPadding, paddingBottom, maxChildBottomPlusPadding
//              );

//              lessThanEqualPropagator( // maxChildBottomPlusPadding <= containerBox.bottom (Ensure bottom expands)
//                  `maxChildBottomPlusPadding <= containerBox.bottom_${this._containerNodeId}`,
//                  net,
//                  maxChildBottomPlusPadding, // Use the value calculated from filtered children
//                  containerBox.bottom
//              );
//         }
//         // --- End Bottom Padding ---


//         // 6. Width Constraint (using overall min/max includes port bars if desired for width)
//         const childSpanX = net.newCell(`childSpanX_${this._containerNodeId}`, unknown());
//         subtractRangePropagator( // childSpanX = maxOverallChildRight - minOverallChildLeft
//             `calc_childSpanX_${this._containerNodeId}`, net, maxOverallChildRight, minOverallChildLeft, childSpanX
//         );
//         const childSpanXPlusPadding = net.newCell(`childSpanXPlusPadding_${this._containerNodeId}`, unknown());
//         const paddingX = net.newCell(`paddingX_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_X)));
//         addRangePropagator( // childSpanXPlusPadding = childSpanX + paddingX
//             `calc_childSpanXPlusPadding_${this._containerNodeId}`, net, childSpanX, paddingX, childSpanXPlusPadding
//         );
//         lessThanEqualPropagator( // childSpanXPlusPadding <= containerBox.width
//             `childSpanXPlusPadding <= containerBox.width_${this._containerNodeId}`, net, childSpanXPlusPadding, containerBox.width
//         );

//         // 7. Height Constraint (Optional: Could use overall min/max or padding-specific min/max)
//         // Example using overall: container.height >= maxOverallChildBottom - minOverallChildTop + PADDING_Y
//         const childSpanY = net.newCell(`childSpanY_${this._containerNodeId}`, unknown());
//         subtractRangePropagator( // childSpanY = maxOverallChildBottom - minOverallChildTop
//              `calc_childSpanY_${this._containerNodeId}`, net, maxOverallChildBottom, minOverallChildTop, childSpanY
//         );
//         const childSpanYPlusPadding = net.newCell(`childSpanYPlusPadding_${this._containerNodeId}`, unknown());
//         const paddingY = net.newCell(`paddingY_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_Y)));
//          addRangePropagator( // childSpanYPlusPadding = childSpanY + paddingY
//              `calc_childSpanYPlusPadding_${this._containerNodeId}`, net, childSpanY, paddingY, childSpanYPlusPadding
//          );
//          lessThanEqualPropagator( // childSpanYPlusPadding <= containerBox.height
//              `childSpanYPlusPadding <= containerBox.height_${this._containerNodeId}`, net, childSpanYPlusPadding, containerBox.height
//          );

//         // Add debug cells if helpful
//         layoutTree.net.addDebugCell(`** Filtered minChildTopForPadding_${this._containerNodeId}`, minChildTopForPadding);
//         layoutTree.net.addDebugCell(`** Filtered maxChildBottomForPadding_${this._containerNodeId}`, maxChildBottomForPadding);
//         layoutTree.net.addDebugCell(`** containerBox.top_${this._containerNodeId}`, containerBox.top);
//         layoutTree.net.addDebugCell(`** containerBox.bottom_${this._containerNodeId}`, containerBox.bottom);
//     }
// }
// // import { layout } from "dagre";
// // import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator, writeAtLeastPropagator } from "../../../../../constraint/propagator/NumericRange";
// // import { known, unknown } from "../../../../../constraint/propagator/Propagator";
// // import { Constraint } from "../Constraint";
// // import { LayoutTree } from "../LayoutTree";
// // import { NodeLayout } from "../NodeLayout";

// // export class ContainerSizeConstraint implements Constraint {
// //   // Keep padding constants
// //   public static readonly _PADDING_X = 20
// //   public static readonly _PADDING_Y = 20
// //   public static readonly _PADDING_LEFT = 10 // For horizontal alignment (used by CenteringConstraint)
// //   public static readonly _PADDING_TOP = 10 // Now used here
// //   public static readonly _PADDING_BOTTOM = 10 // Used here

// //   constructor(private _containerNodeId: string) {
// //   }

// //   apply(layoutTree: LayoutTree) {
// //     const net = layoutTree.net
// //     const containerLayout = layoutTree.getNodeLayout(this._containerNodeId)

// //     if (!containerLayout) {
// //       console.warn(`ContainerSizeConstraint: Layout not found for ${this._containerNodeId}`)
// //       return
// //     }

// //     const containerBox = containerLayout.intrinsicBox

// //     // Find nested children (same logic as before)
// //     const childLayouts: NodeLayout[] = [];
// //     for (const layout of layoutTree.nodeLayouts.values()) {
// //       if (layout.nestingParentId === this._containerNodeId) {
// //         childLayouts.push(layout);
// //       }
// //     }

// //     if (childLayouts.length === 0) {
// //       // If no children, maybe constrain container size to a minimum? Optional.
// //       // console.log(`ContainerSizeConstraint: No children for ${this._containerNodeId}`)
// //       return
// //     }

// //     // Get relevant child bounding box edges
// //     const childLefts = childLayouts.map(childLayout => childLayout.intrinsicBox.left)
// //     const childRights = childLayouts.map(childLayout => childLayout.intrinsicBox.right)
// //     const childTops = childLayouts.map(childLayout => childLayout.intrinsicBox.top)
// //     const childBottoms = childLayouts.map(childLayout => childLayout.intrinsicBox.bottom)

// //     // --- Min/Max Calculations (Existing and New) ---
// //     const minChildLeft = net.newCell(`minChildLeft_${this._containerNodeId}`, unknown())
// //     const maxChildRight = net.newCell(`maxChildRight_${this._containerNodeId}`, unknown())
// //     const minChildTop = net.newCell(`minChildTop_${this._containerNodeId}`, unknown()) // Used for Top Padding
// //     const maxChildBottom = net.newCell(`maxChildBottom_${this._containerNodeId}`, unknown()) // Used for Bottom Padding

// //     minRangeListPropagator(`minChildLeft_${this._containerNodeId}`, net, childLefts, minChildLeft)
// //     maxRangeListPropagator(`maxChildRight_${this._containerNodeId}`, net, childRights, maxChildRight)
// //     minRangeListPropagator(`minChildTop_${this._containerNodeId}`, net, childTops, minChildTop) // Already calculated
// //     maxRangeListPropagator(`maxChildBottom_${this._containerNodeId}`, net, childBottoms, maxChildBottom) // Already calculated

// //     // --- Bottom Padding Constraint (Existing Logic) ---
// //     const paddingBottom = net.newCell(`paddingBottom_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_BOTTOM)))
// //     const maxChildBottomPlusPadding = net.newCell(`maxChildBottomPlusPadding_${this._containerNodeId}`, unknown())

// //     addRangePropagator( // maxChildBottomPlusPadding = maxChildBottom + paddingBottom
// //       `calc_maxChildBottomPlusPadding_${this._containerNodeId}`, net, maxChildBottom, paddingBottom, maxChildBottomPlusPadding
// //     )
// //     lessThanEqualPropagator( // maxChildBottomPlusPadding <= containerBox.bottom (Corrected direction)
// //       `maxChildBottomPlusPadding <= containerBox.bottom_${this._containerNodeId}`, net, maxChildBottomPlusPadding, containerBox.bottom
// //     )

// //     // --- *** NEW: Top Padding Constraint Logic *** ---
// //     const paddingTop = net.newCell(`paddingTop_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_TOP)))
// //     const containerTopPlusPadding = net.newCell(`containerTopPlusPadding_${this._containerNodeId}`, unknown())

// //     addRangePropagator( // containerTopPlusPadding = containerBox.top + paddingTop
// //         `calc_containerTopPlusPadding_${this._containerNodeId}`,
// //         net,
// //         containerBox.top,
// //         paddingTop,
// //         containerTopPlusPadding
// //     );

// //     lessThanEqualPropagator( // containerTopPlusPadding <= minChildTop
// //         `containerTopPlusPadding <= minChildTop_${this._containerNodeId}`,
// //         net,
// //         containerTopPlusPadding,
// //         minChildTop
// //     );
// //     // --- End of New Top Padding Logic ---

// //     // --- Width Constraint (Example - adapt if needed) ---
// //     // This might also belong here or in a separate constraint.
// //     // Enforces: container.width >= maxChildRight - minChildLeft + PADDING_X
// //     const childSpanX = net.newCell(`childSpanX_${this._containerNodeId}`, unknown());
// //     subtractRangePropagator( // childSpanX = maxChildRight - minChildLeft
// //         `calc_childSpanX_${this._containerNodeId}`, net, maxChildRight, minChildLeft, childSpanX
// //     );
// //     const childSpanXPlusPadding = net.newCell(`childSpanXPlusPadding_${this._containerNodeId}`, unknown());
// //     const paddingX = net.newCell(`paddingX_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_X)));
// //     addRangePropagator( // childSpanXPlusPadding = childSpanX + paddingX
// //         `calc_childSpanXPlusPadding_${this._containerNodeId}`, net, childSpanX, paddingX, childSpanXPlusPadding
// //     );
// //     lessThanEqualPropagator( // childSpanXPlusPadding <= containerBox.width
// //         `childSpanXPlusPadding <= containerBox.width_${this._containerNodeId}`, net, childSpanXPlusPadding, containerBox.width
// //     );

// //     // Add debug cells if helpful
// //     layoutTree.net.addDebugCell(`*** minChildTop_${this._containerNodeId}`, minChildTop)
// //     layoutTree.net.addDebugCell(`*** containerBox.top_${this._containerNodeId}`, containerBox.top)
// //     layoutTree.net.addDebugCell(`*** maxChildBottom_${this._containerNodeId}`, maxChildBottom)
// //     layoutTree.net.addDebugCell(`*** containerBox.bottom_${this._containerNodeId}`, containerBox.bottom)
// //   }
// // }

// // // export class ContainerSizeConstraint implements Constraint {
// // //   // Total padding
// // //   public static readonly _PADDING_X = 20
// // //   public static readonly _PADDING_Y = 20

// // //   public static readonly _PADDING_LEFT = 10
// // //   public static readonly _PADDING_TOP = 10
// // //   public static readonly _PADDING_BOTTOM = 10

// // //   constructor(private _containerNodeId: string) {
// // //   }

// // //   apply(layoutTree: LayoutTree) {
// // //     const net = layoutTree.net
// // //     const containerLayout = layoutTree.getNodeLayout(this._containerNodeId)

// // //     if (!containerLayout) {
// // //       console.warn(`Container layout not found for node ID: ${this._containerNodeId}`)
// // //       return
// // //     }

// // //     const containerBox = containerLayout.intrinsicBox

// // //     const childLayouts: NodeLayout[] = [];
// // //     for (const layout of layoutTree.nodeLayouts.values()) {
// // //       if (layout.nestingParentId === this._containerNodeId) {
// // //         childLayouts.push(layout);
// // //       }
// // //     }

// // //     if (childLayouts.length === 0) {
// // //       console.log(`No child layouts found for container node ID: ${this._containerNodeId}`)
// // //       return
// // //     }

// // //     const childLefts = childLayouts.map(childLayout => childLayout.intrinsicBox.left)
// // //     const childRights = childLayouts.map(childLayout => childLayout.intrinsicBox.right)
// // //     const childTops = childLayouts.map(childLayout => childLayout.intrinsicBox.top)
// // //     const childBottoms = childLayouts.map(childLayout => childLayout.intrinsicBox.bottom)

// // //     const minChildLeft = net.newCell(`minChildLeft_${this._containerNodeId}`, unknown())
// // //     const maxChildRight = net.newCell(`maxChildRight_${this._containerNodeId}`, unknown())
// // //     const minChildTop = net.newCell(`minChildTop_${this._containerNodeId}`, unknown())
// // //     const maxChildBottom = net.newCell(`maxChildBottom_${this._containerNodeId}`, unknown())

// // //     minRangeListPropagator(
// // //       `minChildLeft_${this._containerNodeId}`,
// // //       net,
// // //       childLefts,
// // //       minChildLeft
// // //     )

// // //     maxRangeListPropagator(
// // //       `maxChildRight_${this._containerNodeId}`,
// // //       net,
// // //       childRights,
// // //       maxChildRight
// // //     )

// // //     minRangeListPropagator(
// // //       `minChildTop_${this._containerNodeId}`,
// // //       net,
// // //       childTops,
// // //       minChildTop
// // //     )

// // //     maxRangeListPropagator(
// // //       `maxChildBottom_${this._containerNodeId}`,
// // //       net,
// // //       childBottoms,
// // //       maxChildBottom
// // //     )

// // //     const maxChildBottomPlusPadding = net.newCell(
// // //       `maxChildBottomPlusPadding_${this._containerNodeId}`,
// // //       unknown()
// // //     )

// // //     const paddingBottom = net.newCell(
// // //       `paddingBottom_${this._containerNodeId}`,
// // //       known(exactly(ContainerSizeConstraint._PADDING_BOTTOM))
// // //     )

// // //     // maxChildBottomPlusPadding = maxChildBottom + _PADDING_BOTTOM
// // //     addRangePropagator(
// // //       `calc_maxChildBottomPlusPadding_${this._containerNodeId}`,
// // //       net,
// // //       maxChildBottom,
// // //       paddingBottom,
// // //       maxChildBottomPlusPadding
// // //     )

// // //     lessThanEqualPropagator(
// // //       `maxChildBottomPlusPadding <= containerBox.bottom`,
// // //       net,
// // //       maxChildBottomPlusPadding,
// // //       containerBox.bottom,
// // //     )

// // //     const paddingTop = net.newCell(
// // //       `paddingTop_${this._containerNodeId}`,
// // //       known(exactly(ContainerSizeConstraint._PADDING_TOP)) // Use your padding constant
// // //     );

// // //     const containerTopPlusPadding = net.newCell(
// // //       `containerTopPlusPadding_${this._containerNodeId}`,
// // //       unknown()
// // //     );

// // //     // containerTopPlusPadding = containerBox.top + paddingTop
// // //     addRangePropagator(
// // //       `calc_containerTopPlusPadding_${this._containerNodeId}`,
// // //       net,
// // //       containerBox.top, // containerLayout.intrinsicBox.top
// // //       paddingTop,
// // //       containerTopPlusPadding
// // //     )

// // //     lessThanEqualPropagator(
// // //       `containerTopPlusPadding <= minChildTop_${this._containerNodeId}`,
// // //       net,
// // //       containerTopPlusPadding, // a
// // //       minChildTop            // b
// // //     );
// // //   }
// // // }
