import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMin, makeZeroCell, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange"
import { Cell, known, unknown } from "../../../../constraint/propagator/Propagator"
import { SemanticNode } from "../../../../ir/SemanticGraph";

export const MAX_WIDTH: number = 1000;
export const MAX_HEIGHT: number = 500;
export const VERTICAL_PADDING = 10;
export const HORIZONTAL_PADDING = 10;

export type AbsolutePositionMap = Map<string, XYPosition>

export class ConstraintCalculator {
  private _constraintMap: ConstraintMap
  private _absolutePositionMap: Map<string, XYPosition> = new Map()
  private readonly _rootId: string

  constructor(root: SemanticNode<void>) {
    this._constraintMap = new ConstraintMap(root.id)
    this._rootId = root.id
    this.generateConstraints(root)
    this.generateAbsolutePositionMap()
  }

  public get absolutePositionMap(): AbsolutePositionMap {
    return this.absolutePositionMap
  }

  private generateAbsolutePositionMap(): void {
    for (let constraint of this._constraintMap.rootConstraints.values()) {
      console.log(`Node ${constraint.nodeId} has root constraint: ${JSON.stringify(constraint.spacings)}`)
      let x = getMin(constraint.spacings[0]!.xSpacing!.readKnownOrError('x')) ?? 0
      let y = getMin(constraint.spacings[0]!.ySpacing!.readKnownOrError('y')) ?? 0

      this._absolutePositionMap.set(constraint.nodeId, { x, y })
    }
  }

  private generateConstraints(n: SemanticNode<void>): void {
    let children = n.children
    let childSiblingConstraints: SiblingConstraint[] = []

    // Set siblings and root constraints relative to the previous sibling
    for (let i = 1; i < children.length; i++) {
      let child = children[i]!
      let prevChild = children[i - 1]!

      let siblingConstraint = new SiblingConstraint(prevChild.id, child.id)
      let prevSpacing = siblingConstraint.spacings[0]!

      let prevRootConstraint = this._constraintMap.getRootConstraint(prevChild.id)
      let rootConstraint = new RootConstraint(child.id, this._rootId)

      let prevData: [RootConstraint, Spacing] | null
        = (prevRootConstraint && prevRootConstraint.spacings[0])
            ? [prevRootConstraint, prevRootConstraint.spacings[0]]
            : null

      rootConstraint.updateRootSpacing(prevData)

      this._constraintMap.addConstraint(siblingConstraint)
      this._constraintMap.addConstraint(rootConstraint)

      childSiblingConstraints.push(siblingConstraint)
    }

    if (children.length >= 2) {
      // Create a parent midpoint constraint
      let leftmostChildId = children[0]!.id

      this._constraintMap.addConstraint(new ParentMidpointConstraint(n.id, leftmostChildId, childSiblingConstraints))
    }

    // Set parent-child constraints and set first child root constraint relative to n
    for (let i = 0; i < children.length; i++) {
      let child = children[i]!
      let parentChildConstraint = new ParentChildConstraint(n.id, child.id)

      this._constraintMap.addConstraint(parentChildConstraint)

      if (i === 0) {
        let nRootConstraint = this._constraintMap.getRootConstraint(n.id)

        let nData: [RootConstraint, Spacing] | null
          = (nRootConstraint && nRootConstraint.spacings[0])
              ? [nRootConstraint, nRootConstraint.spacings[0]]
              : null

        this._constraintMap.addConstraint(new RootConstraint(child.id, this._rootId, nData, null)) // TODO: Find a better way?
      }
    }

    // Generate constraints for children
    for (let child of children) {
      this.generateConstraints(child)
    }
  }
}

class ConstraintMap {
  private readonly _rootConstraints: Map<string, RootConstraint> = new Map()
  private readonly _otherConstraints: Map<string, SpacingConstraint[]> = new Map()
  private readonly _rootNodeId: string

  constructor(rootNodeId: string) {
    this._rootNodeId = rootNodeId

    var _rootRootConstraint = new RootConstraint(rootNodeId, rootNodeId, null, { otherNodeId: rootNodeId, xSpacing: makeZeroCell(), ySpacing: makeZeroCell() })
    this._rootConstraints.set(rootNodeId, _rootRootConstraint)
  }

