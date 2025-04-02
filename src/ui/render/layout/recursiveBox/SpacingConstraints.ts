import { XYPosition } from "@xyflow/react"
import { addRangePropagator, between, divNumericRangeNumberPropagator, getMax, getMidpoint, getMin, lessThanEqualPropagator, NumericRange, printNumericRange, selectMin, subNumericRange, subtractRangePropagator } from "../../../../constraint/propagator/NumericRange"
import { CellRef, ConflictHandler, ContentIsNotKnownError, equalPropagator, mapContent, printContent, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
import { computeIndexedNodes, LevelMap } from "../NodeLevels";
import { isArrayLike } from "lodash";
import { node } from "webpack";
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { NodesAndEdges } from "../LayoutEngine";
import { Dimensions, getNodeDimensions } from "../../../NodeDimensions";
import { SiblingConstraint } from "./constraints/SiblingConstraint";
import { MidpointConstraint } from "./constraints/MidpointConstraint";
import { ParentChildConstraint } from "./constraints/ParentChildConstraint";
import { SpacingMap } from "./constraints/SpacingMap";
import { NestedNodeConstraint } from "./constraints/NestedNodeConstraint";
import { BoundingBox } from "./BoundingBox";
import { DimensionsMap } from "./Constraint";

const LOG_PROPAGATOR_STATS = true
const MINIMIZE = true

export const VERTICAL_PADDING = 100;
export const HORIZONTAL_PADDING = 100;

export type AbsolutePositionMap = Map<string, XYPosition>

export class ConstraintCalculator {
  private _spacingMap: SpacingMap
  private _absolutePositionMap: Map<string, XYPosition> = new Map()
  private readonly _rootId: string

  constructor(roots: SemanticNode<void>[], conflictHandlers: ConflictHandler<NumericRange>[], minimize: boolean = MINIMIZE) {
    const chosenRoot = roots[0]!

    this._spacingMap = new SpacingMap(chosenRoot.id, conflictHandlers)
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
        // this.minimizeSpacings()
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
        let boundingBox = this._spacingMap.lookupIntrinsicBox(nodeId)

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
      let x = this._spacingMap.getAbsoluteX(nodeId)
      let y = this._spacingMap.getAbsoluteY(nodeId)

      this._absolutePositionMap.set(nodeId, { x, y })
    }
  }

  private generateCousinConstraints(levelMap: LevelMap): void {
    for (let [level, nodeIds] of levelMap) {
      for (let i = 0; i < nodeIds.length - 1; i++) {
        // TODO: Fix
        let siblingConstraint = new SiblingConstraint(nodeIds[i]!, nodeIds[i + 1]!)
        // siblingConstraint.apply(this._spacingMap)
      }
    }
  }

  private generateConstraints(n: SemanticNode<void>): void {
    // Set up the initial bounding box dimensions
    this._spacingMap.refineIntrinsicBoxDimensions(n, getNodeDimensions(n))

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
