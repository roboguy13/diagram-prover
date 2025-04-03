import { XYPosition } from "@xyflow/react";
import { NumericRange, printNumericRange, getMin, exactly, between } from "../../../../constraint/propagator/NumericRange"; // Added known, exactly, between
import { CellRef, ConflictHandler, ContentIsNotKnownError, known, printContent } from "../../../../constraint/propagator/Propagator"; // Removed unused imports
import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
// Removed computeIndexedNodes, LevelMap imports
import { Minimizer } from "../../../../constraint/propagator/Minimize";
import { NodesAndEdges } from "../LayoutEngine";
import { Dimensions, getNodeDimensions } from "../../../NodeDimensions";
// --- Use refactored constraint names ---
import { NestedNodeConstraint } from "./constraints/NestedNodeConstraint"; // Assuming this exists and is compatible
import { BoundingBox } from "./BoundingBox";
import { DimensionsMap } from "./Constraint";
import { LayoutData } from "./constraints/LayoutData";
import { VerticalPlacementConstraint } from "./constraints/VerticalPlacementConstraint";
import { HorizontalSiblingConstraint } from "./constraints/HorizontalSiblingConstraint";
import { CenterChildrenConstraint } from "./constraints/CenterChildrenConstraint";
import { SubtreeDimensionConstraint } from "./constraints/SubtreeDimensionConstraint";

const LOG_PROPAGATOR_STATS = true;
const MINIMIZE = true; // Control minimization

// Configuration for standard spacing (can be passed in)
const LAYOUT_CONFIG = {
  // Use exact values for predictable spacing, or ranges if you want minimization to adjust them
  defaultVSpacing: known(exactly(20)),
  defaultHSpacing: known(exactly(15)),
  // Example with ranges for minimization:
  // defaultVSpacing: known(between(20, 40)),
  // defaultHSpacing: known(between(15, 30)),
};


export type AbsolutePositionMap = Map<string, XYPosition>;

export class ConstraintCalculator {
  private _layoutData: LayoutData; // Use new name
  private _absolutePositionMap: Map<string, XYPosition> = new Map();
  private readonly _rootId: string;

  constructor(roots: SemanticNode<void>[], conflictHandlers: ConflictHandler<NumericRange>[], minimize: boolean = MINIMIZE) {
    // Basic single-root assumption for tidy trees; adapt if multi-root layout needed
    if (roots.length === 0) throw new Error("ConstraintCalculator requires at least one root node.");
    if (roots.length > 1) console.warn("ConstraintCalculator proceeding with the first root node for tidy tree layout.");

    const chosenRoot = roots[0]!;
    this._rootId = chosenRoot.id;

    // Initialize LayoutData with configuration
    this._layoutData = new LayoutData(chosenRoot.id, conflictHandlers);

    console.log('Generating constraints starting from root:', this._rootId);
    try {
      // Start the recursive constraint generation process
      this.generateConstraintsRecursive(chosenRoot);
    } catch (e) {
      console.error('Error during constraint generation:', e);
      // Decide if partial results are usable or if error is fatal
    }
    console.log('Constraint generation complete.');

    // --- Remove generateCousinConstraints section ---

    // --- Re-evaluated Minimization ---
    if (minimize) {
      console.log('Applying minimization...');
      try {
        // this.minimizeLayoutBounds();
      } catch (e) {
        if (e instanceof ContentIsNotKnownError) {
          console.warn('Minimization skipped: Network contains unknown values needed for minimization.');
        } else {
          console.error('Error during minimization:', e);
          // Potentially rethrow or handle
        }
      }
    }
    // --- ---

    // Logging and final map generation
    if (LOG_PROPAGATOR_STATS) {
      this.logStatsAndBoxes(chosenRoot);
    }

    try {
      this.generateAbsolutePositionMap(getNodeIds(chosenRoot));
    } catch (e) {
      if (e instanceof ContentIsNotKnownError) {
        console.error('Failed to generate absolute position map: Network has unknown content.', e);
      } else {
        console.error('Error generating absolute position map:', e);
        // Potentially rethrow
      }
    }
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    return await this._layoutData.renderDebugInfo();
  }

  public get absolutePositionMap(): AbsolutePositionMap {
    return this._absolutePositionMap;
  }

  public get dimensionsMap(): DimensionsMap {
    return this._layoutData.dimensionsMap;
  }