  public addConstraint(constraint: SpacingConstraint): void {
    let nodeId = constraint.nodeId

    if (constraint instanceof RootConstraint) {
      if (this._rootConstraints.has(nodeId)) {
        throw new Error(`Duplicate root constraint for node ${nodeId}`)
      }

      this._rootConstraints.set(nodeId, constraint)
    } else if (this._otherConstraints.has(nodeId)) {
      this._otherConstraints.get(nodeId)!.push(constraint)
    } else {
      this._otherConstraints.set(nodeId, [constraint])
    }
  }

  public getXSpacing(nodeId: string, otherNodeId: string): Cell<NumericRange> | null {
    if (nodeId === this._rootNodeId) {
      return this._rootConstraints.get(nodeId)?.spacings.find(spacing => spacing.otherNodeId === otherNodeId)?.xSpacing ?? null
    }

    return this._otherConstraints.get(nodeId)?.find(constraint => constraint.spacings.some(spacing => spacing.otherNodeId === otherNodeId))?.spacings.find(spacing => spacing.otherNodeId === otherNodeId)?.xSpacing ?? null
  }

  public getYSpacing(nodeId: string, otherNodeId: string): Cell<NumericRange> | null {
    if (nodeId === this._rootNodeId) {
      return this._rootConstraints.get(nodeId)?.spacings.find(spacing => spacing.otherNodeId === otherNodeId)?.ySpacing ?? null
    }

    return this._otherConstraints.get(nodeId)?.find(constraint => constraint.spacings.some(spacing => spacing.otherNodeId === otherNodeId))?.spacings.find(spacing => spacing.otherNodeId === otherNodeId)?.ySpacing ?? null
  }

  public get rootConstraints(): Map<string, RootConstraint> {
    return this._rootConstraints
  }

  public getRootConstraint(nodeId: string): RootConstraint | null {
    return this._rootConstraints.get(nodeId) ?? null
  }
}

type Spacing =
  { otherNodeId: string,
    xSpacing: Cell<NumericRange> | null,
    ySpacing: Cell<NumericRange> | null
  }

interface SpacingConstraint {
  get nodeId(): string
  get spacings(): Spacing[]
}

// Spacing of a node relative to the root node
class RootConstraint implements SpacingConstraint {
  private readonly _thisNodeId: string
  private readonly _rootNodeId: string
  private readonly _xSpacing: Cell<NumericRange>
  private readonly _ySpacing: Cell<NumericRange>

  constructor(thisNodeId: string, rootNodeId: string) {
    this._thisNodeId = thisNodeId
    this._rootNodeId = rootNodeId

    this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())
    this._ySpacing = new Cell(partialSemigroupNumericRange(), unknown())

    this.initializeCells()
  }

  // TODO: In general, thisNode gets information about its horizontal spacing from the root in two ways, both of which should be accounted for:
  //   1. The horizontal spacing given by the sibling constraint
  //   2. The horizontal spacing given by the midpoint constraint
  //
  // So, it needs root constraint information from the following, when they exist: (1) its left sibling, (2) its left child.
  // These data are enough to determine the horizontal root spacing of the subtree rooted at thisNode.
  private initializeCells(): void {
    if (this._thisNodeId === this._rootNodeId) {
      // This is the root node
      this._xSpacing.write(known(exactly(0)))
      this._ySpacing.write(known(exactly(0)))
    }
    // else {
    //   this.updateRootSpacing(leftSiblingData)
    //   this.updateRootSpacing(leftChildData)
    // }
  }

  public updateRootSpacing(otherNodeData: [RootConstraint, Spacing] | null): void {
    if (otherNodeData === null) {
      return
    }

    let [otherRootConstraint, otherSpacingToHere] = otherNodeData

    if (otherRootConstraint._xSpacing) {
      addRangePropagator(otherRootConstraint._xSpacing, otherSpacingToHere.xSpacing!, this._xSpacing)
    }

    if (otherRootConstraint._ySpacing) {
      addRangePropagator(otherRootConstraint._ySpacing, otherSpacingToHere.ySpacing!, this._ySpacing)
    }
  }

  public get spacings(): Spacing[] {
    return [
      { otherNodeId: this._rootNodeId, xSpacing: this._xSpacing, ySpacing: this._ySpacing }
    ]
  }

  public get nodeId(): string {
    return this._thisNodeId
  }
}

