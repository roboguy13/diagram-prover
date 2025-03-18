import { XYPosition } from "@xyflow/react"
import { addRangeListPropagator, addRangePropagator, atLeast, atMost, between, divNumericRangeNumberPropagator, exactly, getMin, makeZeroCell, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange"
import { Cell, equalPropagator, known, unknown } from "../../../../constraint/propagator/Propagator"
import { SemanticNode } from "../../../../ir/SemanticGraph";
import { flip, unary, update } from "lodash";

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
    this._constraintMap.logRootConstraints()
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

      let rootConstraint = new RootConstraint(child.id, this._rootId)

      this._constraintMap.addConstraint(siblingConstraint)
      this._constraintMap.addConstraint(rootConstraint)

      this._constraintMap.updateRootSpacingWith(child.id, prevChild.id)
      this._constraintMap.updateRootSpacingWith(prevChild.id, child.id)

      childSiblingConstraints.push(siblingConstraint)
    }

    if (children.length >= 1) {
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

        this._constraintMap.updateRootSpacing(child.id, nData)
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

    var _rootRootConstraint = new RootConstraint(rootNodeId, rootNodeId)
    this._rootConstraints.set(rootNodeId, _rootRootConstraint)
  }

  public logRootConstraints(): void {
    console.log("Root constraints:", [...this._rootConstraints.keys()]);

    for (let [nodeId, constraint] of this._rootConstraints.entries()) {
      console.log(`Node ${nodeId} has root constraint: ${JSON.stringify(constraint.spacings)}`)
    }
  }

  public updateRootSpacingWith(nodeId: string, otherNodeId: string): void {
    let otherRootConstraint = this._rootConstraints.get(otherNodeId)
    let otherSpacingToHere = this.getSpacing(nodeId, otherNodeId)

    console.log(`Updating root spacing for ${nodeId} using ${otherNodeId}:`, 
      otherRootConstraint ? "Has constraint" : "No constraint",
      otherSpacingToHere ? "Has spacing" : "No spacing")

    this.updateRootSpacing(nodeId, otherRootConstraint ? [otherRootConstraint, otherSpacingToHere!] : null)
  }

  public updateRootSpacing(nodeId: string, otherNodeData: [RootConstraint, Spacing] | null): void {
    if (this._rootConstraints.has(nodeId)) {
      this._rootConstraints.get(nodeId)!.updateRootSpacing(otherNodeData)
    } else {
      let rootConstraint = new RootConstraint(nodeId, this._rootNodeId)
      rootConstraint.updateRootSpacing(otherNodeData)
      this.addConstraint(rootConstraint)
    }
  }

  public addConstraint(constraint: SpacingConstraint): void {
    let nodeId = constraint.nodeId

    if (constraint instanceof RootConstraint) {
      if (this._rootConstraints.has(nodeId)) {
        throw new Error(`Duplicate root constraint for node ${nodeId}`)
      }

      this._rootConstraints.set(nodeId, constraint)
    } else {
      console.log(`Adding constraint for node ${nodeId}: ${JSON.stringify(constraint.spacings)}`)
      this.pushOtherConstraint(nodeId, constraint)

      if (constraint.flip) {
        let flippedConstraint = constraint.flip()

        console.log(`Adding flipped constraint for node ${nodeId}, ${flippedConstraint.nodeId}: ${JSON.stringify(flippedConstraint.spacings)}`)

        this.pushOtherConstraint(flippedConstraint.nodeId, flippedConstraint)
      }
    }
  }

  private pushOtherConstraint(nodeId: string, constraint: SpacingConstraint): void {
    if (!this._otherConstraints.has(nodeId)) {
      this._otherConstraints.set(nodeId, [constraint]);
      return;
    }
  
    // Try to merge with existing constraints
    const existingConstraints = this._otherConstraints.get(nodeId)!;
    let merged = false;
  
    // For each spacing in the new constraint
    for (const newSpacing of constraint.spacings) {
      // Try to find an existing constraint with the same otherNodeId
      for (const existingConstraint of existingConstraints) {
        for (const existingSpacing of existingConstraint.spacings) {
          if (existingSpacing.otherNodeId === newSpacing.otherNodeId) {
            // Found a matching constraint, merge X and Y spacings
            merged = true;
            
            // If both have X spacing, link them with a propagator
            if (existingSpacing.xSpacing && newSpacing.xSpacing) {
              console.log(`Merging X spacing between ${nodeId} and ${newSpacing.otherNodeId}`);
              equalPropagator(existingSpacing.xSpacing, newSpacing.xSpacing);
            } else if (!existingSpacing.xSpacing && newSpacing.xSpacing) {
              // Copy the new X spacing to the existing spacing
              existingSpacing.xSpacing = newSpacing.xSpacing;
            }
            
            // If both have Y spacing, link them with a propagator
            if (existingSpacing.ySpacing && newSpacing.ySpacing) {
              console.log(`Merging Y spacing between ${nodeId} and ${newSpacing.otherNodeId}`);
              equalPropagator(existingSpacing.ySpacing, newSpacing.ySpacing);
            } else if (!existingSpacing.ySpacing && newSpacing.ySpacing) {
              // Copy the new Y spacing to the existing spacing
              existingSpacing.ySpacing = newSpacing.ySpacing;
            }
          }
        }
      }
    }
  
    // If no merge happened, add the constraint as is
    if (!merged) {
      existingConstraints.push(constraint);
    }
  }

  // private pushOtherConstraint(nodeId: string, constraints: SpacingConstraint): void {
  //   if (this._otherConstraints.has(nodeId)) {
  //     // TODO: Merge constraints if they involve the same other node
  //     let merged = false
  //     let constraintSpacings = constraints.spacings
  //     let existingSpacings = this._otherConstraints.get(nodeId)!.flatMap(constraint => constraint.spacings)

  //     for (let existingConstraint of this._otherConstraints.get(nodeId)!) {
  //       for (let spacing of constraints.spacings) {
  //         // merged ||= mergeSpacings(existingConstraint.spacings[0]!, spacing)
  //         // merged ||= existingConstraint.spacings.some(existingSpacing => mergeSpacings(existingSpacing, spacing))
  //       }
  //     }

  //     if (!merged) {
  //       this._otherConstraints.get(nodeId)!.push(constraints)
  //     }
  //   } else {
  //     this._otherConstraints.set(nodeId, [constraints])
  //   }
  // }

  public getSpacing(nodeId: string, otherNodeId: string): Spacing | null {
    let xAmount = this.getXSpacing(nodeId, otherNodeId);
    let yAmount = this.getYSpacing(nodeId, otherNodeId);
    
    // If neither dimension exists, return null
    if (!xAmount && !yAmount) {
      return null;
    }
    
    // Create default cells for missing dimensions
    if (!xAmount) {
      xAmount = new Cell(partialSemigroupNumericRange(), unknown());
    }

    if (!yAmount) {
      yAmount = new Cell(partialSemigroupNumericRange(), unknown());
    }
    
    return { otherNodeId, xSpacing: xAmount, ySpacing: yAmount };
  }

  // public getSpacing(nodeId: string, otherNodeId: string): Spacing | null {
  //   let xAmount = this.getXSpacing(nodeId, otherNodeId)
  //   let yAmount = this.getYSpacing(nodeId, otherNodeId)

  //   return { otherNodeId, xSpacing: xAmount, ySpacing: yAmount }
  // }

  public getXSpacing(nodeId: string, otherNodeId: string): Cell<NumericRange> {
    if (nodeId === this._rootNodeId) {
      return this._rootConstraints.get(nodeId)!.spacings.find(spacing => spacing.otherNodeId === otherNodeId)!.xSpacing
    }

    return this._otherConstraints.get(nodeId)!.find(constraint => constraint.spacings.some(spacing => spacing.otherNodeId === otherNodeId))!.spacings.find(spacing => spacing.otherNodeId === otherNodeId)!.xSpacing
  }

  public getYSpacing(nodeId: string, otherNodeId: string): Cell<NumericRange> {
    if (nodeId === this._rootNodeId) {
      return this._rootConstraints.get(nodeId)!.spacings.find(spacing => spacing.otherNodeId === otherNodeId)!.ySpacing
    }

    return this._otherConstraints.get(nodeId)!.find(constraint => constraint.spacings.some(spacing => spacing.otherNodeId === otherNodeId))!.spacings.find(spacing => spacing.otherNodeId === otherNodeId)!.ySpacing
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
    xSpacing: Cell<NumericRange>,
    ySpacing: Cell<NumericRange>
  }

