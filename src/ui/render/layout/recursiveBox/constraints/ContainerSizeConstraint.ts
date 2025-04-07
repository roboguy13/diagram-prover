import { layout } from "dagre";
import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator, writeAtLeastPropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeLayout } from "../NodeLayout";

export class ContainerSizeConstraint implements Constraint {
  // Keep padding constants
  public static readonly _PADDING_X = 20
  public static readonly _PADDING_Y = 20
  public static readonly _PADDING_LEFT = 10 // For horizontal alignment (used by CenteringConstraint)
  public static readonly _PADDING_TOP = 10 // Now used here
  public static readonly _PADDING_BOTTOM = 10 // Used here

  constructor(private _containerNodeId: string) {
  }

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net
    const containerLayout = layoutTree.getNodeLayout(this._containerNodeId)

    if (!containerLayout) {
      console.warn(`ContainerSizeConstraint: Layout not found for ${this._containerNodeId}`)
      return
    }

    const containerBox = containerLayout.intrinsicBox

    // Find nested children (same logic as before)
    const childLayouts: NodeLayout[] = [];
    for (const layout of layoutTree.nodeLayouts.values()) {
      if (layout.nestingParentId === this._containerNodeId) {
        childLayouts.push(layout);
      }
    }

    if (childLayouts.length === 0) {
      // If no children, maybe constrain container size to a minimum? Optional.
      // console.log(`ContainerSizeConstraint: No children for ${this._containerNodeId}`)
      return
    }

    // Get relevant child bounding box edges
    const childLefts = childLayouts.map(childLayout => childLayout.intrinsicBox.left)
    const childRights = childLayouts.map(childLayout => childLayout.intrinsicBox.right)
    const childTops = childLayouts.map(childLayout => childLayout.intrinsicBox.top)
    const childBottoms = childLayouts.map(childLayout => childLayout.intrinsicBox.bottom)

    // --- Min/Max Calculations (Existing and New) ---
    const minChildLeft = net.newCell(`minChildLeft_${this._containerNodeId}`, unknown())
    const maxChildRight = net.newCell(`maxChildRight_${this._containerNodeId}`, unknown())
    const minChildTop = net.newCell(`minChildTop_${this._containerNodeId}`, unknown()) // Used for Top Padding
    const maxChildBottom = net.newCell(`maxChildBottom_${this._containerNodeId}`, unknown()) // Used for Bottom Padding

    minRangeListPropagator(`minChildLeft_${this._containerNodeId}`, net, childLefts, minChildLeft)
    maxRangeListPropagator(`maxChildRight_${this._containerNodeId}`, net, childRights, maxChildRight)
    minRangeListPropagator(`minChildTop_${this._containerNodeId}`, net, childTops, minChildTop) // Already calculated
    maxRangeListPropagator(`maxChildBottom_${this._containerNodeId}`, net, childBottoms, maxChildBottom) // Already calculated