class ParentMidpointConstraint implements SpacingConstraint {
  private readonly _thisNodeId: string
  private readonly _leftmostChildId: string
  private readonly _childSiblingRelations: SiblingConstraint[]
  private readonly _xSpacing: Cell<NumericRange>

  constructor(thisNodeId: string, leftmostChildId: string, childSiblingRelations: SiblingConstraint[]) {
    this._thisNodeId = thisNodeId
    this._leftmostChildId = leftmostChildId
    this._childSiblingRelations = childSiblingRelations
    this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())

    this.initializeCells()
  }

  private initializeCells(): void {
    let sumCell = new Cell(partialSemigroupNumericRange(), unknown())

    addRangeListPropagator(this._childSiblingRelations.map((relation) => relation.spacings[0]!.xSpacing!), sumCell)
    divNumericRangeNumberPropagator(sumCell, 2, this._xSpacing)
  }

  public get spacings(): Spacing[] {
    return [
      { otherNodeId: this._leftmostChildId, xSpacing: this._xSpacing, ySpacing: null },
    ]
  }

  public get nodeId(): string {
    return this._thisNodeId
  }
}

class ParentChildConstraint implements SpacingConstraint {
  private readonly _thisNodeId: string
  private readonly _otherNodeId: string
  private readonly _ySpacing: Cell<NumericRange>

  constructor(thisNodeId: string, otherNodeId: string) {
    this._thisNodeId = thisNodeId
    this._otherNodeId = otherNodeId
    this._ySpacing = new Cell(partialSemigroupNumericRange(), unknown())

    this.initializeCell()
  }

  private initializeCell(): void {
    this._ySpacing.write(known(atLeast(VERTICAL_PADDING)))
  }

  public get spacings(): Spacing[] {
    return [{ otherNodeId: this._otherNodeId, xSpacing: null, ySpacing: this._ySpacing }]
  }

  public get nodeId(): string {
    return this._thisNodeId
  }
}

// TODO: Add spacing going the other way too?
class SiblingConstraint implements SpacingConstraint {
  private readonly _thisNodeId: string
  private readonly _otherNodeId: string
  private readonly _xSpacing: Cell<NumericRange>

  constructor(thisNodeId: string, otherNodeId: string) {
    this._thisNodeId = thisNodeId
    this._otherNodeId = otherNodeId
    this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())

    this.initializeCell()
  }

  private initializeCell(): void {
    this._xSpacing.write(known(atLeast(HORIZONTAL_PADDING)))
  }

  public get spacings(): Spacing[] {
    return [{ otherNodeId: this._otherNodeId, xSpacing: this._xSpacing, ySpacing: null }]
  }

  public get nodeId(): string {
    return this._thisNodeId
  }
}

// class ParentMidpointConstraint implements Constraint {
//   private readonly _thisNodeId: string
//   private readonly _leftmostChildId: string
//   private readonly _rightmostChildId: string
//   private readonly _xSpacing: Cell<NumericRange>

//   constructor(thisNodeId: string, leftmostChildId: string, rightmostChildId: string) {
//     this._thisNodeId = thisNodeId
//     this._leftmostChildId = leftmostChildId
//     this._rightmostChildId = rightmostChildId
//     this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())

//     this.initializeCell()
//   }

//   private initializeCell(): void {
//     // binaryPropagator(this._leftmostChildId, this._rightmostChildId, this._xSpacing, (leftmost: NumericRange, rightmost: NumericRange): NumericRange => {
//     // }
//   }

//   public get xSpacing(): Cell<NumericRange> {
//     return this._xSpacing
//   }

//   public get ySpacing(): Cell<NumericRange> | null {
//     return null
//   }
// }

// class ParentChildConstraint implements Constraint {
//   private readonly _thisNodeId: string
//   private readonly _otherNodeId: string

//   private readonly _ySpacing: Cell<NumericRange>

//   constructor(thisNodeId: string, otherNodeId: string) {
//     this._thisNodeId = thisNodeId
//     this._otherNodeId = otherNodeId
//     this._ySpacing = new Cell(partialSemigroupNumericRange(), unknown())

//     this.initializeCell()
//   }

//   private initializeCell(): void {
//     this._ySpacing.write(known(atLeast(VERTICAL_PADDING)))
//   }

//   public getThisNodeId(): string {
//     return this._thisNodeId
//   }

