import { addRangePropagator, atLeast, divNumericRangeNumberPropagator, exactly, getMin, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange, subtractRangePropagator } from "../../../../../constraint/propagator/NumericRange";
import { CellRef, ConflictHandler, known, PropagatorNetwork, unknown } from "../../../../../constraint/propagator/Propagator";
import { propagatorNetworkToElkNode } from "../../../../../constraint/propagator/PropagatorToElk";
import { SemanticNode } from "../../../../../ir/SemanticGraph";
import { Dimensions } from "../../../../NodeDimensions";
import { elk } from "../../elk/ElkEngine";
import { elkToReactFlow } from "../../elk/ElkToReactFlow";
import { NodesAndEdges } from "../../LayoutEngine";
import { makeEdgeKey } from "../../NodeLevels";
import { BoundingBox } from "../BoundingBox";
import { DimensionsMap, Spacing } from "../Constraint";

export class LayoutData {
  private _intrinsicBoxes: Map<string, BoundingBox> = new Map();
  private _subtreeExtentBoxes: Map<string, BoundingBox> = new Map();
  private _net: PropagatorNetwork<NumericRange>;
  private _rootNodeId: string;
  private _linkedNodes: Set<string> = new Set();

  private _vSpacing: CellRef
  private _hSpacing: CellRef

  constructor(rootNodeId: string, conflictHandlers: ConflictHandler<NumericRange>[]) {
    this._rootNodeId = rootNodeId;

    this._net = new PropagatorNetwork<NumericRange>(partialSemigroupNumericRange(), conflictHandlers);

    this._vSpacing = this._net.newCell('vertical spacing', known(atLeast(20)))
    this._hSpacing = this._net.newCell('horizontal spacing', known(atLeast(20)))

    this._intrinsicBoxes.set(
      this._rootNodeId,
      new BoundingBox(
        this._net,
        'intrinsic',
        this._rootNodeId,
        this._net.newCell(`intrinsic minX for ${this._rootNodeId}`, known(exactly(0))),
        this._net.newCell(`intrinsic minY for ${this._rootNodeId}`, known(exactly(0))),
        this._net.newCell(`intrinsic width for ${this._rootNodeId}`, unknown()),
        this._net.newCell(`intrinsic height for ${this._rootNodeId}`, unknown())
      )
    );

    this._subtreeExtentBoxes.set(
      this._rootNodeId,
      new BoundingBox(
        this._net,
        'subtree extent',
        this._rootNodeId,
        this._net.newCell(`subtree extent minX for ${this._rootNodeId}`, unknown()),
        this._net.newCell(`subtree extent minY for ${this._rootNodeId}`, unknown()),
        this._net.newCell(`subtree extent width for ${this._rootNodeId}`, unknown()),
        this._net.newCell(`subtree extent height for ${this._rootNodeId}`, unknown())
      )
    );
  }

  public async renderDebugInfo(): Promise<NodesAndEdges> {
    let elkNode = propagatorNetworkToElkNode(this._net);
    let positioned = await elk.layout(elkNode);

    return elkToReactFlow(positioned);
  }

  public get dimensionsMap(): DimensionsMap {
    const result: DimensionsMap = new Map();

    for (let [nodeId, boundingBox] of this._intrinsicBoxes) {
      let width = this._net.readKnownOrError(boundingBox.width, 'width');
      let height = this._net.readKnownOrError(boundingBox.height, 'height');

      if (width && height) {
        result.set(nodeId, { width: getMin(width)!, height: getMin(height)! });
      }
    }

    return result;
  }

  public get standardVSpacing(): CellRef {
    return this._vSpacing;
  }

  public get standardHSpacing(): CellRef {
    return this._hSpacing;
  }

  public refineIntrinsicBoxDimensions(n: SemanticNode<void>, dims: Dimensions) {
    let boundingBox = this.lookupIntrinsicBox(n.id);

    this._net.writeCell(
      {
        description: `refine bounding box width for ${n.id}`,
        inputs: [],
        outputs: [boundingBox.width]
      },
      boundingBox.width,
      known(dims.width));

    this._net.writeCell(
      {
        description: `refine bounding box height for ${n.id}`,
        inputs: [],
        outputs: [boundingBox.height]
      },
      boundingBox.height,
      known(dims.height));
  }

  public getRelativeSpacingCells(): CellRef[] {
    return [this._vSpacing, this._hSpacing];
  }

  public get net(): PropagatorNetwork<NumericRange> {
    return this._net;
  }

  public lookupIntrinsicBox(nodeId: string): BoundingBox {
    let boundingBox = this._intrinsicBoxes.get(nodeId);

    if (!boundingBox) {
      boundingBox = new BoundingBox(
        this._net,
        'intrinsic',
        nodeId,
        this._net.newCell(`intrinsic minX for ${nodeId}`, unknown()),
        this._net.newCell(`intrinsic minY for ${nodeId}`, unknown()),
        this._net.newCell(`intrinsic width for ${nodeId}`, known(atLeast(0))),
        this._net.newCell(`intrinsic height for ${nodeId}`, known(atLeast(0)))
      );

      this._intrinsicBoxes.set(nodeId, boundingBox);

      this.ensureBoxesAndLink(nodeId);
    }

    return boundingBox;
  }

