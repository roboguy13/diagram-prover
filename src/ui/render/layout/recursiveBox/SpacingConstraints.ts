import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMax, getMidpoint, getMin, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange, selectMin } from "../../../../constraint/propagator/NumericRange"
import { CellRef, equalPropagator, known, mapContent, PropagatorNetwork, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { computeIndexedNodes, LevelMap, makeEdgeKey } from "../NodeLevels";
import { isArrayLike } from "lodash";
import { node } from "webpack";

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

    let [levelMap, breadthIndexMap, indexedNodes] = computeIndexedNodes(root)
    this.generateCousinConstraints(levelMap)

    // this.minimizeSpacings()

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

      let x = this.chooseFromRange(this._spacingMap.net.readKnownOrError(xSpacing, 'x')) ?? 0
      let y = this.chooseFromRange(this._spacingMap.net.readKnownOrError(ySpacing, 'y')) ?? 0

      console.log('x: ', this._spacingMap.net.readKnownOrError(xSpacing, 'x'))
      console.log('y: ', this._spacingMap.net.readKnownOrError(ySpacing, 'y'))

      this._absolutePositionMap.set(nodeId, { x, y })
    }
  }

  private generateCousinConstraints(levelMap: LevelMap): void {
    for (let [level, nodeIds] of levelMap) {
      for (let i = 0; i < nodeIds.length - 1; i++) {
        let siblingConstraint = new SiblingConstraint(nodeIds[i]!, nodeIds[i + 1]!)
        siblingConstraint.apply(this._spacingMap)
        this._spacingMap.refineRootSpacing(nodeIds[i]!, nodeIds[i + 1]!)
      }
    }
  }

  private generateConstraints(n: SemanticNode<void>): void {
    // Set up parent-child constraints
    for (let child of n.children) {
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

      let siblingConstraint = new SiblingConstraint(child1.id, child2.id)
      siblingConstraint.apply(this._spacingMap)

      // this._spacingMap.refineRootSpacing(child2.id, child1.id)
      this.refineSubtreeSpacing(child1, child2)
      this.refineSubtreeSpacing(child2, child1)
      // this.refineSubtreeSpacing(n, child1)
      // this.refineSubtreeSpacing(n, child2)
      // this.refineSubtreeSpacing(child2, child1)
      this._spacingMap.refineRootSpacing(n.id, child1.id)
      this._spacingMap.refineRootSpacing(n.id, child2.id)
    }

    // Recurse over children
    for (let child of n.children) {
      this.generateConstraints(child)
    }
  }

  private refineSubtreeSpacing(a: SemanticNode<void>, b: SemanticNode<void>) {
    this._spacingMap.refineRootSpacing(a.id, b.id)
    for (let child of b.children) {
      this.refineSubtreeSpacing(a, child)
    }
  }

  private minimizeSpacings(): void {
    this._spacingMap.mapRelativeSpacings(selectMin)
  }
}

type Spacing = {
  isRelative: boolean
  xSpacing: CellRef
  ySpacing: CellRef
}

class SpacingMap {
  private _spacings: Map<string, Spacing> = new Map()
  private _net: PropagatorNetwork<NumericRange> = new PropagatorNetwork(partialSemigroupNumericRange())
  private _rootNodeId: string

  constructor(rootNodeId: string) {
    this._rootNodeId = rootNodeId

    this._spacings.set(makeEdgeKey(rootNodeId, rootNodeId), {
      isRelative: false,
      xSpacing: this._net.newCell(known(exactly(0))),
      ySpacing: this._net.newCell(known(exactly(0))),
    })
  }

  public get net(): PropagatorNetwork<NumericRange> {
    return this._net
  }

  public mapRelativeSpacings(f: (spacing: NumericRange) => NumericRange): void {
    for (let [key, spacing] of this._spacings) {
      if (spacing.isRelative) {
        this._net.updateCellKnown(spacing.xSpacing, f)
        this._net.updateCellKnown(spacing.ySpacing, f)
      }
    }
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
      this._net,
      otherRootSpacing.xSpacing,
      otherCurrSpacing.xSpacing,
      currRootSpacing.xSpacing
    )

    addRangePropagator(
      this._net,
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
        isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
        xSpacing: this._net.newCell(known(atMost(MAX_WIDTH))),
        ySpacing: this._net.newCell(known(atMost(MAX_HEIGHT))),
      }

      let negativeSpacing = {
        isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
        xSpacing: this._net.newCell(unknown()),
        ySpacing: this._net.newCell(unknown()),
      }

      negateNumericRangePropagator(this._net, spacing.xSpacing, negativeSpacing.xSpacing)
      negateNumericRangePropagator(this._net, spacing.ySpacing, negativeSpacing.ySpacing)

      this._spacings.set(makeEdgeKey(nodeId1, nodeId2), spacing)
      this._spacings.set(makeEdgeKey(nodeId2, nodeId1), negativeSpacing)

      return spacing
    }

    return spacing
  }

  public getXSpacing(nodeId1: string, nodeId2: string): CellRef { 
    return this.getSpacing(nodeId1, nodeId2).xSpacing
  }

  public getYSpacing(nodeId1: string, nodeId2: string): CellRef {
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

    spacingMap.net.writeCell(xSpacing, known(atLeast(HORIZONTAL_PADDING)))
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

      // xSpacing.write(known(exactly(0)))

      return
    }
    
    let leftmostChild = this._childIds[0]!
    let rightmostChild = this._childIds[this._childIds.length - 1]!

    let parentToRightSpacing = spacingMap.getXSpacing(this._parentId, rightmostChild)
    let parentToLeftSpacing = spacingMap.getXSpacing(this._parentId, leftmostChild)

    spacingMap.net.writeCell(parentToRightSpacing, known(atLeast(HORIZONTAL_PADDING / 2)))
    spacingMap.net.writeCell(parentToLeftSpacing, known(atMost(-HORIZONTAL_PADDING / 2)))

    negateNumericRangePropagator(spacingMap.net, parentToLeftSpacing, parentToRightSpacing)
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
    spacingMap.net.writeCell(ySpacing, known(atLeast(VERTICAL_PADDING)))
  }
}