//   public getOtherNodeId(): string {
//     return this._otherNodeId
//   }

//   public get xSpacing(): Cell<NumericRange> | null {
//     return null
//   }

//   public get ySpacing(): Cell<NumericRange> {
//     return this._ySpacing
//   }
// }

// class SiblingConstraint implements Constraint {
//   private readonly _thisNodeId: string
//   private readonly _otherNodeId: string
//   private readonly _xSpacing: Cell<NumericRange>

//   constructor(thisNodeId: string, otherNodeId: string) {
//     this._thisNodeId = thisNodeId
//     this._otherNodeId = otherNodeId
//     this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())

//     this.initializeCell()
//   }

//   private initializeCell(): void {
//     this._xSpacing.write(known(atLeast(HORIZONTAL_PADDING)))
//   }

//   public getThisNodeId(): string {
//     return this._thisNodeId
//   }

//   public getOtherNodeId(): string {
//     return this._otherNodeId
//   }

//   public get ySpacing(): Cell<NumericRange> | null {
//     return null
//   }

//   public get xSpacing(): Cell<NumericRange> {
//     return this._xSpacing
//   }
// }

// // export type ConstraintMap = Map<string, PropagatorConstraint[]>

// // export class ConstraintCalculator {
// //   private readonly _absolutePositionMap: AbsolutePositionMap
// //   private readonly _nodeRelationConstraints: NodeRelationConstraint[]
// //   private readonly _midpointConstraints: MidpointConstraint[]

// //   constructor(n: SemanticNode<void>) {
// //     this._absolutePositionMap = new AbsolutePositionMap({ x: MAX_WIDTH/2, y: 0 }, n.id, getNodeIds(n))
// //     this._nodeRelationConstraints = []
// //     this._midpointConstraints = []

// //     this.buildNodeRelationConstraints(n)
// //     this.buildMidpointConstraints(n)

// //     // Log some spacing information from _nodeRelationConstraints
// //     for (let constraint of this._nodeRelationConstraints) {
// //       console.log(`Node ${constraint.getParent().nodeId} to ${constraint.getChild().nodeId} spacing: ${JSON.stringify(constraint.readKnownOrError('spacing'))}`)
// //     }

// //     // // Log some spacing information from _midpointConstraints
// //     // for (let constraint of this._midpointConstraints) {
// //     //   console.log(`Midpoint is: ${JSON.stringify(constraint.readKnownOrError('midpoint'))}`)
// //     // }

// //     this.relateToAbsolutePositions()
// //   }

// //   get absolutePositionMap(): AbsolutePositionMap {
// //     return this._absolutePositionMap
// //   }

// //   buildNodeRelationConstraints(n: SemanticNode<void>): void {
// //     let [_a, _b, indexedNodes] = computeIndexedNodes(n)
// //     let nodePairs = indexedNodePairs(indexedNodes)

// //     for (let [nodeA, nodeB] of nodePairs) {
// //       let constraint = new NodeRelationConstraint(nodeA, nodeB, MAX_WIDTH)
// //       this._nodeRelationConstraints.push(constraint)
// //     }
// //   }

// //   buildMidpointConstraints(n: SemanticNode<void>): void {
// //     let childRelationCells: Cell<NumericRange>[] = []

// //     for (let child of n.children) {
// //       let childId = child.id
// //       let constraint  = this._nodeRelationConstraints.find((c) => c.hasNodeId(childId))!
// //       let childCell = constraint.cell
// //       let otherId = constraint.getOtherNodeId(childId)

// //       if (n.children.some((c) => c.id === otherId)) {
// //         childRelationCells.push(childCell)
// //       }
// //     }

// //     this._midpointConstraints.push(new MidpointConstraint(n.id, childRelationCells))
// //   }

// //   relateToAbsolutePositions(): void {
// //     for (let constraint of this._nodeRelationConstraints) {
// //       constraint.relateToAbsolutePositions(this._absolutePositionMap)
// //     }

// //     for (let constraint of this._midpointConstraints) {
// //       constraint.relateToAbsolutePositions(this._absolutePositionMap)
// //     }
// //   }
// // }

// // export interface PropagatorConstraint {
// //   readKnownOrError(msg: string): NumericRange
// //   relateToAbsolutePositions(absolutePositionMap: AbsolutePositionMap): void
// //   getCell(): Cell<NumericRange>
// // }

