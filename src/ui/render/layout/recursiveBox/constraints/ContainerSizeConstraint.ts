import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { known, unknown } from "../../../../../constraint/propagator/Propagator";
import { Constraint } from "../Constraint";
import { LayoutTree } from "../LayoutTree";
import { NodeLayout } from "../NodeLayout";

export class ContainerSizeConstraint implements Constraint {
  // Total padding
  public static readonly _PADDING_X = 20
  public static readonly _PADDING_Y = 20

  public static readonly _PADDING_LEFT = 10
  public static readonly _PADDING_TOP = 10
  public static readonly _PADDING_BOTTOM = 10

  constructor(private _containerNodeId: string) {
  }

  apply(layoutTree: LayoutTree) {
    const net = layoutTree.net
    const containerLayout = layoutTree.getNodeLayout(this._containerNodeId)

    if (!containerLayout) {
      console.warn(`Container layout not found for node ID: ${this._containerNodeId}`)
      return
    }

    const containerBox = containerLayout.intrinsicBox

    const childLayouts: NodeLayout[] = [];
    for (const layout of layoutTree.nodeLayouts.values()) {
      if (layout.nestingParentId === this._containerNodeId) {
        childLayouts.push(layout);
      }
    }

    if (childLayouts.length === 0) {
      console.log(`No child layouts found for container node ID: ${this._containerNodeId}`)
      return
    }

    const childLefts = childLayouts.map(childLayout => childLayout.intrinsicBox.left)
    const childRights = childLayouts.map(childLayout => childLayout.intrinsicBox.right)
    const childTops = childLayouts.map(childLayout => childLayout.intrinsicBox.top)
    const childBottoms = childLayouts.map(childLayout => childLayout.intrinsicBox.bottom)

    const minChildLeft = net.newCell(`minChildLeft_${this._containerNodeId}`, unknown())
    const maxChildRight = net.newCell(`maxChildRight_${this._containerNodeId}`, unknown())
    const minChildTop = net.newCell(`minChildTop_${this._containerNodeId}`, unknown())
    const maxChildBottom = net.newCell(`maxChildBottom_${this._containerNodeId}`, unknown())

    console.log(`--- Debugging maxChildBottom for ${this._containerNodeId} ---`);
    const childBottomLayouts = childLayouts.map(l => ({ id: l.nodeId, cell: l.intrinsicBox.bottom }));
    childBottomLayouts.forEach(cb => {
      // Read cell content *carefully* - use readCell, not readKnownOrError yet
      const content = net.readCell(cb.cell);
      console.log(`Input Child Bottom (${cb.id}): Cell ${cb.cell}, Value Before Max: ${JSON.stringify(content)}`);
      // Also add debug watch for this specific cell
      net.addDebugCell(`Input ${cb.id}.bottom`, cb.cell);
    });
    console.log(`Calling maxRangeListPropagator for maxChildBottom (Cell ${maxChildBottom})...`);


    minRangeListPropagator(
      `minChildLeft_${this._containerNodeId}`,
      net,
      childLefts,
      minChildLeft
    )

    maxRangeListPropagator(
      `maxChildRight_${this._containerNodeId}`,
      net,
      childRights,
      maxChildRight
    )

    minRangeListPropagator(
      `minChildTop_${this._containerNodeId}`,
      net,
      childTops,
      minChildTop
    )

    maxRangeListPropagator(
      `maxChildBottom_${this._containerNodeId}`,
      net,
      childBottoms,
      maxChildBottom
    )

    const maxBottomContent = net.readCell(maxChildBottom);
    console.log(`Result maxChildBottom: Cell ${maxChildBottom}, Value After Max: ${JSON.stringify(maxBottomContent)}`);
    // Add debug watch for the result
    net.addDebugCell(`Result maxChildBottom_${this._containerNodeId}`, maxChildBottom);
    console.log(`-------------------------------------------------------`);

    const childrenWidth = net.newCell(`childrenWidth_${this._containerNodeId}`, unknown())
    const childrenHeight = net.newCell(`childrenHeight_${this._containerNodeId}`, unknown())
    const requiredWidth = net.newCell(`requiredWidth_${this._containerNodeId}`, unknown())
    const requiredHeight = net.newCell(`requiredHeight_${this._containerNodeId}`, unknown())
    const paddingXCell = net.newCell(`paddingX_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_X)))
    const paddingYCell = net.newCell(`paddingY_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_Y)))

    // childrenWidth = maxChildRight - minChildLeft
    subtractRangePropagator(
      `childrenWidth_${this._containerNodeId}`,
      net,
      maxChildRight,
      minChildLeft,
      childrenWidth
    )

    // childrenHeight = maxChildBottom - minChildTop
    subtractRangePropagator(
      `childrenHeight_${this._containerNodeId}`,
      net,
      maxChildBottom,
      minChildTop,
      childrenHeight
    )

    // requiredWidth = childrenWidth + paddingX
    addRangePropagator(
      `requiredWidth_${this._containerNodeId}`,
      net,
      childrenWidth,
      paddingXCell,
      requiredWidth
    )

    // requiredHeight = childrenHeight + paddingY
    addRangePropagator(
      `requiredHeight_${this._containerNodeId}`,
      net,
      childrenHeight,
      paddingYCell,
      requiredHeight
    )

    // requiredWidth <= containerBox.width
    lessThanEqualPropagator(
      `requiredWidth_${this._containerNodeId}`,
      net,
      requiredWidth,
      containerBox.width
    )

    // requiredHeight <= containerBox.height
    lessThanEqualPropagator(
      `requiredHeight_${this._containerNodeId}`,
      net,
      requiredHeight,
      containerBox.height
    )

    const containerInnerLeft = net.newCell(`containerInnerLeft_${this._containerNodeId}`, unknown())
    const containerInnerTop = net.newCell(`containerInnerTop_${this._containerNodeId}`, unknown())
    const paddingLeftCell = net.newCell(`paddingLeft_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_LEFT)))
    const paddingTopCell = net.newCell(`paddingTop_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_TOP)))

    // containerInnerLeft = containerBox.left + paddingLeft
    addRangePropagator(
      `calc_containerInnerLeft_${this._containerNodeId}`,
      net,
      containerLayout.intrinsicBox.left,
      paddingLeftCell,
      containerInnerLeft
    )

    // containerInnerTop = containerBox.top + paddingTop
    addRangePropagator(
      `calc_containerInnerTop_${this._containerNodeId}`,
      net,
      containerLayout.intrinsicBox.top,
      paddingTopCell,
      containerInnerTop
    )

    const paddingBottomCell = net.newCell(`paddingBottom_${this._containerNodeId}`, known(exactly(ContainerSizeConstraint._PADDING_BOTTOM)))
    const containerInnerBottom = net.newCell(`containerInnerBottom_${this._containerNodeId}`, unknown())

    // containerInnerBottom = containerBox.bottom - paddingBottom
    subtractRangePropagator(
      `calc_containerInnerBottom_${this._containerNodeId}`,
      net,
      containerLayout.intrinsicBox.bottom,
      paddingBottomCell,
      containerInnerBottom
    )

    const containerInnerHeight = net.newCell(`containerInnerHeight_${this._containerNodeId}`, unknown())

    // containerInnerHeight = containerBox.height - paddingY
    subtractRangePropagator(
      `calc_containerInnerHeight_${this._containerNodeId}`,
      net,
      containerLayout.intrinsicBox.height,
      paddingYCell,
      containerInnerHeight
    )

    // childrenHeight <= containerInnerHeight
    lessThanEqualPropagator(
      `childrenHeight_${this._containerNodeId}`,
      net,
      childrenHeight,
      containerInnerHeight
    )

    // // maxChildBottom <= containerInnerBottom
    // lessThanEqualPropagator(
    //   `maxChildBottom_${this._containerNodeId}`,
    //   net,
    //   maxChildBottom,
    //   containerInnerBottom
    // )

    // minChildLeft >= containerInnerLeft
    lessThanEqualPropagator(
      `minChildLeft_${this._containerNodeId}`,
      net,
      containerInnerLeft,
      minChildLeft,
    )

    // minChildTop >= containerInnerTop
    lessThanEqualPropagator(
      `minChildTop_${this._containerNodeId}`,
      net,
      containerInnerTop,
      minChildTop,
    )
  }
}
