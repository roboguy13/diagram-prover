import { XYPosition } from "@xyflow/react"
import { computeIndexedNodes, IndexedNode, indexedNodePairs, makeEdgeKey } from "../NodeLevels"
import { addNumericRange, atLeast, between, divNumericRangeNumber, exactly, NumericRange, partialSemigroupNumericRange } from "../../../../constraint/propagator/NumericRange"
import { binaryPropagator, Cell, known, naryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { build } from "esbuild";

export const MAX_WIDTH: number = 800;
export const MAX_HEIGHT: number = 500;
export const VERTICAL_PADDING = 50;
export const HORIZONTAL_PADDING = 70;

export type ConstraintMap = Map<string, PropagatorConstraint[]>

export class ConstraintCalculator {
  private readonly _absolutePositionMap: AbsolutePositionMap
  private readonly _nodeRelationConstraints: NodeRelationConstraint[]
  private readonly _midpointConstraints: MidpointConstraint[]

  constructor(n: SemanticNode<void>) {
    this._absolutePositionMap = new AbsolutePositionMap({ x: 0, y: 0 }, n.id, getNodeIds(n))
    this._nodeRelationConstraints = []
    this._midpointConstraints = []

    this.buildNodeRelationConstraints(n)
    this.buildMidpointConstraints(n)
  }

  get absolutePositionMap(): AbsolutePositionMap {
    return this._absolutePositionMap
  }

  buildNodeRelationConstraints(n: SemanticNode<void>): void {
    let [_a, _b, indexedNodes] = computeIndexedNodes(n)
    let nodePairs = indexedNodePairs(indexedNodes)

    for (let [nodeA, nodeB] of nodePairs) {
      let constraint = new NodeRelationConstraint(this._absolutePositionMap, nodeA, nodeB, MAX_WIDTH)
      this._nodeRelationConstraints.push(constraint)
    }
  }

  buildMidpointConstraints(n: SemanticNode<void>): void {
    let childRelationCells: Cell<NumericRange>[] = []

    for (let child of n.children) {
      let childId = child.id
      let constraint  = this._nodeRelationConstraints.find((c) => c.hasNodeId(childId))!
      let childCell = constraint.cell
      let otherId = constraint.getOtherNodeId(childId)

      if (n.children.some((c) => c.id === otherId)) {
        childRelationCells.push(childCell)
      }
    }

    this._midpointConstraints.push(new MidpointConstraint(n.id, this._absolutePositionMap, childRelationCells))
  }
}

export interface PropagatorConstraint {
  readKnownOrError(msg: string): NumericRange;
}

export class AbsolutePositionMap {
  private readonly _mapX: Map<string, Cell<NumericRange>> = new Map()
  private readonly _mapY: Map<string, Cell<NumericRange>> = new Map()

  constructor(rootPosition: XYPosition, rootId: string, nodeIds: string[]) {
    this._mapX.set(rootId, new Cell(partialSemigroupNumericRange(), known(exactly(rootPosition.x))))
    this._mapY.set(rootId, new Cell(partialSemigroupNumericRange(), known(exactly(rootPosition.y))))

    for (let nodeId of nodeIds) {
      if (nodeId === rootId) {
        continue
      }

      // TODO: Is it okay to set these to unknown?
      this._mapX.set(nodeId, new Cell(partialSemigroupNumericRange(), unknown()))
      this._mapY.set(nodeId, new Cell(partialSemigroupNumericRange(), unknown()))
    }
  }

  public getX(nodeId: string): Cell<NumericRange> {
    return this._mapX.get(nodeId)!
  }

  public getY(nodeId: string): Cell<NumericRange> {
    return this._mapY.get(nodeId)!
  }

  public setXSpacingConstraint(nodeId: string, otherX: Cell<NumericRange>, spacing: Cell<NumericRange>): void {
    binaryPropagator(otherX, spacing, this.getX(nodeId),
      (x1: NumericRange, x2: NumericRange): NumericRange => {
        return addNumericRange(x1, x2)
      }
    )
  }

  public setYSpacingConstraint(nodeId: string, otherY: Cell<NumericRange>, spacing: Cell<NumericRange>): void {
    binaryPropagator(otherY, spacing, this.getY(nodeId),
      (y1: NumericRange, y2: NumericRange): NumericRange => {
        return addNumericRange(y1, y2)
      }
    )
  }
}

// This gives the horizontal spacing relative to the leftmost child
export class MidpointConstraint implements PropagatorConstraint {
  private readonly _parentId: string
  private readonly _midpointCell: Cell<NumericRange>
  private readonly _childRelationCells: Cell<NumericRange>[] = []
  private readonly _absolutePositionMap: AbsolutePositionMap

  // Precondition: The order of the childRelationCells must be the same as the order of the children in the tree, going from left to right
  constructor(parentId: string, absolutePositionMap: AbsolutePositionMap, childRelationCells: Cell<NumericRange>[]) {
    this._midpointCell = new Cell(partialSemigroupNumericRange(), known(between(0, MAX_WIDTH)))
    this._childRelationCells = childRelationCells
    this._parentId = parentId
    this._absolutePositionMap = absolutePositionMap

    this.makePropagator()
    this.relateToAbsolutePositions()
  }

  get midpointCell(): Cell<NumericRange> {
    return this._midpointCell
  }

  get childRelationCells(): Cell<NumericRange>[] {
    return this._childRelationCells
  }

  relateToAbsolutePositions(): void {
    let leftmostChild = this._childRelationCells[0]

    if (!leftmostChild) {
      return
    }

    let rightmostChild = this._childRelationCells[this._childRelationCells.length - 1]!

    this._absolutePositionMap.setXSpacingConstraint(this._parentId, leftmostChild, this._midpointCell)
    this._absolutePositionMap.setXSpacingConstraint(this._parentId, rightmostChild, this._midpointCell)
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

    // TODO: I think I'm missing some part here: The midpoint cell should affect the parent-child relation cell
  }

  public readKnownOrError(msg: string): NumericRange {
    return this._midpointCell.readKnownOrError(msg)
  }
}

export class NodeRelationConstraint implements PropagatorConstraint {
  private readonly _nodeA: IndexedNode;
  private readonly _nodeB: IndexedNode;
  private readonly _cell: Cell<NumericRange>
  private readonly _absolutePositionMap: AbsolutePositionMap

  constructor(absolutePositionMap: AbsolutePositionMap, nodeA: IndexedNode, nodeB: IndexedNode, maxValue: number) {
    this._nodeA = nodeA;
    this._nodeB = nodeB;
    this._cell = new Cell(partialSemigroupNumericRange(), known(between(0, maxValue)));
    this._absolutePositionMap = absolutePositionMap

    this.initialize()
    this.relateToAbsolutePositions()
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

  relateToAbsolutePositions(): void {
    this._absolutePositionMap.setXSpacingConstraint(this._nodeA.nodeId!, this._absolutePositionMap.getX(this._nodeB.nodeId!), this._cell)
    this._absolutePositionMap.setYSpacingConstraint(this._nodeA.nodeId!, this._absolutePositionMap.getY(this._nodeB.nodeId!), this._cell)
    this._absolutePositionMap.setXSpacingConstraint(this._nodeB.nodeId!, this._absolutePositionMap.getX(this._nodeA.nodeId!), this._cell)
    this._absolutePositionMap.setYSpacingConstraint(this._nodeB.nodeId!, this._absolutePositionMap.getY(this._nodeA.nodeId!), this._cell)
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

  public getOtherNodeId(nodeId: string): string {
    if (this._nodeA.nodeId === nodeId) {
      return this._nodeB.nodeId;
    } else if (this._nodeB.nodeId === nodeId) {
      return this._nodeA.nodeId;
    } else {
      throw new Error('Node id not found in constraint: ' + nodeId)
    }
  }

  public readKnownOrError(msg: string): NumericRange {
    return this._cell.readKnownOrError(msg)
  }

  get edgeKey(): string {
    return makeEdgeKey(this._nodeA.nodeId!, this._nodeB.nodeId!);
  }
}