// // export class AbsolutePositionMap {
// //   private readonly _mapX: Map<string, Cell<NumericRange>> = new Map()
// //   private readonly _mapY: Map<string, Cell<NumericRange>> = new Map()

// //   constructor(rootPosition: XYPosition, rootId: string, nodeIds: string[]) {
// //     this._mapX.set(rootId, new Cell(partialSemigroupNumericRange(), known(exactly(rootPosition.x))))
// //     this._mapY.set(rootId, new Cell(partialSemigroupNumericRange(), known(exactly(rootPosition.y))))

// //     for (let nodeId of nodeIds) {
// //       if (nodeId === rootId) {
// //         continue
// //       }

// //       this._mapX.set(nodeId, new Cell(partialSemigroupNumericRange(), unknown()))
// //       this._mapY.set(nodeId, new Cell(partialSemigroupNumericRange(), unknown()))
// //       // this._mapX.set(nodeId, new Cell(partialSemigroupNumericRange(), known(between(0, MAX_WIDTH))))
// //       // this._mapY.set(nodeId, new Cell(partialSemigroupNumericRange(), known(between(0, MAX_HEIGHT))))
// //     }
// //   }

// //   public getX(nodeId: string): Cell<NumericRange> {
// //     return this._mapX.get(nodeId)!
// //   }

// //   public getY(nodeId: string): Cell<NumericRange> {
// //     return this._mapY.get(nodeId)!
// //   }

// //   public setXSpacingConstraint(nodeId: string, otherX: Cell<NumericRange>, spacing: Cell<NumericRange>): void {
// //     addRangePropagator(otherX, spacing, this.getX(nodeId))
// //   }

// //   public setYSpacingConstraint(nodeId: string, otherY: Cell<NumericRange>, spacing: Cell<NumericRange>): void {
// //     addRangePropagator(otherY, spacing, this.getY(nodeId))
// //   }
// // }

// // // This gives the horizontal spacing relative to the leftmost child
// // export class MidpointConstraint implements PropagatorConstraint {
// //   private readonly _parentId: string
// //   private readonly _midpointCell: Cell<NumericRange>
// //   private readonly _negativeMidpointCell: Cell<NumericRange>
// //   private readonly _childRelationCells: Cell<NumericRange>[] = []

// //   // Precondition: The order of the childRelationCells must be the same as the order of the children in the tree, going from left to right
// //   constructor(parentId: string, childRelationCells: Cell<NumericRange>[]) {
// //     // this._midpointCell = new Cell(partialSemigroupNumericRange(), known(between(0, MAX_WIDTH)))
// //     this._midpointCell = new Cell(partialSemigroupNumericRange(), unknown())
// //     this._negativeMidpointCell = new Cell(partialSemigroupNumericRange(), unknown())
// //     this._childRelationCells = childRelationCells
// //     this._parentId = parentId

// //     negateNumericRangePropagator(this._midpointCell, this._negativeMidpointCell)

// //     this.makePropagator()
// //   }

// //   get midpointCell(): Cell<NumericRange> {
// //     return this._midpointCell
// //   }

// //   get childRelationCells(): Cell<NumericRange>[] {
// //     return this._childRelationCells
// //   }

// //   public relateToAbsolutePositions(absolutePositionMap: AbsolutePositionMap): void {
// //     let leftmostChild = this._childRelationCells[0]

// //     if (!leftmostChild) {
// //       return
// //     }

// //     let rightmostChild = this._childRelationCells[this._childRelationCells.length - 1]!

// //     if (this._childRelationCells.length === 1) {
// //       return
// //     }

// //     // We're equidistant from the leftmost and rightmost child
// //     absolutePositionMap.setXSpacingConstraint(this._parentId, leftmostChild, this._midpointCell)
// //     absolutePositionMap.setXSpacingConstraint(this._parentId, rightmostChild, this._negativeMidpointCell)
// //   }

// //   makePropagator(): void {
// //     const sumCell: Cell<NumericRange> = new Cell(partialSemigroupNumericRange(), unknown())

// //     addRangeListPropagator(this._childRelationCells, sumCell)
// //     divNumericRangeNumberPropagator(sumCell, 2, this._midpointCell)
// //   }

// //   public readKnownOrError(msg: string): NumericRange {
// //     return this._midpointCell.readKnownOrError(msg)
// //   }
// // }

