import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMax, getMidpoint, getMin, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange, printNumericRange, selectMin } from "../../../../constraint/propagator/NumericRange"
import { CellRef, ConflictHandler, ContentIsNotKnownError, equalPropagator, known, mapContent, printContent, PropagatorNetwork, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { computeIndexedNodes, LevelMap, makeEdgeKey } from "../NodeLevels";
import { isArrayLike } from "lodash";
import { node } from "webpack";
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { NodesAndEdges } from "../LayoutEngine";
import { propagatorNetworkToElkNode } from "../../../../constraint/propagator/PropagatorToElk";
import { elkToReactFlow } from "../elk/ElkToReactFlow";
import { elk } from "../elk/ElkEngine";

const LOG_PROPAGATOR_STATS = true
const MINIMIZE = true

export const VERTICAL_PADDING = 100;
export const HORIZONTAL_PADDING = 100;

export type AbsolutePositionMap = Map<string, XYPosition>

export type Dimensions = {
  width: NumericRange
  height: NumericRange
}

export class ConstraintCalculator {
  private _spacingMap: SpacingMap
  private _absolutePositionMap: Map<string, XYPosition> = new Map()
  private readonly _rootId: string

  constructor(dims: Dimensions, roots: SemanticNode<void>[], conflictHandlers: ConflictHandler<NumericRange>[], minimize: boolean = MINIMIZE) {
    const chosenRoot = roots[0]!

    this._spacingMap = new SpacingMap(dims, chosenRoot.id, conflictHandlers)
    this._rootId = chosenRoot.id
    console.log('got here')

    for (let root of roots) {
      // For each root node, we need to ensure that the root node has its own
      // self-spacing set up in the spacing map.
      this._spacingMap.getSpacing(this._rootId, root.id)
    }

    console.log('generating constraints')
    for (let root of roots) {
      try {
        this.generateConstraints(root)
      } catch (e) {
        console.error('Error generating constraints:', e)
      }
    }

    console.log('indexed nodes')
    for (let root of roots) {
      console.log('About to compute indexed nodes for', root.id)

      try {
        let [levelMap, _breadthIndexMap, _indexedNodes] = computeIndexedNodes(root)
        console.log('Computed indexed nodes for', root.id, levelMap)
        this.generateCousinConstraints(levelMap)
      } catch (e) {
        console.error('Error generating cousin constraints:', e)
      }
    }

    console.log('got here 2')

    if (minimize) {
      try {
        this.minimizeSpacings()
      } catch (e) {
        if (e instanceof ContentIsNotKnownError) {
        } else {
          throw e
        }
      }
    }

    if (LOG_PROPAGATOR_STATS) {
      console.log('Propagator cell count:', this._spacingMap.net.cells().length)
      console.log('Propagator count:', this._spacingMap.net.propagatorConnections.length)
    }

    let nodeIds = getNodeIds(chosenRoot)

    // Print bounding boxes
    if (LOG_PROPAGATOR_STATS) {
      for (let nodeId of nodeIds) {
        let boundingBox = this._spacingMap.lookupBoundingBox(nodeId)

        // Read the Content from the CellRefs and print them. Use readCell not readKnownOrError so that we don't get any errors
        let minX = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.minX))
        let minY = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.minY))
        let width = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.width))
        let height = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.height))
        if (LOG_PROPAGATOR_STATS) {
          console.log(`Bounding box for node ${nodeId}: minX=${minX}, minY=${minY}, width=${width}, height=${height}`)
        }

      }
    }


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
      let xSpacing = this._spacingMap.getXSpacing(this._rootId, nodeId)
      let ySpacing = this._spacingMap.getYSpacing(this._rootId, nodeId)

      let x = this.chooseFromRange(this._spacingMap.net.readKnownOrError(xSpacing, 'x')) ?? 0
      let y = this.chooseFromRange(this._spacingMap.net.readKnownOrError(ySpacing, 'y')) ?? 0

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

    for (let child of n.subgraph ?? []) {
      this.generateConstraints(child)
    }
  }

  private refineSubtreeSpacing(a: SemanticNode<void>, b: SemanticNode<void>) {
    this._spacingMap.refineRootSpacing(a.id, b.id)
    for (let child of b.children) {
      this.refineSubtreeSpacing(a, child)
    }

    for (let child of b.subgraph ?? []) {
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
  private _boundingBoxes: Map<string, BoundingBox> = new Map()
  private _net: PropagatorNetwork<NumericRange>
  private _rootNodeId: string
  private _dims: Dimensions

  constructor(dims: Dimensions, rootNodeId: string, conflictHandlers: ConflictHandler<NumericRange>[]) {
    this._rootNodeId = rootNodeId

    this._net = new PropagatorNetwork<NumericRange>(partialSemigroupNumericRange(), conflictHandlers)
    this._dims = dims

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

  public lookupBoundingBox(nodeId: string): BoundingBox {
    let boundingBox = this._boundingBoxes.get(nodeId)

    if (!boundingBox) {
      boundingBox = new BoundingBox(
        this._net,
        this._net.newCell(`minX for ${nodeId}`, unknown()),
        this._net.newCell(`minY for ${nodeId}`, unknown()),
        this._net.newCell(`width for ${nodeId}` , known(atLeast(0))),
        this._net.newCell(`height for ${nodeId}`, known(atLeast(0)))
      )

      this._boundingBoxes.set(nodeId, boundingBox)
    }
  
    return boundingBox
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

    addRangePropagator(`refine root spacing (X): ${currNodeId} <- ${otherNodeId}`,
      this._net,
      otherRootSpacing.xSpacing,
      otherCurrSpacing.xSpacing,
      currRootSpacing.xSpacing
    )

    addRangePropagator(`refine root spacing (Y): ${currNodeId} <- ${otherNodeId}`,
      this._net,
      otherRootSpacing.ySpacing,
      otherCurrSpacing.ySpacing,
      currRootSpacing.ySpacing
    )

    // Set the min values for the bounding box to be equal to the root spacings
    let boundingBox = this.lookupBoundingBox(currNodeId)
    this._net.equalPropagator(
      `set bounding box minX for ${currNodeId} from root spacing`,
      boundingBox.minX,
      currRootSpacing.xSpacing
    )

    this._net.equalPropagator(
      `set bounding box minY for ${currNodeId} from root spacing`,
      boundingBox.minY,
      currRootSpacing.ySpacing
    )
  }

  private getRootSpacing(nodeId: string): Spacing {
    return this.getSpacing(this._rootNodeId, nodeId)
  }

  public getSpacing(nodeId1: string, nodeId2: string): Spacing {
    let spacing = this._spacings.get(makeEdgeKey(nodeId1, nodeId2))

    if (!spacing) {
      spacing = {
        isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
        xSpacing: this._net.newCell('X spacing between ' + nodeId1 + ' and ' + nodeId2, known(this._dims.width)),
        ySpacing: this._net.newCell('Y spacing between ' + nodeId1 + ' and ' + nodeId2, known(this._dims.height)),
        // xSpacing: this._net.newCell('X spacing between ' + nodeId1 + ' and ' + nodeId2, known(atMost(this._dims.width))),
        // ySpacing: this._net.newCell('Y spacing between ' + nodeId1 + ' and ' + nodeId2, known(atMost(this._dims.height))),
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

      // Ensure that the bounding boxes are connected to the spacings
      const leftBoundingBox = this.lookupBoundingBox(nodeId1)
      const rightBoundingBox = this.lookupBoundingBox(nodeId2)

      let boundingBoxConstraint = new BoundingBoxRelativeConstraint(leftBoundingBox, rightBoundingBox, spacing)
      boundingBoxConstraint.apply(this)

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

    if (this._childIds.length === 1) {
      // If there's only one child, we can just set the parent X spacing to be the same as the child.
      let singleChildId = this._childIds[0]!
      let xSpacing = spacingMap.getXSpacing(this._parentId, singleChildId)

      spacingMap.net.writeCell({ description: `single child X spacing`, inputs: [xSpacing], outputs: [] }, xSpacing, known(exactly(0)))
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

// Connect the relative spacings to the bounding boxes
class BoundingBoxRelativeConstraint implements Constraint {
  private _leftBoundingBox: BoundingBox
  private _rightBoundingBox: BoundingBox
  private _spacing: Spacing

  constructor(leftBoundingBox: BoundingBox, rightBoundingBox: BoundingBox, spacing: Spacing) {
    this._leftBoundingBox = leftBoundingBox
    this._rightBoundingBox = rightBoundingBox
    this._spacing = spacing
  }

  // (leftBoundingBox.minX + leftBoundingBox.width) + spacing.xSpacing = rightBoundingBox.minX
  public apply(spacingMap: SpacingMap): void {

    // leftBoundingBox.minX + leftBoundingBox.width
    const leftBoundingBoxSumCell = spacingMap.net.newCell('leftBoundingBoxSumCell', unknown())

    // leftBoundingBox.minX + leftBoundingBox.width + spacing.xSpacing
    const eqLHS = spacingMap.net.newCell('eqLHS', unknown())

    addRangePropagator(
      `left bounding box sum cell`,
      spacingMap.net,
      this._leftBoundingBox.minX,
      this._leftBoundingBox.width,
      leftBoundingBoxSumCell
    )

    addRangePropagator(
      `eqLHS`,
      spacingMap.net,
      leftBoundingBoxSumCell,
      this._spacing.xSpacing,
      eqLHS
    )

    spacingMap.net.equalPropagator(
      `bounding box relative constraint`,
      eqLHS,
      this._rightBoundingBox.minX,
    )
  }
}

class BoundingBox {
  private _minX: CellRef
  private _minY: CellRef
  private _width: CellRef
  private _height: CellRef

  constructor(net: PropagatorNetwork<NumericRange>, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
    this._minX = minX
    this._minY = minY
    this._width = width
    this._height = height
  }

  public get minX(): CellRef {
    return this._minX
  }

  public get minY(): CellRef {
    return this._minY
  }

  public get width(): CellRef {
    return this._width
  }

  public get height(): CellRef {
    return this._height
  }
}