  private generateAbsolutePositionMap(nodeIds: string[]): void {
    console.log('Generating absolute positions...');
    for (let nodeId of nodeIds) {
      try {
        // getAbsoluteX/Y read from the intrinsic box's final minX/minY
        let x = this._layoutData.getAbsoluteX(nodeId);
        let y = this._layoutData.getAbsoluteY(nodeId);
        this._absolutePositionMap.set(nodeId, { x, y });
      } catch (e) {
        if (e instanceof ContentIsNotKnownError) {
          console.warn(`Could not determine absolute position for node ${nodeId}: ${e.message}`);
          // Set a default or skip?
          // this._absolutePositionMap.set(nodeId, { x: 0, y: 0 });
        } else {
          throw e; // Rethrow unexpected errors
        }
      }
    }
    console.log('Finished generating absolute positions.');
  }

  // --- generateCousinConstraints REMOVED ---

  /**
   * Recursively traverses the semantic node tree and applies layout constraints.
   */
  private generateConstraintsRecursive(n: SemanticNode<void>, parentId: string | null = null): void {
    // 1. Define the node's intrinsic size based on its content/style
    this._layoutData.refineIntrinsicBoxDimensions(n, getNodeDimensions(n));

    // 2. Apply Vertical Placement (Parent-to-Child Subtree)
    if (parentId) {
      const vConstraint = new VerticalPlacementConstraint(parentId, n.id);
      vConstraint.apply(this._layoutData);
    }

    const children = n.children ?? []; // Handle case where children might be null/undefined
    const childIds = children.map(child => child.id);

    // 3. Apply Horizontal Sibling Constraints (Between adjacent child subtrees)
    for (let i = 0; i < childIds.length - 1; i++) {
      const leftSiblingId = childIds[i]!;
      const rightSiblingId = childIds[i + 1]!;
      const hConstraint = new HorizontalSiblingConstraint(leftSiblingId, rightSiblingId);
      hConstraint.apply(this._layoutData);
    }

    // 4. Apply Centering Constraint (Align children block center with parent center)
    if (childIds.length > 0) {
      const centerConstraint = new CenterChildrenConstraint(n.id, childIds);
      centerConstraint.apply(this._layoutData);
    }

    // 5. Handle Nested Subgraphs (Apply constraints & recurse)
    const subgraphNodes = n.subgraph ?? [];
    for (const subgraphNode of subgraphNodes) {
      // Apply constraint positioning the subgraphNode relative to parent 'n'
      // NestedNodeConstraint needs to be compatible with the two-box model.
      // e.g., subgraphNode.subtree_bbox must be within n.intrinsic_bbox (+ padding?)
      const nestedConstraint = new NestedNodeConstraint(n.id, subgraphNode.id);
      nestedConstraint.apply(this._layoutData);

      // Recurse into the subgraph structure
      this.generateConstraintsRecursive(subgraphNode); // Treat subgraph root as having no parent *within this context* for vertical placement
    }

    // 6. Recurse for standard children
    for (const child of children) {
      this.generateConstraintsRecursive(child, n.id); // Pass current node 'n' as parent
    }

    const subtreeConstraint = new SubtreeDimensionConstraint(n.id, n.children.map(child => child.id));
    subtreeConstraint.apply(this._layoutData);
  }

  /** Applies minimization logic based on configured goals. */
  private minimizeLayoutBounds(): void {
    const rootSubtreeBox = this._layoutData.lookupSubtreeExtentBox(this._rootId);

    // Example: Minimize the width of the root's subtree extent.
    // This works best if horizontal spacing has a flexible range.
    console.log("Attempting to minimize root subtree width...");
    const minimizerWidth = new Minimizer(this._layoutData.net, [rootSubtreeBox.width]);
    minimizerWidth.minimize();
    console.log("Minimization for width complete.");

    // Optionally minimize height, though often less critical for tidy trees
    // console.log("Attempting to minimize root subtree height...");
    // const minimizerHeight = new Minimizer(this._layoutData.net, [rootSubtreeBox.height]);
    // minimizerHeight.minimize();
    // console.log("Minimization for height complete.");
  }

  // --- minimizeSpacings REMOVED ---

