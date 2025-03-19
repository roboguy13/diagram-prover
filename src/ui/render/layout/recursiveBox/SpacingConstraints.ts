import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMax, getMin, makeZeroCell, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange"
import { Cell, equalPropagator, known, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { makeEdgeKey } from "../NodeLevels";

export const MAX_WIDTH: number = 1000;
export const MAX_HEIGHT: number = 500;
export const VERTICAL_PADDING = 100;
export const HORIZONTAL_PADDING = 100;

export type AbsolutePositionMap = Map<string, XYPosition>

export class ConstraintCalculator {
  private _spacingMap: SpacingMap
  private _absolutePositionMap: Map<string, XYPosition> = new Map()
  private readonly _rootId: string

  constructor(root: SemanticNode<void>) {
    this._spacingMap = new SpacingMap(root.id)
    this._rootId = root.id
    this.generateConstraints(root)
    let nodeIds = getNodeIds(root)
    this.generateAbsolutePositionMap(nodeIds)
  }

  public get absolutePositionMap(): AbsolutePositionMap {
    return this._absolutePositionMap
  }

  private chooseFromRange(range: NumericRange): number {
    return getMin(range)!
  }

  private generateAbsolutePositionMap(nodeIds: string[]): void {
    for (let nodeId of nodeIds) {
      console.log('nodeId: ', nodeId)
      let xSpacing = this._spacingMap.getXSpacing(this._rootId, nodeId)
      let ySpacing = this._spacingMap.getYSpacing(this._rootId, nodeId)

      let x = this.chooseFromRange(xSpacing.readKnownOrError('x')) ?? 0
      let y = this.chooseFromRange(ySpacing.readKnownOrError('y')) ?? 0

      console.log('x: ', xSpacing.readKnownOrError('x'))
      console.log('y: ', ySpacing.readKnownOrError('y'))

      this._absolutePositionMap.set(nodeId, { x, y })
    }
  }

  private generateConstraints(n: SemanticNode<void>): void {
    // Set up sibling constraints
    for (let i = 0; i < n.children.length - 1; i++) {
      let child1 = n.children[i]!
      let child2 = n.children[i + 1]!

      let siblingConstraint = new SiblingConstraint(child1.id, child2.id)
      siblingConstraint.apply(this._spacingMap)
    }

    // Set up parent-child constraints
    for (let child of n.children) {
      // console.log('child: ', child.id, 'parent: ', n.id)
      // let ySpacing = this._spacingMap.getYSpacing(n.id, child.id)
      // ySpacing.write(known(exactly(VERTICAL_PADDING)))
      let parentChildConstraint = new ParentChildConstraint(n.id, child.id)
      parentChildConstraint.apply(this._spacingMap)
    }

    // Set up midpoint constraint
    let childIds = n.children.map(child => child.id)
    let midpointConstraint = new MidpointConstraint(this._rootId, n.id, childIds)
    midpointConstraint.apply(this._spacingMap)

    // Refine based on left child
    if (n.children.length > 0) {
      let leftChildId = n.children[0]!.id
      this._spacingMap.refineRootSpacing(n.id, leftChildId)
    }

    // Refine root spacing of children based on siblings
    for (let i = 0; i < n.children.length - 1; i++) {
      let child1 = n.children[i]!
      let child2 = n.children[i + 1]!
      this._spacingMap.refineRootSpacing(child2.id, child1.id)
      this._spacingMap.refineRootSpacing(n.id, child1.id)
      this._spacingMap.refineRootSpacing(n.id, child2.id)
    }

    // Recurse over children
    for (let child of n.children) {
      this.generateConstraints(child)
    }
  }
}

type Spacing = {
  xSpacing: Cell<NumericRange>
  ySpacing: Cell<NumericRange>
}

class SpacingMap {
  private _spacings: Map<string, Spacing> = new Map()
  private _rootNodeId: string

  constructor(rootNodeId: string) {
    this._rootNodeId = rootNodeId

    this._spacings.set(makeEdgeKey(rootNodeId, rootNodeId), {
      xSpacing: makeZeroCell(),
      ySpacing: makeZeroCell(),
    })
  }

  // Refines the root spacing for currNodeId given the root spacing of
  // otherNodeId as well as the spacing between otherNodeId and currNodeId.
  public refineRootSpacing(currNodeId: string, otherNodeId: string): void {
    if (currNodeId === this._rootNodeId) {
      return
    }

    let currRootSpacing = this.getRootSpacing(currNodeId)
    let otherRootSpacing = this.getRootSpacing(otherNodeId)
    let otherCurrSpacing = this.getSpacing(otherNodeId, currNodeId)

    addRangePropagator(
      otherRootSpacing.xSpacing,
      otherCurrSpacing.xSpacing,
      currRootSpacing.xSpacing
    )

    addRangePropagator(
      otherRootSpacing.ySpacing,
      otherCurrSpacing.ySpacing,
      currRootSpacing.ySpacing
    )

  }

  private getRootSpacing(nodeId: string): Spacing {
    return this.getSpacing(this._rootNodeId, nodeId)
  }

  public getSpacing(nodeId1: string, nodeId2: string): Spacing {
    let spacing = this._spacings.get(makeEdgeKey(nodeId1, nodeId2))

    if (!spacing) {
      console.log('nodeId1: ', nodeId1, 'nodeId2: ', nodeId2)
      spacing = {
        xSpacing: new Cell(partialSemigroupNumericRange(), known(atMost(MAX_WIDTH))),
        ySpacing: new Cell(partialSemigroupNumericRange(), known(atMost(MAX_HEIGHT))),
      }

      let negativeSpacing = {
        xSpacing: new Cell(partialSemigroupNumericRange(), unknown()),
        ySpacing: new Cell(partialSemigroupNumericRange(), unknown()),
      }

      negateNumericRangePropagator(spacing.xSpacing, negativeSpacing.xSpacing)
      negateNumericRangePropagator(spacing.ySpacing, negativeSpacing.ySpacing)

      this._spacings.set(makeEdgeKey(nodeId1, nodeId2), spacing)
      this._spacings.set(makeEdgeKey(nodeId2, nodeId1), negativeSpacing)

      return spacing
    }

    return spacing
  }

  public getXSpacing(nodeId1: string, nodeId2: string): Cell<NumericRange> { 
    return this.getSpacing(nodeId1, nodeId2).xSpacing
  }

  public getYSpacing(nodeId1: string, nodeId2: string): Cell<NumericRange> {
    return this.getSpacing(nodeId1, nodeId2).ySpacing
  }
}

interface Constraint {
  apply(spacingMap: SpacingMap): void
}

class SiblingConstraint implements Constraint {
  private _nodeId1: string
  private _nodeId2: string

  constructor(nodeId1: string, nodeId2: string) {
    this._nodeId1 = nodeId1
    this._nodeId2 = nodeId2
  }

  public apply(spacingMap: SpacingMap): void {
    let xSpacing = spacingMap.getXSpacing(this._nodeId1, this._nodeId2)

    xSpacing.write(known(atLeast(HORIZONTAL_PADDING)))
  }
}
class MidpointConstraint implements Constraint {
  private _parentId: string
  private _childIds: string[]
  private _rootId: string

  constructor(rootId: string, parentId: string, childIds: string[]) {
    this._rootId = rootId
    this._parentId = parentId
    this._childIds = childIds
  }

  public apply(spacingMap: SpacingMap): void {
    if (this._childIds.length === 0) {
      return
    }
    
    if (this._childIds.length === 1) {
      let childId = this._childIds[0]!
      let xSpacing = spacingMap.getXSpacing(this._parentId, childId)

      xSpacing.write(known(exactly(0)))

      return
    }
    
    let leftmostChild = this._childIds[0]!
    let rightmostChild = this._childIds[this._childIds.length - 1]!

    let parentToRightSpacing = spacingMap.getXSpacing(this._parentId, rightmostChild)
    let parentToLeftSpacing = spacingMap.getXSpacing(this._parentId, leftmostChild)
    parentToRightSpacing.write(known(atLeast(HORIZONTAL_PADDING)))
    parentToLeftSpacing.write(known(atLeast(-HORIZONTAL_PADDING)))

    negateNumericRangePropagator(parentToLeftSpacing, parentToRightSpacing)
  }
}

class ParentChildConstraint implements Constraint {
  private _parentId: string
  private _childId: string

  constructor(parentId: string, childId: string) {
    this._parentId = parentId
    this._childId = childId
  }

  public apply(spacingMap: SpacingMap): void {
    let ySpacing = spacingMap.getYSpacing(this._parentId, this._childId)
    ySpacing.write(known(atLeast(VERTICAL_PADDING)))
  }
}
