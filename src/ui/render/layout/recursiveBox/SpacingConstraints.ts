import { XYPosition } from "@xyflow/react"
import { IndexedNode, makeEdgeKey } from "../NodeLevels"
import { addNumericRange, atLeast, between, divNumericRangeNumber, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange"
import { Cell, known, naryPropagator } from "../../../../constraint/propagator/Propagator"

export const MAX_WIDTH: number = 800;
export const MAX_HEIGHT: number = 500;
export const VERTICAL_PADDING = 50;
export const HORIZONTAL_PADDING = 70;

export type ConstraintMap = Map<string, PropagatorConstraint[]>

export function lookupHorizontalSpacing(nodeId1: string, nodeId2: string, constraintMap: ConstraintMap): NumericRange {
  let nodeB = nodeId2

  let constraints = constraintMap.get(nodeId1)

  if (!constraints) {
    nodeB = nodeId1
    constraints = constraintMap.get(nodeId2)!
  }

  for (let i = 0; i < constraints.length; i++) {
    let constraint = constraints[i]!

    if (constraint instanceof NodeRelationConstraint && constraint.hasNodeId(nodeB)) {
      return constraint.readKnownOrError('lookupHorizontalSpacing')
    }
  }

  throw new Error(`No horizontal spacing found for ${nodeId1} and ${nodeId2} in ${JSON.stringify(constraints)}`)
}

export function lookupVerticalSpacing(nodeId1: string, nodeId2: string, constraintMap: ConstraintMap): NumericRange {
  let nodeB = nodeId2
  
  let constraints = constraintMap.get(nodeId1)
  if (!constraints) {
    nodeB = nodeId1
    constraints = constraintMap.get(nodeId2)!
  }

  for (let i = 0; i < constraints.length; i++) {
    let constraint = constraints[i]!

    if (constraint instanceof NodeRelationConstraint && constraint.hasNodeId(nodeB)) {
      if (constraint.ancestorDescendant()) {
        return constraint.readKnownOrError('lookupVerticalSpacing')
      }
    }
  }

  throw new Error(`No vertical spacing found for ${nodeId1} and ${nodeId2} in ${JSON.stringify(constraints)}`)
}

export interface PropagatorConstraint {
  readKnownOrError(msg: string): NumericRange;
}

// This gives the horizontal spacing relative to the leftmost child
export class MidpointConstraint implements PropagatorConstraint {
  private readonly _parent: IndexedNode
  private readonly _midpointCell: Cell<NumericRange>
  private readonly _childRelationCells: Cell<NumericRange>[] = []

  constructor(parent: IndexedNode, childRelationCells: Cell<NumericRange>[]) {
    this._midpointCell = new Cell(partialSemigroupNumericRange(), known(between(0, MAX_WIDTH)))
    this._childRelationCells = childRelationCells
    this._parent = parent

    this.makePropagator()
  }

  get parent(): IndexedNode {
    return this._parent
  }

  get midpointCell(): Cell<NumericRange> {
    return this._midpointCell
  }

  get childRelationCells(): Cell<NumericRange>[] {
    return this._childRelationCells
  }

  makePropagator(): void {
    naryPropagator(this._childRelationCells, this._midpointCell,
      (childRelations: NumericRange[]): NumericRange => {
        let result = childRelations[0]!

        for (let i = 0; i < childRelations.length; i++) {
          result = addNumericRange(result, childRelations[i]!)
        }

        return divNumericRangeNumber(result, 2)
      }
    )

    // TODO: I'm missing some part here
    // The midpoint cell should affect the parent-child relation cell
  }

  public readKnownOrError(msg: string): NumericRange {
    return this._midpointCell.readKnownOrError(msg)
  }
}

export class NodeRelationConstraint implements PropagatorConstraint {
  private readonly _nodeA: IndexedNode;
  private readonly _nodeB: IndexedNode;
  private readonly _cell: Cell<NumericRange>

  constructor(nodeA: IndexedNode, nodeB: IndexedNode, maxValue: number) {
    this._nodeA = nodeA;
    this._nodeB = nodeB;
    this._cell = new Cell(partialSemigroupNumericRange(), known(between(0, maxValue)));

    this.initialize()
  }

  initialize(): void {
    if (this.ancestorDescendant()) {
      //
      // Gives the vertical spacing relative to the parent

      this._cell.write(known(atLeast(MAX_HEIGHT + VERTICAL_PADDING)))
    } else {
      // Siblings or cousins case
      // Gives the horizontal spacing relative to its sibling/cousin

      this._cell.write(known(atLeast(MAX_WIDTH + HORIZONTAL_PADDING)))
    }
  }

  get cell(): Cell<NumericRange> {
    return this._cell;
  }

  getParent(): IndexedNode {
    return this._nodeA.level < this._nodeB.level ? this._nodeA : this._nodeB;
  }

  getChild(): IndexedNode {
    return this._nodeA.level > this._nodeB.level ? this._nodeA : this._nodeB;
  }

  public ancestorDescendant(): boolean {
    return this._nodeA.level !== this._nodeB.level;
  }

  public siblingOrCousin(): boolean {
    return this._nodeA.level === this._nodeB.level && this._nodeA.breadthIndex !== this._nodeB.breadthIndex;
  }

  public hasNodeId(nodeId: string): boolean {
    return this._nodeA.nodeId === nodeId || this._nodeB.nodeId === nodeId;
  }

  public readKnownOrError(msg: string): NumericRange {
    return this._cell.readKnownOrError(msg)
  }

  get edgeKey(): string {
    return makeEdgeKey(this._nodeA.nodeId!, this._nodeB.nodeId!);
  }
}
