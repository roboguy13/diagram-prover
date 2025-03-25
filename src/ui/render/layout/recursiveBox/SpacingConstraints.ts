import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMax, getMidpoint, getMin, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange, selectMin } from "../../../../constraint/propagator/NumericRange"
import { CellRef, ConflictHandler, ContentIsNotKnownError, equalPropagator, known, mapContent, PropagatorNetwork, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { computeIndexedNodes, LevelMap, makeEdgeKey } from "../NodeLevels";
import { isArrayLike } from "lodash";
import { node } from "webpack";
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { NodesAndEdges } from "../LayoutEngine";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { elk } from "../elk/ElkEngine";

export const MAX_WIDTH: number = 1000;
export const MAX_HEIGHT: number = 500;
export const VERTICAL_PADDING = 100;
export const HORIZONTAL_PADDING = 100;

export type AbsolutePositionMap = Map<string, XYPosition>

export class ConstraintCalculator {
  private _spacingMap: SpacingMap
  private _absolutePositionMap: Map<string, XYPosition> = new Map()
  private readonly _rootId: string

  constructor(root: SemanticNode<void>, conflictHandlers: ConflictHandler<NumericRange>[]) {
    this._spacingMap = new SpacingMap(root.id, conflictHandlers)
    this._rootId = root.id

    this.generateConstraints(root)

    let [levelMap, _breadthIndexMap, _indexedNodes] = computeIndexedNodes(root)
    this.generateCousinConstraints(levelMap)

    try {
      this.minimizeSpacings()
    } catch (e) {
      if (e instanceof ContentIsNotKnownError) {
      } else {
        throw e
      }
    }

    let nodeIds = getNodeIds(root)
    this.generateAbsolutePositionMap(nodeIds)
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    return await this._spacingMap.renderDebugInfo()
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

      this.refineSubtreeSpacing(child1, child2)
      this.refineSubtreeSpacing(child2, child1)
      this._spacingMap.refineRootSpacing(child1.id, n.id)
      this._spacingMap.refineRootSpacing(child2.id, n.id)
      // this._spacingMap.refineRootSpacing(n.id, child1.id)
      // this._spacingMap.refineRootSpacing(n.id, child2.id)
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
    let minimizer = new Minimizer(this._spacingMap.net, this._spacingMap.getRelativeSpacingCells())
    minimizer.minimize()
  }
}

type Spacing = {
  isRelative: boolean
  xSpacing: CellRef
  ySpacing: CellRef
}

class SpacingMap {
  private _spacings: Map<string, Spacing> = new Map()
  private _net: PropagatorNetwork<NumericRange>
  private _rootNodeId: string

  constructor(rootNodeId: string, conflictHandlers: ConflictHandler<NumericRange>[]) {
    this._rootNodeId = rootNodeId

    this._net = new PropagatorNetwork<NumericRange>(partialSemigroupNumericRange(), conflictHandlers)

    this._spacings.set(makeEdgeKey(rootNodeId, rootNodeId), {
      isRelative: false,
      xSpacing: this._net.newCell('root self spacing X', known(exactly(0))),
      ySpacing: this._net.newCell('root self spacing Y', known(exactly(0))),
    })
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    let elkNode = propagatorNetworkToElkNode(this._net)
    let positioned = await elk.layout(elkNode)

    return elkToReactFlow(positioned)
  }

  public getRelativeSpacingCells(): CellRef[] {
    let result: CellRef[] = []

    for (let [edgeKey, spacing] of this._spacings) {
      if (spacing.isRelative) {
        result.push(spacing.xSpacing)
        result.push(spacing.ySpacing)
      }
    }

    return result
  }

  public get net(): PropagatorNetwork<NumericRange> {
    return this._net
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

    addRangePropagator('refine root spacing (X)',
      this._net,
      otherRootSpacing.xSpacing,
      otherCurrSpacing.xSpacing,
      currRootSpacing.xSpacing
    )

    addRangePropagator('refine root spacing (Y)',
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
        xSpacing: this._net.newCell('X spacing between ' + nodeId1 + ' and ' + nodeId2, known(atMost(MAX_WIDTH))),
        ySpacing: this._net.newCell('Y spacing between ' + nodeId1 + ' and ' + nodeId2, known(atMost(MAX_HEIGHT))),
      }

      let negativeSpacing = {
        isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
        xSpacing: this._net.newCell('negative X spacing between ' + nodeId1 + ' and ' + nodeId2, unknown()),
        ySpacing: this._net.newCell('negative Y spacing between ' + nodeId1 + ' and ' + nodeId2, unknown()),
      }

      negateNumericRangePropagator('negate', this._net, spacing.xSpacing, negativeSpacing.xSpacing)
      negateNumericRangePropagator('negate', this._net, spacing.ySpacing, negativeSpacing.ySpacing)

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
    let ySpacing = spacingMap.getYSpacing(this._nodeId1, this._nodeId2)

    // spacingMap.net.writeCell({ description: `xSpacing ∈ [${HORIZONTAL_PADDING}, ${HORIZONTAL_PADDING*2}]`, inputs: [xSpacing], outputs: [] }, xSpacing, known(between(HORIZONTAL_PADDING, HORIZONTAL_PADDING * 2)))
    writeBetweenPropagator(spacingMap.net, xSpacing, HORIZONTAL_PADDING, HORIZONTAL_PADDING * 2)

    spacingMap.net.writeCell({ description: 'ySpacing = 0', inputs: [ySpacing], outputs: [] }, ySpacing, known(exactly(0)))
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

    let leftmostChild = this._childIds[0]!
    let rightmostChild = this._childIds[this._childIds.length - 1]!

    let parentToRightSpacing = spacingMap.getXSpacing(this._parentId, rightmostChild)
    let parentToLeftSpacing = spacingMap.getXSpacing(this._parentId, leftmostChild)

    // spacingMap.net.writeCell({ description: `parentToRightSpacing ∈ [${HORIZONTAL_PADDING/2}, ∞)`, inputs: [parentToRightSpacing], outputs: [] }, parentToRightSpacing, known(atLeast(HORIZONTAL_PADDING / 2)))
    writeAtLeastPropagator(spacingMap.net, parentToRightSpacing, HORIZONTAL_PADDING / 2)

    // spacingMap.net.writeCell(parentToLeftSpacing, known(atMost(-HORIZONTAL_PADDING / 2)))

    negateNumericRangePropagator('negate', spacingMap.net, parentToLeftSpacing, parentToRightSpacing)
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
    writeBetweenPropagator(spacingMap.net, ySpacing, VERTICAL_PADDING, VERTICAL_PADDING * 1.2)
    // spacingMap.net.writeCell({ description: `ySpacing ∈ []` }, ySpacing, known(between(VERTICAL_PADDING, VERTICAL_PADDING * 1.3)))
  }
}

function writeBetweenPropagator(net: PropagatorNetwork<NumericRange>, cell: CellRef, min: number, max: number): void {
  net.writeCell({ description: `cell ∈ [${min}, ${max}]`, inputs: [], outputs: [cell] }, cell, known(between(min, max)))
}

function writeAtLeastPropagator(net: PropagatorNetwork<NumericRange>, cell: CellRef, min: number): void {
  net.writeCell({ description: `cell ∈ [${min}, ∞)`, inputs: [], outputs: [cell] }, cell, known(atLeast(min)))
}
