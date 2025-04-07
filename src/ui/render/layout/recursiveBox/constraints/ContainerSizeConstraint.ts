import { layout } from "dagre";
import { addRangePropagator, atLeast, exactly, lessThan, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, subtractRangePropagator, writeAtLeastPropagator } from "../../../../../constraint/propagator/NumericRange";
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

    const maxChildBottomPlusPadding = net.newCell(
      `maxChildBottomPlusPadding_${this._containerNodeId}`,
      unknown()
    )

    const paddingBottom = net.newCell(
      `paddingBottom_${this._containerNodeId}`,
      known(exactly(ContainerSizeConstraint._PADDING_BOTTOM))
    )

    // maxChildBottomPlusPadding = maxChildBottom + _PADDING_BOTTOM
    addRangePropagator(
      `calc_maxChildBottomPlusPadding_${this._containerNodeId}`,
      net,
      maxChildBottom,
      paddingBottom,
      maxChildBottomPlusPadding
    )

    lessThanEqualPropagator(
      `maxChildBottomPlusPadding <= containerBox.bottom`,
      net,
      maxChildBottomPlusPadding,
      containerBox.bottom,
    )

    const paddingTop = net.newCell(
      `paddingTop_${this._containerNodeId}`,
      known(exactly(ContainerSizeConstraint._PADDING_TOP)) // Use your padding constant
    );

    const containerTopPlusPadding = net.newCell(
      `containerTopPlusPadding_${this._containerNodeId}`,
      unknown()
    );

    // containerTopPlusPadding = containerBox.top + paddingTop
    addRangePropagator(
      `calc_containerTopPlusPadding_${this._containerNodeId}`,
      net,
      containerBox.top, // containerLayout.intrinsicBox.top
      paddingTop,
      containerTopPlusPadding
    )

    lessThanEqualPropagator(
      `containerTopPlusPadding <= minChildTop_${this._containerNodeId}`,
      net,
      containerTopPlusPadding, // a
      minChildTop            // b
    );
  }
}