    // --- Bottom Padding Constraint (Existing Logic) ---
    const paddingBottom = net.newCell(`paddingBottom_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_BOTTOM)))
    const maxChildBottomPlusPadding = net.newCell(`maxChildBottomPlusPadding_${this._containerNodeId}`, unknown())

    addRangePropagator( // maxChildBottomPlusPadding = maxChildBottom + paddingBottom
      `calc_maxChildBottomPlusPadding_${this._containerNodeId}`, net, maxChildBottom, paddingBottom, maxChildBottomPlusPadding
    )
    lessThanEqualPropagator( // maxChildBottomPlusPadding <= containerBox.bottom (Corrected direction)
      `maxChildBottomPlusPadding <= containerBox.bottom_${this._containerNodeId}`, net, maxChildBottomPlusPadding, containerBox.bottom
    )

    // --- *** NEW: Top Padding Constraint Logic *** ---
    const paddingTop = net.newCell(`paddingTop_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_TOP)))
    const containerTopPlusPadding = net.newCell(`containerTopPlusPadding_${this._containerNodeId}`, unknown())

    addRangePropagator( // containerTopPlusPadding = containerBox.top + paddingTop
        `calc_containerTopPlusPadding_${this._containerNodeId}`,
        net,
        containerBox.top,
        paddingTop,
        containerTopPlusPadding
    );

    lessThanEqualPropagator( // containerTopPlusPadding <= minChildTop
        `containerTopPlusPadding <= minChildTop_${this._containerNodeId}`,
        net,
        containerTopPlusPadding,
        minChildTop
    );
    // --- End of New Top Padding Logic ---

    // --- Width Constraint (Example - adapt if needed) ---
    // This might also belong here or in a separate constraint.
    // Enforces: container.width >= maxChildRight - minChildLeft + PADDING_X
    const childSpanX = net.newCell(`childSpanX_${this._containerNodeId}`, unknown());
    subtractRangePropagator( // childSpanX = maxChildRight - minChildLeft
        `calc_childSpanX_${this._containerNodeId}`, net, maxChildRight, minChildLeft, childSpanX
    );
    const childSpanXPlusPadding = net.newCell(`childSpanXPlusPadding_${this._containerNodeId}`, unknown());
    const paddingX = net.newCell(`paddingX_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_X)));
    addRangePropagator( // childSpanXPlusPadding = childSpanX + paddingX
        `calc_childSpanXPlusPadding_${this._containerNodeId}`, net, childSpanX, paddingX, childSpanXPlusPadding
    );
    lessThanEqualPropagator( // childSpanXPlusPadding <= containerBox.width
        `childSpanXPlusPadding <= containerBox.width_${this._containerNodeId}`, net, childSpanXPlusPadding, containerBox.width
    );

    // Add debug cells if helpful
    layoutTree.net.addDebugCell(`*** minChildTop_${this._containerNodeId}`, minChildTop)
    layoutTree.net.addDebugCell(`*** containerBox.top_${this._containerNodeId}`, containerBox.top)
    layoutTree.net.addDebugCell(`*** maxChildBottom_${this._containerNodeId}`, maxChildBottom)
    layoutTree.net.addDebugCell(`*** containerBox.bottom_${this._containerNodeId}`, containerBox.bottom)
  }
}

// export class ContainerSizeConstraint implements Constraint {
//   // Total padding
//   public static readonly _PADDING_X = 20
//   public static readonly _PADDING_Y = 20

//   public static readonly _PADDING_LEFT = 10
//   public static readonly _PADDING_TOP = 10
//   public static readonly _PADDING_BOTTOM = 10

//   constructor(private _containerNodeId: string) {
//   }

//   apply(layoutTree: LayoutTree) {
//     const net = layoutTree.net
//     const containerLayout = layoutTree.getNodeLayout(this._containerNodeId)

//     if (!containerLayout) {
//       console.warn(`Container layout not found for node ID: ${this._containerNodeId}`)
//       return
//     }

//     const containerBox = containerLayout.intrinsicBox

//     const childLayouts: NodeLayout[] = [];
//     for (const layout of layoutTree.nodeLayouts.values()) {
//       if (layout.nestingParentId === this._containerNodeId) {
//         childLayouts.push(layout);
//       }
//     }

//     if (childLayouts.length === 0) {
//       console.log(`No child layouts found for container node ID: ${this._containerNodeId}`)
//       return
//     }

//     const childLefts = childLayouts.map(childLayout => childLayout.intrinsicBox.left)
//     const childRights = childLayouts.map(childLayout => childLayout.intrinsicBox.right)
//     const childTops = childLayouts.map(childLayout => childLayout.intrinsicBox.top)
//     const childBottoms = childLayouts.map(childLayout => childLayout.intrinsicBox.bottom)

//     const minChildLeft = net.newCell(`minChildLeft_${this._containerNodeId}`, unknown())
//     const maxChildRight = net.newCell(`maxChildRight_${this._containerNodeId}`, unknown())
//     const minChildTop = net.newCell(`minChildTop_${this._containerNodeId}`, unknown())
//     const maxChildBottom = net.newCell(`maxChildBottom_${this._containerNodeId}`, unknown())

//     minRangeListPropagator(
//       `minChildLeft_${this._containerNodeId}`,
//       net,
//       childLefts,
//       minChildLeft
//     )

//     maxRangeListPropagator(
//       `maxChildRight_${this._containerNodeId}`,
//       net,
//       childRights,
//       maxChildRight
//     )

//     minRangeListPropagator(
//       `minChildTop_${this._containerNodeId}`,
//       net,
//       childTops,
//       minChildTop
//     )

//     maxRangeListPropagator(
//       `maxChildBottom_${this._containerNodeId}`,
//       net,
//       childBottoms,
//       maxChildBottom
//     )

//     const maxChildBottomPlusPadding = net.newCell(
//       `maxChildBottomPlusPadding_${this._containerNodeId}`,
//       unknown()
//     )

//     const paddingBottom = net.newCell(
//       `paddingBottom_${this._containerNodeId}`,
//       known(exactly(ContainerSizeConstraint._PADDING_BOTTOM))
//     )

//     // maxChildBottomPlusPadding = maxChildBottom + _PADDING_BOTTOM
//     addRangePropagator(
//       `calc_maxChildBottomPlusPadding_${this._containerNodeId}`,
//       net,
//       maxChildBottom,
//       paddingBottom,
//       maxChildBottomPlusPadding
//     )

//     lessThanEqualPropagator(
//       `maxChildBottomPlusPadding <= containerBox.bottom`,
//       net,
//       maxChildBottomPlusPadding,
//       containerBox.bottom,
//     )

//     const paddingTop = net.newCell(
//       `paddingTop_${this._containerNodeId}`,
//       known(exactly(ContainerSizeConstraint._PADDING_TOP)) // Use your padding constant
//     );

//     const containerTopPlusPadding = net.newCell(
//       `containerTopPlusPadding_${this._containerNodeId}`,
//       unknown()
//     );

//     // containerTopPlusPadding = containerBox.top + paddingTop
//     addRangePropagator(
//       `calc_containerTopPlusPadding_${this._containerNodeId}`,
//       net,
//       containerBox.top, // containerLayout.intrinsicBox.top
//       paddingTop,
//       containerTopPlusPadding
//     )

//     lessThanEqualPropagator(
//       `containerTopPlusPadding <= minChildTop_${this._containerNodeId}`,
//       net,
//       containerTopPlusPadding, // a
//       minChildTop            // b
//     );
//   }
// }
