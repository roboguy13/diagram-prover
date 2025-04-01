import { XYPosition } from "@xyflow/react"
import { writeAtLeastPropagator, writeBetweenPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMax, getMidpoint, getMin, lessThanEqualPropagator, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange, printNumericRange, selectMin } from "../../../../constraint/propagator/NumericRange"
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
import { Dimensions, getNodeDimensions } from "../../../NodeDimensions";

const LOG_PROPAGATOR_STATS = true
const MINIMIZE = true

export const VERTICAL_PADDING = 100;
export const HORIZONTAL_PADDING = 100;

export type ExactDimensions =
  { width: number,
    height: number
  }

export type AbsolutePositionMap = Map<string, XYPosition>
export type DimensionsMap = Map<string, ExactDimensions>

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

    try {
      this.generateAbsolutePositionMap(nodeIds)
    } catch (e) {
      if (e instanceof ContentIsNotKnownError) {
        // Don't fail here, just log the error
        console.error('Failed to generate absolute position map:', e)
      } else {
        throw e // rethrow other errors
      }
    }
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    return await this._spacingMap.renderDebugInfo()
  }

  public get absolutePositionMap(): AbsolutePositionMap {
    return this._absolutePositionMap
  }

  public get dimensionsMap(): DimensionsMap {
    return this._spacingMap.dimensionsMap
  }

  private chooseFromRange(range: NumericRange): number {
    return getMin(range)!
  }

  private generateAbsolutePositionMap(nodeIds: string[]): void {
    for (let nodeId of nodeIds) {
      // let xSpacing = this._spacingMap.getXSpacing(this._rootId, nodeId)
      // let ySpacing = this._spacingMap.getYSpacing(this._rootId, nodeId)

      // let x = this.chooseFromRange(this._spacingMap.net.readKnownOrError(xSpacing, 'x')) ?? 0
      // let y = this.chooseFromRange(this._spacingMap.net.readKnownOrError(ySpacing, 'y')) ?? 0

      let x = this._spacingMap.getAbsoluteX(nodeId)
      let y = this._spacingMap.getAbsoluteY(nodeId)

      this._absolutePositionMap.set(nodeId, { x, y })
    }
  }

  private generateCousinConstraints(levelMap: LevelMap): void {
    for (let [level, nodeIds] of levelMap) {
      for (let i = 0; i < nodeIds.length - 1; i++) {
        let siblingConstraint = new SiblingConstraint(nodeIds[i]!, nodeIds[i + 1]!)
        siblingConstraint.apply(this._spacingMap)
      }
    }
  }

  private generateConstraints(n: SemanticNode<void>): void {
    // Set up the initial bounding box dimensions
    this._spacingMap.refineBoundingBoxDimensions(n, getNodeDimensions(n))

    // Set up parent-child constraints
    for (let child of n.children) {
      let parentChildConstraint = new ParentChildConstraint(n.id, child.id)
      parentChildConstraint.apply(this._spacingMap)
      console.log('Applied parent-child constraint between', n.id, 'and', child.id)
    }

    // Set up midpoint constraint
    let childIds = n.children.map(child => child.id)
    let midpointConstraint = new MidpointConstraint(this._rootId, n.id, childIds)
    midpointConstraint.apply(this._spacingMap)

    // Handle nested nodes (subgraphs)
    if (n.subgraph) {
      for (let i = 0; i < n.subgraph.length; i++) {
        let child = n.subgraph[i]!

        this.nestedNodeConstraints(n.id, child)
      }
    }

    // Recurse over children
    for (let child of n.children) {
      this.generateConstraints(child)
    }

    for (let child of n.subgraph ?? []) {
      this.generateConstraints(child)
    }
  }

  private nestedNodeConstraints(parentId: string, curr: SemanticNode<void>): void {
    if (!curr) {
      return
    }

    let nestedNodeConstraint = new NestedNodeConstraint(parentId, curr.id)
    nestedNodeConstraint.apply(this._spacingMap)

    // Recurse over the children of the current node
    for (let child of curr.children) {
      this.nestedNodeConstraints(curr.id, child)
    }

    for (let child of curr.subgraph ?? []) {
      this.nestedNodeConstraints(curr.id, child)
    }
  }

  private minimizeSpacings(): void {
    let minimizer = new Minimizer(this._spacingMap.net, this._spacingMap.getRelativeSpacingCells())
    minimizer.minimize()
  }
}