// // // TODO:
// // // export class TransitiveConstraint implements PropagatorConstraint {
// // // }

// // export class NodePairRelationConstraint {
// //   private readonly _nodeA: IndexedNode;
// //   private readonly _nodeB: IndexedNode;
// //   private readonly _constraint: PropagatorConstraint;
// //   private static readonly _zeroCell: Cell<NumericRange> = new Cell(partialSemigroupNumericRange(), known(exactly(0)))

// //   constructor(nodeA: IndexedNode, nodeB: IndexedNode) {
// //     this._nodeA = nodeA;
// //     this._nodeB = nodeB;

// //     let parentChild = this.getParentChild()

// //     if (parentChild) {
// //       let [parent, child] = parentChild

// //       this._constraint = new ParentChildRelationConstraint(parent.nodeId!, child.nodeId!)
// //     } else {
// //       this._constraint = new SiblingRelationConstraint(this._nodeA.nodeId!, this._nodeB.nodeId!)
// //     }
// //   }

// //   public getXSpacingConstraint(): Cell<NumericRange> {
// //     if (this.ancestorDescendant()) {
// //       return NodePairRelationConstraint._zeroCell
// //     } else {
// //       return this._constraint.getCell()
// //     }
// //   }

// //   public getYSpacingConstraint(): Cell<NumericRange> {
// //     if (this.ancestorDescendant()) {
// //       return this._constraint.getCell()
// //     } else {
// //       return NodePairRelationConstraint._zeroCell
// //     }
// //   }

// //   private getParentChild(): [IndexedNode, IndexedNode] | null {
// //     if (this.ancestorDescendant()) {
// //       return this._nodeA.level < this._nodeB.level ? [this._nodeA, this._nodeB] : [this._nodeB, this._nodeA]
// //     } else {
// //       return null
// //     }
// //   }

// //   private ancestorDescendant(): boolean {
// //     return this._nodeA.level !== this._nodeB.level;
// //   }
// // }

// // export class ParentChildRelationConstraint implements PropagatorConstraint {
// //   private readonly _parentId: string
// //   private readonly _childId: string
// //   private readonly _cellY: Cell<NumericRange>

// //   constructor(parentId: string, childId: string) {
// //     this._parentId = parentId
// //     this._childId = childId
// //     this._cellY = new Cell(partialSemigroupNumericRange(), unknown())
// //   }

// //   public getCell(): Cell<NumericRange> {
// //     return this._cellY
// //   }

// //   public relateToAbsolutePositions(absolutePositionMap: AbsolutePositionMap): void {
// //   }

// //   public readKnownOrError(msg: string): NumericRange {
// //     return this._cellY.readKnownOrError(msg)
// //   }
// // }

// // export class SiblingRelationConstraint implements PropagatorConstraint {
// //   private readonly _parentId: string
// //   private readonly _siblingId: string
// //   private readonly _cellX: Cell<NumericRange>

// //   constructor(parentId: string, siblingId: string) {
// //     this._parentId = parentId
// //     this._siblingId = siblingId
// //     this._cellX = new Cell(partialSemigroupNumericRange(), unknown())
// //   }

// //   public getCell(): Cell<NumericRange> {
// //     return this._cellX
// //   }

// //   public relateToAbsolutePositions(absolutePositionMap: AbsolutePositionMap): void {
// //   }

// //   public readKnownOrError(msg: string): NumericRange {
// //     return this._cellX.readKnownOrError(msg)
// //   }
// // }


// // // export class NodeRelationConstraint implements PropagatorConstraint {
// // //   private readonly _nodeA: IndexedNode;
// // //   private readonly _nodeB: IndexedNode;
// // //   private readonly _cell: Cell<NumericRange>
// // //   private readonly _negativeCell: Cell<NumericRange>

// // //   constructor(nodeA: IndexedNode, nodeB: IndexedNode, maxValue: number) {
// // //     this._nodeA = nodeA;
// // //     this._nodeB = nodeB;
// // //     // this._cell = new Cell(partialSemigroupNumericRange(), known(between(0, maxValue)));
// // //     this._cell = new Cell(partialSemigroupNumericRange(), unknown());

// // //     this._negativeCell = new Cell(partialSemigroupNumericRange(), unknown())

// // //     negateNumericRangePropagator(this._cell, this._negativeCell)