  public lookupSubtreeExtentBox(nodeId: string): BoundingBox {
    let boundingBox = this._subtreeExtentBoxes.get(nodeId);

    if (!boundingBox) {
      boundingBox = new BoundingBox(
        this._net,
        'subtree extent',
        nodeId,
        this._net.newCell(`subtree extent minX for ${nodeId}`, unknown()),
        this._net.newCell(`subtree extent minY for ${nodeId}`, unknown()),
        this._net.newCell(`subtree extent width for ${nodeId}`, known(atLeast(0))),
        this._net.newCell(`subtree extent height for ${nodeId}`, known(atLeast(0)))
      );

      this._subtreeExtentBoxes.set(nodeId, boundingBox);

      this.ensureBoxesAndLink(nodeId);
    }

    return boundingBox;
  }

  private ensureBoxesAndLink(nodeId: string): void {
    // Don't link the root node this way, its position is the anchor (0,0)
    if (nodeId === this._rootNodeId) {
        // Optional: Add equate propagators for root if not already implicitly linked
         const intrinsicRootBox = this._intrinsicBoxes.get(nodeId);
         const subtreeRootBox = this._subtreeExtentBoxes.get(nodeId);
         if (intrinsicRootBox && subtreeRootBox && !this._linkedNodes.has(nodeId)) {
             this._net.equalPropagator(`LinkRoot_Y:[${nodeId}]`, intrinsicRootBox.minY, subtreeRootBox.minY);
             this._net.equalPropagator(`LinkRoot_X:[${nodeId}]`, intrinsicRootBox.minX, subtreeRootBox.minX);
             this._linkedNodes.add(nodeId); // Mark root as 'linked' even if different logic applies
         }
        return;
    }
    console.log(`=== Ensuring boxes and linking for node ${nodeId}`); // Add log

    // Exit if already linked or if one of the boxes doesn't exist yet
    if (this._linkedNodes.has(nodeId) || !this._intrinsicBoxes.has(nodeId) || !this._subtreeExtentBoxes.has(nodeId)) {
        return;
    }

    const intrinsicBox = this._intrinsicBoxes.get(nodeId)!;
    const subtreeBox = this._subtreeExtentBoxes.get(nodeId)!;

    console.log(`Linking boxes for node ${nodeId}`); // Add log

    // --- Add Linking Propagators ---

    // 1. Link Vertical Position: intrinsicBox.minY = subtreeBox.minY
    this._net.equalPropagator(
        `Link_Y:[${nodeId}]`, // Unique descriptive name
        intrinsicBox.minY, // Target
        subtreeBox.minY    // Source
    );

    // 2. Link Horizontal Position: intrinsicBox.minX = subtreeBox.minX + (subtreeBox.width - intrinsicBox.width) / 2
    const totalWidthDiff = this._net.newCell(`Link_WidthDiff_[${nodeId}]`, unknown());
    const halfWidthDiff = this._net.newCell(`Link_HalfWidthDiff_[${nodeId}]`, unknown());

    // Calculate difference: totalWidthDiff = subtreeBox.width - intrinsicBox.width
    // Ensure subtractNumericRangePropagator handles ranges correctly (min = sub.min - intr.max, max = sub.max - intr.min)
    subtractRangePropagator(
        `Link_WidthDiff_Calc_[${nodeId}]`,
        this._net,
        subtreeBox.width,  // Input 1
        intrinsicBox.width,// Input 2
        totalWidthDiff     // Output
    );

    // Divide difference by two: halfWidthDiff = totalWidthDiff / 2
    // Ensure divideByTwoPropagator handles ranges correctly
    divNumericRangeNumberPropagator(
        `Link_HalfWidthDiff_Calc_[${nodeId}]`,
        this._net,
        totalWidthDiff,    // Input
        2,
        halfWidthDiff      // Output
    );

    // Add offset to subtree position: intrinsicBox.minX = subtreeBox.minX + halfWidthDiff
    // Ensure addNumericRangePropagator handles ranges correctly
    addRangePropagator(
        `Link_X_[${nodeId}]`,
        this._net,
        subtreeBox.minX,   // Input 1
        halfWidthDiff,     // Input 2
        intrinsicBox.minX  // Output
    );

    // Mark as linked
    this._linkedNodes.add(nodeId);
}

  public getAbsoluteX(nodeId: string): number {
    let boundingBox = this.lookupIntrinsicBox(nodeId);
    let xSpacing = this._net.readKnownOrError(boundingBox.minX, 'minX');

    if (!xSpacing) {
      console.error(`Failed to read minX for node ${nodeId}`);
      return 0;
    }

    return getMin(xSpacing)!;
  }

  public getAbsoluteY(nodeId: string): number {
    let boundingBox = this.lookupIntrinsicBox(nodeId);
    let ySpacing = this._net.readKnownOrError(boundingBox.minY, 'minY');

    if (!ySpacing) {
      console.error(`Failed to read minY for node ${nodeId}`);
      return 0;
    }

    return getMin(ySpacing)!;
  }
}