  /** Helper for logging statistics and final box values */
  private logStatsAndBoxes(rootNode: SemanticNode<void>): void {
    console.log('--- Propagator Network Stats ---');
    console.log('Cell count:', this._layoutData.net.cells().length);
    console.log('Propagator count:', this._layoutData.net.propagatorConnections.length);
    console.log('--------------------------------');
    console.log('--- Final Bounding Boxes ---');
    const nodeIds = getNodeIds(rootNode);
    for (let nodeId of nodeIds) {
      try {
        const intrinsicBox = this._layoutData.lookupIntrinsicBox(nodeId);
        const i_minX = printContent(printNumericRange)(this._layoutData.net.readCell(intrinsicBox.minX));
        const i_minY = printContent(printNumericRange)(this._layoutData.net.readCell(intrinsicBox.minY));
        const i_width = printContent(printNumericRange)(this._layoutData.net.readCell(intrinsicBox.width));
        const i_height = printContent(printNumericRange)(this._layoutData.net.readCell(intrinsicBox.height));
        console.log(`Node ${nodeId} [Intrinsic]: minX=${i_minX}, minY=${i_minY}, width=${i_width}, height=${i_height}`);

        const subtreeBox = this._layoutData.lookupSubtreeExtentBox(nodeId);
        const s_minX = printContent(printNumericRange)(this._layoutData.net.readCell(subtreeBox.minX));
        const s_minY = printContent(printNumericRange)(this._layoutData.net.readCell(subtreeBox.minY));
        const s_width = printContent(printNumericRange)(this._layoutData.net.readCell(subtreeBox.width));
        const s_height = printContent(printNumericRange)(this._layoutData.net.readCell(subtreeBox.height));
        console.log(`Node ${nodeId} [Subtree]  : minX=${s_minX}, minY=${s_minY}, width=${s_width}, height=${s_height}`);
      } catch (e) {
        console.warn(`Could not read bounding box details for node ${nodeId}:`, e);
      }
    }
    console.log('--------------------------');
  }
}

// import { XYPosition } from "@xyflow/react"
// import { addRangePropagator, between, divNumericRangeNumberPropagator, getMax, getMidpoint, getMin, lessThanEqualPropagator, NumericRange, printNumericRange, selectMin, subNumericRange, subtractRangePropagator } from "../../../../constraint/propagator/NumericRange"
// import { CellRef, ConflictHandler, ContentIsNotKnownError, equalPropagator, mapContent, printContent, unaryPropagator, unknown } from "../../../../constraint/propagator/Propagator"
// import { getNodeIds, SemanticNode } from "../../../../ir/SemanticGraph";
// import { computeIndexedNodes, LevelMap } from "../NodeLevels";
// import { isArrayLike } from "lodash";
// import { node } from "webpack";
// import { Minimizer } from "../../../../constraint/propagator/Minimize";
// import { NodesAndEdges } from "../LayoutEngine";
// import { Dimensions, getNodeDimensions } from "../../../NodeDimensions";
// import { SiblingConstraint } from "./constraints/SiblingConstraint";
// import { MidpointConstraint } from "./constraints/MidpointConstraint";
// import { ParentChildConstraint } from "./constraints/ParentChildConstraint";
// import { SpacingMap } from "./constraints/SpacingMap";
// import { NestedNodeConstraint } from "./constraints/NestedNodeConstraint";
// import { BoundingBox } from "./BoundingBox";
// import { DimensionsMap } from "./Constraint";

// const LOG_PROPAGATOR_STATS = true
// const MINIMIZE = true

// export const VERTICAL_PADDING = 100;
// export const HORIZONTAL_PADDING = 100;

// export type AbsolutePositionMap = Map<string, XYPosition>

// export class ConstraintCalculator {
//   private _spacingMap: SpacingMap
//   private _absolutePositionMap: Map<string, XYPosition> = new Map()
//   private readonly _rootId: string

//   constructor(roots: SemanticNode<void>[], conflictHandlers: ConflictHandler<NumericRange>[], minimize: boolean = MINIMIZE) {
//     const chosenRoot = roots[0]!

//     this._spacingMap = new SpacingMap(chosenRoot.id, conflictHandlers)
//     this._rootId = chosenRoot.id
//     console.log('got here')

//     for (let root of roots) {
//       // For each root node, we need to ensure that the root node has its own
//       // self-spacing set up in the spacing map.
//       this._spacingMap.getSpacing(this._rootId, root.id)
//     }

//     console.log('generating constraints')
//     for (let root of roots) {
//       try {
//         this.generateConstraints(root)
//       } catch (e) {
//         console.error('Error generating constraints:', e)
//       }
//     }

//     console.log('indexed nodes')
//     for (let root of roots) {
//       console.log('About to compute indexed nodes for', root.id)

//       try {
//         let [levelMap, _breadthIndexMap, _indexedNodes] = computeIndexedNodes(root)
//         console.log('Computed indexed nodes for', root.id, levelMap)
//         this.generateCousinConstraints(levelMap)
//       } catch (e) {
//         console.error('Error generating cousin constraints:', e)
//       }
//     }

//     console.log('got here 2')

//     if (minimize) {
//       try {
//         // this.minimizeSpacings()
//       } catch (e) {
//         if (e instanceof ContentIsNotKnownError) {
//         } else {
//           throw e
//         }
//       }
//     }