// // //     this.initialize()
// // //   }

// // //   initialize(): void {
// // //     if (this.ancestorDescendant()) {
// // //       //
// // //       // Gives the vertical spacing relative to the parent

// // //       let yAmount = 0

// // //       if (this._nodeA.level < this._nodeB.level) {
// // //         yAmount = VERTICAL_PADDING
// // //       } else {
// // //         yAmount = -VERTICAL_PADDING
// // //       }

// // //       this._cell.write(known(atLeast(yAmount)))
// // //     } else {
// // //       // Siblings or cousins case
// // //       // Gives the horizontal spacing relative to its sibling/cousin

// // //       let xAmount = 0

// // //       if (this._nodeA.breadthIndex < this._nodeB.breadthIndex) {
// // //         xAmount = HORIZONTAL_PADDING
// // //       } else {
// // //         xAmount = -HORIZONTAL_PADDING
// // //       }

// // //       this._cell.write(known(atLeast(xAmount)))
// // //     }
// // //   }

// // //   isHorizontal(): boolean {
// // //     return !this.ancestorDescendant()
// // //   }

// // //   public relateToAbsolutePositions(absolutePositionMap: AbsolutePositionMap): void {
// // //     if (this.isHorizontal()) {
// // //       // Determine which node should be to the left based on breadth index
// // //       // if (this._nodeA.breadthIndex < this._nodeB.breadthIndex) {
// // //         // nodeA is to the left of nodeB
// // //         absolutePositionMap.setXSpacingConstraint(this._nodeA.nodeId!, 
// // //                                                 absolutePositionMap.getX(this._nodeB.nodeId!), 
// // //                                                 this._cell)
// // //       // } else {
// // //         // nodeB is to the left of nodeA
// // //         absolutePositionMap.setXSpacingConstraint(this._nodeB.nodeId!,
// // //                                                 absolutePositionMap.getX(this._nodeA.nodeId!),
// // //                                                 this._negativeCell)
// // //       // }
// // //     } else {
// // //       // For vertical relationships, use level to determine which is above
// // //       // if (this._nodeA.level < this._nodeB.level) {
// // //         // nodeA is above nodeB
// // //         absolutePositionMap.setYSpacingConstraint(this._nodeA.nodeId!,
// // //                                                 absolutePositionMap.getY(this._nodeB.nodeId!),
// // //                                                 this._cell)
// // //       // } else {
// // //         // nodeB is above nodeA
// // //         absolutePositionMap.setYSpacingConstraint(this._nodeB.nodeId!,
// // //                                                 absolutePositionMap.getY(this._nodeA.nodeId!),
// // //                                                 this._negativeCell)
// // //       // }
// // //     }
// // //   }

// // //   get cell(): Cell<NumericRange> {
// // //     return this._cell;
// // //   }

// // //   getParent(): IndexedNode {
// // //     return this._nodeA.level < this._nodeB.level ? this._nodeA : this._nodeB;
// // //   }

// // //   getChild(): IndexedNode {
// // //     return this._nodeA.level > this._nodeB.level ? this._nodeA : this._nodeB;
// // //   }

// // //   public ancestorDescendant(): boolean {
// // //     return this._nodeA.level !== this._nodeB.level;
// // //   }

// // //   public siblingOrCousin(): boolean {
// // //     return this._nodeA.level === this._nodeB.level && this._nodeA.breadthIndex !== this._nodeB.breadthIndex;
// // //   }

// // //   public hasNodeId(nodeId: string): boolean {
// // //     return this._nodeA.nodeId === nodeId || this._nodeB.nodeId === nodeId;
// // //   }

// // //   public getOtherNodeId(nodeId: string): string {
// // //     if (this._nodeA.nodeId === nodeId) {
// // //       return this._nodeB.nodeId;
// // //     } else if (this._nodeB.nodeId === nodeId) {
// // //       return this._nodeA.nodeId;
// // //     } else {
// // //       throw new Error('Node id not found in constraint: ' + nodeId)
// // //     }
// // //   }

// // //   public readKnownOrError(msg: string): NumericRange {
// // //     return this._cell.readKnownOrError(msg)
// // //   }

// // //   get edgeKey(): string {
// // //     return makeEdgeKey(this._nodeA.nodeId!, this._nodeB.nodeId!);
// // //   }
// // // }
