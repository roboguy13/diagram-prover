import { atLeast, exactly, getMin, negateNumericRangePropagator, NumericRange, partialSemigroupNumericRange } from "../../../../../constraint/propagator/NumericRange";
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

export class SpacingMap {
  private _spacings: Map<string, Spacing> = new Map();
  private _intrinsicBoxes: Map<string, BoundingBox> = new Map();
  private _subtreeExtentBoxes: Map<string, BoundingBox> = new Map();
  private _net: PropagatorNetwork<NumericRange>;
  private _rootNodeId: string;

  constructor(rootNodeId: string, conflictHandlers: ConflictHandler<NumericRange>[]) {
    this._rootNodeId = rootNodeId;

    this._net = new PropagatorNetwork<NumericRange>(partialSemigroupNumericRange(), conflictHandlers);

    this._spacings.set(makeEdgeKey(rootNodeId, rootNodeId), {
      xSpacing: this._net.newCell('root self spacing X', known(exactly(0))),
      ySpacing: this._net.newCell('root self spacing Y', known(exactly(0))),
    });

    this._intrinsicBoxes.set(
      this._rootNodeId,
      new BoundingBox(
        this._net,
        'intrinsic',
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
        this._net.newCell(`subtree extent minX for ${this._rootNodeId}`, known(exactly(0))),
        this._net.newCell(`subtree extent minY for ${this._rootNodeId}`, known(exactly(0))),
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
    let result: CellRef[] = [];

    for (let [edgeKey, spacing] of this._spacings) {
      result.push(spacing.xSpacing);
      result.push(spacing.ySpacing);
    }

    return result;
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
        this._net.newCell(`intrinsic minX for ${nodeId}`, unknown()),
        this._net.newCell(`intrinsic minY for ${nodeId}`, unknown()),
        this._net.newCell(`intrinsic width for ${nodeId}`, known(atLeast(0))),
        this._net.newCell(`intrinsic height for ${nodeId}`, known(atLeast(0)))
      );

      this._intrinsicBoxes.set(nodeId, boundingBox);
    }

    return boundingBox;
  }

  public lookupSubtreeExtentBox(nodeId: string): BoundingBox {
    let boundingBox = this._subtreeExtentBoxes.get(nodeId);

    if (!boundingBox) {
      boundingBox = new BoundingBox(
        this._net,
        'subtree extent',
        this._net.newCell(`subtree extent minX for ${nodeId}`, unknown()),
        this._net.newCell(`subtree extent minY for ${nodeId}`, unknown()),
        this._net.newCell(`subtree extent width for ${nodeId}`, known(atLeast(0))),
        this._net.newCell(`subtree extent height for ${nodeId}`, known(atLeast(0)))
      );

      this._subtreeExtentBoxes.set(nodeId, boundingBox);
    }

    return boundingBox;
  }

  public getSpacing(nodeId1: string, nodeId2: string): Spacing {
    let spacing = this._spacings.get(makeEdgeKey(nodeId1, nodeId2));

    if (!spacing) {
      spacing = {
        xSpacing: this._net.newCell('X spacing between ' + nodeId1 + ' and ' + nodeId2, unknown()),
        ySpacing: this._net.newCell('Y spacing between ' + nodeId1 + ' and ' + nodeId2, unknown())
      };

      let negativeSpacing = {
        isRelative: nodeId1 !== this._rootNodeId && nodeId2 !== this._rootNodeId,
        xSpacing: this._net.newCell('negative X spacing between ' + nodeId1 + ' and ' + nodeId2, unknown()),
        ySpacing: this._net.newCell('negative Y spacing between ' + nodeId1 + ' and ' + nodeId2, unknown()),
      };

      negateNumericRangePropagator('negate', this._net, spacing.xSpacing, negativeSpacing.xSpacing);
      negateNumericRangePropagator('negate', this._net, spacing.ySpacing, negativeSpacing.ySpacing);

      this._spacings.set(makeEdgeKey(nodeId1, nodeId2), spacing);
      this._spacings.set(makeEdgeKey(nodeId2, nodeId1), negativeSpacing);

      return spacing;
    }

    return spacing;
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

  public getXSpacing(nodeId1: string, nodeId2: string): CellRef {
    return this.getSpacing(nodeId1, nodeId2).xSpacing;
  }

  public getYSpacing(nodeId1: string, nodeId2: string): CellRef {
    return this.getSpacing(nodeId1, nodeId2).ySpacing;
  }
}