//     if (LOG_PROPAGATOR_STATS) {
//       console.log('Propagator cell count:', this._spacingMap.net.cells().length)
//       console.log('Propagator count:', this._spacingMap.net.propagatorConnections.length)
//     }

//     let nodeIds = getNodeIds(chosenRoot)

//     // Print bounding boxes
//     if (LOG_PROPAGATOR_STATS) {
//       for (let nodeId of nodeIds) {
//         let boundingBox = this._spacingMap.lookupIntrinsicBox(nodeId)

//         // Read the Content from the CellRefs and print them. Use readCell not readKnownOrError so that we don't get any errors
//         let minX = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.minX))
//         let minY = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.minY))
//         let width = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.width))
//         let height = printContent(printNumericRange)(this._spacingMap.net.readCell(boundingBox.height))
//         if (LOG_PROPAGATOR_STATS) {
//           console.log(`Bounding box for node ${nodeId}: minX=${minX}, minY=${minY}, width=${width}, height=${height}`)
//         }

//       }
//     }

//     try {
//       this.generateAbsolutePositionMap(nodeIds)
//     } catch (e) {
//       if (e instanceof ContentIsNotKnownError) {
//         // Don't fail here, just log the error
//         console.error('Failed to generate absolute position map:', e)
//       } else {
//         throw e // rethrow other errors
//       }
//     }
//   }

//   public async renderDebugInfo(): Promise<NodesAndEdges> {
//     return await this._spacingMap.renderDebugInfo()
//   }

//   public get absolutePositionMap(): AbsolutePositionMap {
//     return this._absolutePositionMap
//   }

//   public get dimensionsMap(): DimensionsMap {
//     return this._spacingMap.dimensionsMap
//   }

//   private chooseFromRange(range: NumericRange): number {
//     return getMin(range)!
//   }

//   private generateAbsolutePositionMap(nodeIds: string[]): void {
//     for (let nodeId of nodeIds) {
//       let x = this._spacingMap.getAbsoluteX(nodeId)
//       let y = this._spacingMap.getAbsoluteY(nodeId)

//       this._absolutePositionMap.set(nodeId, { x, y })
//     }
//   }

//   private generateCousinConstraints(levelMap: LevelMap): void {
//     for (let [level, nodeIds] of levelMap) {
//       for (let i = 0; i < nodeIds.length - 1; i++) {
//         // TODO: Fix
//         let siblingConstraint = new SiblingConstraint(nodeIds[i]!, nodeIds[i + 1]!)
//         // siblingConstraint.apply(this._spacingMap)
//       }
//     }
//   }

//   private generateConstraints(n: SemanticNode<void>): void {
//     // Set up the initial bounding box dimensions
//     this._spacingMap.refineIntrinsicBoxDimensions(n, getNodeDimensions(n))

//     // Set up parent-child constraints
//     for (let child of n.children) {
//       let parentChildConstraint = new ParentChildConstraint(n.id, child.id)
//       parentChildConstraint.apply(this._spacingMap)
//       console.log('Applied parent-child constraint between', n.id, 'and', child.id)
//     }

//     // Set up midpoint constraint
//     let childIds = n.children.map(child => child.id)
//     let midpointConstraint = new MidpointConstraint(this._rootId, n.id, childIds)
//     midpointConstraint.apply(this._spacingMap)

//     // Handle nested nodes (subgraphs)
//     if (n.subgraph) {
//       for (let i = 0; i < n.subgraph.length; i++) {
//         let child = n.subgraph[i]!

//         this.nestedNodeConstraints(n.id, child)
//       }
//     }

//     // Recurse over children
//     for (let child of n.children) {
//       this.generateConstraints(child)
//     }

//     for (let child of n.subgraph ?? []) {
//       this.generateConstraints(child)
//     }
//   }

//   private nestedNodeConstraints(parentId: string, curr: SemanticNode<void>): void {
//     if (!curr) {
//       return
//     }

//     let nestedNodeConstraint = new NestedNodeConstraint(parentId, curr.id)
//     nestedNodeConstraint.apply(this._spacingMap)

//     // Recurse over the children of the current node
//     for (let child of curr.children) {
//       this.nestedNodeConstraints(curr.id, child)
//     }

//     for (let child of curr.subgraph ?? []) {
//       this.nestedNodeConstraints(curr.id, child)
//     }
//   }

//   private minimizeSpacings(): void {
//     let minimizer = new Minimizer(this._spacingMap.net, this._spacingMap.getRelativeSpacingCells())
//     minimizer.minimize()
//   }
// }
