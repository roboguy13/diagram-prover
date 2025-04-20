import { maxRangeListPropagator, minRangeListPropagator, NumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { BoundingBox, SimpleBoundingBox } from "./BoundingBox";

export class CollectiveBoundingBox extends BoundingBox {
  private _boundingBox: SimpleBoundingBox;
  protected override _typePrefix: string

  constructor(
    net: PropagatorNetwork<NumericRange>,
    typePrefix: string,
    nodeIds: string[],
    boundingBoxes: BoundingBox[]
  ) {
    super()
    if (boundingBoxes.length === 0) {
      throw new Error("No bounding boxes provided for CollectiveBoundingBox");
    }

    this._typePrefix = typePrefix;

    const nodeIdsString = nodeIds.join(", ");

    const minX = net.newCell(`${typePrefix} minX for ${nodeIdsString}`, unknown())
    const minY = net.newCell(`${typePrefix} minY for ${nodeIdsString}`, unknown())
    const maxX = net.newCell(`${typePrefix} maxX for ${nodeIdsString}`, unknown())
    const maxY = net.newCell(`${typePrefix} maxY for ${nodeIdsString}`, unknown())

    // minX = min(minX1, minX2, ...)
    minRangeListPropagator(
      `${typePrefix}: minX for ${nodeIdsString}`,
      net,
      boundingBoxes.map(bb => bb.left),
      minX
    );

    // minY = min(minY1, minY2, ...)
    minRangeListPropagator(
      `${typePrefix}: minY for ${nodeIdsString}`,
      net,
      boundingBoxes.map(bb => bb.top),
      minY
    );

    // maxX = max(maxX1, maxX2, ...)
    maxRangeListPropagator(
      `${typePrefix}: maxX for ${nodeIdsString}`,
      net,
      boundingBoxes.map(bb => bb.right),
      maxX
    );

    // maxY = max(maxY1, maxY2, ...)
    maxRangeListPropagator(
      `${typePrefix}: maxY for ${nodeIdsString}`,
      net,
      boundingBoxes.map(bb => bb.bottom),
      maxY
    );

    this._boundingBox = SimpleBoundingBox.createFromMinMax(
      net,
      typePrefix,
      nodeIdsString,
      minX,
      minY,
      maxX,
      maxY
    )
  }

  get left(): CellRef {
    return this._boundingBox.left;
  }

  get top(): CellRef {
    return this._boundingBox.top;
  }

  get right(): CellRef {
    return this._boundingBox.right;
  }

  get bottom(): CellRef {
    return this._boundingBox.bottom;
  }

  get width(): CellRef {
    return this._boundingBox.width;
  }

  get height(): CellRef {
    return this._boundingBox.height;
  }

  get centerX(): CellRef {
    return this._boundingBox.centerX;
  }
}