type Spacing = {
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
      xSpacing: this._net.newCell('root self spacing X', known(exactly(0))),
      ySpacing: this._net.newCell('root self spacing Y', known(exactly(0))),
    })

    this._boundingBoxes.set(
      this._rootNodeId,
      new BoundingBox(
        this._net,
        this._net.newCell(`minX for ${this._rootNodeId}`, known(exactly(0))), // Root minX
        this._net.newCell(`minY for ${this._rootNodeId}`, known(exactly(0))), // Root minY
        this._net.newCell(`width for ${this._rootNodeId}`, unknown()),
        this._net.newCell(`height for ${this._rootNodeId}`, unknown())
      )
    )
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    let elkNode = propagatorNetworkToElkNode(this._net)
    let positioned = await elk.layout(elkNode)

    return elkToReactFlow(positioned)
  }

  public get dimensionsMap(): DimensionsMap {
    const result: DimensionsMap = new Map()

    for (let [nodeId, boundingBox] of this._boundingBoxes) {
      let width = this._net.readKnownOrError(boundingBox.width, 'width')
      let height = this._net.readKnownOrError(boundingBox.height, 'height')

      if (width && height) {
        result.set(nodeId, { width: getMin(width)!, height: getMin(height)! })
      }
    }

    return result
  }

  public refineBoundingBoxDimensions(n: SemanticNode<void>, dims: Dimensions) {
    let boundingBox = this.lookupBoundingBox(n.id)

    this._net.writeCell(
      { description: `refine bounding box width for ${n.id}`,
        inputs: [],
        outputs: [boundingBox.width]
      },
      boundingBox.width,
      known(dims.width))

    this._net.writeCell(
      { description: `refine bounding box height for ${n.id}`,
        inputs: [],
        outputs: [boundingBox.height]
      },
      boundingBox.height,
      known(dims.height))
  }

  public getRelativeSpacingCells(): CellRef[] {
    let result: CellRef[] = []

    for (let [edgeKey, spacing] of this._spacings) {
      // if (spacing.isRelative) {
        result.push(spacing.xSpacing)
        result.push(spacing.ySpacing)
      // }
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

  public getSpacing(nodeId1: string, nodeId2: string): Spacing {
    let spacing = this._spacings.get(makeEdgeKey(nodeId1, nodeId2))

    if (!spacing) {
      spacing = {
        // isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
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

      // if (spacing.isRelative) {
        // Ensure that the bounding boxes are connected to the spacings
        const leftBoundingBox = this.lookupBoundingBox(nodeId1)
        const rightBoundingBox = this.lookupBoundingBox(nodeId2)
  
        let boundingBoxConstraint = new BoundingBoxRelativeConstraint(leftBoundingBox, rightBoundingBox, spacing)
        boundingBoxConstraint.apply(this)
      // }

      return spacing
    }

    return spacing
  }

  public getAbsoluteX(nodeId: string): number {
    let boundingBox = this.lookupBoundingBox(nodeId)
    let xSpacing = this._net.readKnownOrError(boundingBox.minX, 'minX')
    
    if (!xSpacing) {
      console.error(`Failed to read minX for node ${nodeId}`)
      return 0
    }

    return getMin(xSpacing)!
  }

  public getAbsoluteY(nodeId: string): number {
    let boundingBox = this.lookupBoundingBox(nodeId)
    let ySpacing = this._net.readKnownOrError(boundingBox.minY, 'minY')
    
    if (!ySpacing) {
      console.error(`Failed to read minY for node ${nodeId}`)
      return 0
    }

    return getMin(ySpacing)!
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

// Constrain the nested node to be inside the nesting node
class NestedNodeConstraint implements Constraint {
  private _parentId: string
  private _childId: string

  constructor(parentId: string, childId: string) {
    this._parentId = parentId
    this._childId = childId
  }

  public apply(spacingMap: SpacingMap): void {
    let parentBoundingBox = spacingMap.lookupBoundingBox(this._parentId)
    let childBoundingBox = spacingMap.lookupBoundingBox(this._childId)

    this.applyX(spacingMap, parentBoundingBox, childBoundingBox)
    this.applyY(spacingMap, parentBoundingBox, childBoundingBox)
  }

  private applyX(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    this.applyXMin(spacingMap, parentBoundingBox, childBoundingBox)
    this.applyXMax(spacingMap, parentBoundingBox, childBoundingBox)
  }

  private applyY(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    this.applyYMin(spacingMap, parentBoundingBox, childBoundingBox)
    this.applyYMax(spacingMap, parentBoundingBox, childBoundingBox)
  }

  // parent.minX <= child.minX
  private applyXMin(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint X min`,
      spacingMap.net,
      parentBoundingBox.minX,
      childBoundingBox.minX
    )
  }

  // child.maxX <= parent.maxX
  private applyXMax(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint X max`,
      spacingMap.net,
      childBoundingBox.maxX,
      parentBoundingBox.maxX
    )
  }

  // parent.minY <= child.minY
  private applyYMin(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint Y min`,
      spacingMap.net,
      parentBoundingBox.minY,
      childBoundingBox.minY
    )
  }

  // child.maxY <= parent.maxY
  private applyYMax(spacingMap: SpacingMap, parentBoundingBox: BoundingBox, childBoundingBox: BoundingBox): void {
    lessThanEqualPropagator(
      `nested node constraint Y max`,
      spacingMap.net,
      childBoundingBox.maxY,
      parentBoundingBox.maxY
    )
  }
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

    // if (!this._spacing.isRelative) {
    //   console.error(`BoundingBoxRelativeConstraint was constructed with non-relative spacing, this is unexpected.`, {
    //     leftBoundingBox: leftBoundingBox,
    //     rightBoundingBox: rightBoundingBox,
    //     spacing: spacing
    //   })
    //   throw new Error(
    //     `BoundingBoxRelativeConstraint can only be used with relative spacings, but got non-relative spacing for left and right bounding boxes`
    //   )
    // }
  }

  public apply(spacingMap: SpacingMap): void {
    this.applyX(spacingMap)
    this.applyY(spacingMap)
  }

  // (leftBoundingBox.minX + leftBoundingBox.width) + spacing.xSpacing <= rightBoundingBox.minX
  private applyX(spacingMap: SpacingMap): void {
    // leftBoundingBox.minX + leftBoundingBox.width
    const leftBoundingBoxSumCell = spacingMap.net.newCell('leftBoundingBoxSumCell', unknown())

    // leftBoundingBox.minX + leftBoundingBox.width + spacing.xSpacing
    const leqLHS = spacingMap.net.newCell('eqLHS', unknown())

    addRangePropagator(
      `left bounding box sum cell`,
      spacingMap.net,
      this._leftBoundingBox.minX,
      this._leftBoundingBox.width,
      leftBoundingBoxSumCell
    )

    addRangePropagator(
      `leqLHS_x`,
      spacingMap.net,
      leftBoundingBoxSumCell,
      this._spacing.xSpacing,
      leqLHS
    )

    lessThanEqualPropagator(
      `bounding box relative constraint X`,
      spacingMap.net,
      leqLHS,
      this._rightBoundingBox.minX,
    )
  }

  // (leftBoundingBox.minY + leftBoundingBox.height) + spacing.ySpacing <= rightBoundingBox.minY
  private applyY(spacingMap: SpacingMap): void {
    // leftBoundingBox.minY + leftBoundingBox.height
    const leftBoundingBoxSumCell = spacingMap.net.newCell('leftBoundingBoxSumCellY', unknown())

    // leftBoundingBox.minY + leftBoundingBox.height + spacing.ySpacing
    const leqLHS = spacingMap.net.newCell('eqLHSY', unknown())

    addRangePropagator(
      `left bounding box sum cell Y`,
      spacingMap.net,
      this._leftBoundingBox.minY,
      this._leftBoundingBox.height,
      leftBoundingBoxSumCell
    )

    addRangePropagator(
      `leqLHS_y`,
      spacingMap.net,
      leftBoundingBoxSumCell,
      this._spacing.ySpacing,
      leqLHS
    )

    lessThanEqualPropagator(
      `bounding box relative constraint Y`,
      spacingMap.net,
      leqLHS,
      this._rightBoundingBox.minY,
    )
  }
}

class BoundingBox {
  private _minX: CellRef
  private _minY: CellRef
  private _width: CellRef
  private _height: CellRef

  private _maxX: CellRef
  private _maxY: CellRef

  constructor(net: PropagatorNetwork<NumericRange>, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
    this._minX = minX
    this._minY = minY
    this._width = width
    this._height = height

    this._maxX = net.newCell('maxX', unknown())
    this._maxY = net.newCell('maxY', unknown())

    // maxX = minX + width
    addRangePropagator(
      `maxX calculation`,
      net,
      this._minX,
      this._width,
      this._maxX
    )

    // maxY = minY + height
    addRangePropagator(
      `maxY calculation`,
      net,
      this._minY,
      this._height,
      this._maxY
    )
  }

  public get minX(): CellRef {
    return this._minX
  }

  public get minY(): CellRef {
    return this._minY
  }

  public get maxX(): CellRef {
    return this._maxX
  }

  public get maxY(): CellRef {
    return this._maxY
  }

  public get width(): CellRef {
    return this._width
  }

  public get height(): CellRef {
    return this._height
  }
}