interface SpacingConstraint {
  get nodeId(): string
  get spacings(): Spacing[]
  flip?(): SpacingConstraint
}

function mergeSpacings(spacing1: Spacing, spacing2: Spacing): boolean {
  if (spacing1.otherNodeId !== spacing2.otherNodeId) {
    return false
  }

  equalPropagator(spacing1.xSpacing, spacing2.xSpacing)
  return true
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

    if (thisNodeId === rootNodeId) {
      this._xSpacing = new Cell(partialSemigroupNumericRange(), known(exactly(0)))
      this._ySpacing = new Cell(partialSemigroupNumericRange(), known(exactly(0)))
    } else {
      this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())
      this._ySpacing = new Cell(partialSemigroupNumericRange(), unknown())
    }

    this.initializeCells()
  }

  // In general, thisNode gets information about its horizontal spacing from the root in two ways, both of which should be accounted for:
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
  }

  public updateRootSpacing(otherNodeData: [RootConstraint, Spacing] | null): void {
    if (otherNodeData === null) {
      return
    }

    let [otherRootConstraint, otherSpacingToHere] = otherNodeData

    if (otherRootConstraint._xSpacing && otherSpacingToHere.xSpacing) {
      addRangePropagator(otherRootConstraint._xSpacing, otherSpacingToHere.xSpacing!, this._xSpacing)
    }

    if (otherRootConstraint._ySpacing && otherSpacingToHere.ySpacing) {
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
    if (this._childSiblingRelations.length === 0) {
      this._xSpacing.write(known(exactly(0)))
    } else {
      let sumCell = new Cell(partialSemigroupNumericRange(), unknown())

      addRangeListPropagator(this._childSiblingRelations.map((relation) => relation.spacings[0]!.xSpacing!), sumCell)
      divNumericRangeNumberPropagator(sumCell, 2, this._xSpacing)
    }
  }

  public get spacings(): Spacing[] {
    return [
      { otherNodeId: this._leftmostChildId, xSpacing: this._xSpacing, ySpacing: new Cell(partialSemigroupNumericRange(), unknown()) },
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
  private readonly _negativeYSpacing: Cell<NumericRange>

  constructor(thisNodeId: string, otherNodeId: string, ySpacing?: Cell<NumericRange>, negativeYSpacing?: Cell<NumericRange>) {
    this._thisNodeId = thisNodeId
    this._otherNodeId = otherNodeId

    if (ySpacing) {
      this._ySpacing = ySpacing
    } else {
      this._ySpacing = new Cell(partialSemigroupNumericRange(), unknown())
    }

    if (negativeYSpacing) {
      this._negativeYSpacing = negativeYSpacing
    } else {
      this._negativeYSpacing = new Cell(partialSemigroupNumericRange(), unknown())
    }
    
    if (!ySpacing && !negativeYSpacing) {
      this.initializeCell()
    }
  }

  private initializeCell(): void {
    this._ySpacing.write(known(atLeast(VERTICAL_PADDING)))
    negateNumericRangePropagator(this._ySpacing, this._negativeYSpacing)
  }

  public get spacings(): Spacing[] {
    return [{ otherNodeId: this._otherNodeId, xSpacing: new Cell(partialSemigroupNumericRange(), unknown()), ySpacing: this._ySpacing }]
  }

  public flip(): ParentChildConstraint {
    return new ParentChildConstraint(this._otherNodeId, this._thisNodeId, this._negativeYSpacing, this._ySpacing)
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
  private readonly _negativeXSpacing: Cell<NumericRange>

  constructor(thisNodeId: string, otherNodeId: string, xSpacing?: Cell<NumericRange>, negativeXSpacing?: Cell<NumericRange>) {
    this._thisNodeId = thisNodeId
    this._otherNodeId = otherNodeId

    if (xSpacing) {
      this._xSpacing = xSpacing
    } else {
      this._xSpacing = new Cell(partialSemigroupNumericRange(), unknown())
    }

    if (negativeXSpacing) {
      this._negativeXSpacing = negativeXSpacing
    } else {
      this._negativeXSpacing = new Cell(partialSemigroupNumericRange(), unknown())
    }

    if (!xSpacing && !negativeXSpacing) {
      this.initializeCell()
    }
  }

  private initializeCell(): void {
    negateNumericRangePropagator(this._xSpacing, this._negativeXSpacing)

    this._xSpacing.write(known(atLeast(HORIZONTAL_PADDING)))
  }

  public get spacings(): Spacing[] {
    return [{ otherNodeId: this._otherNodeId, xSpacing: this._xSpacing, ySpacing: new Cell(partialSemigroupNumericRange(), unknown()) }]
  }

  public flip(): SiblingConstraint {
    return new SiblingConstraint(this._otherNodeId, this._thisNodeId, this._negativeXSpacing, this._xSpacing)
  }

  public get nodeId(): string {
    return this._thisNodeId
  }
}
