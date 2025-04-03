import { NumericRange, addRangePropagator, atLeast, divNumericRangeNumberPropagator, exactly, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { Dimensions } from "../../../NodeDimensions";

export class BoundingBox {
  private _minX: CellRef;
  private _minY: CellRef;
  private _width: CellRef;
  private _height: CellRef;

  private _maxX: CellRef;
  private _maxY: CellRef;

  private _centerX: CellRef;

  private _typePrefix: string;
  private _nodeId: string;

  public static createNew(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string): BoundingBox {
    return new BoundingBox(
      net,
      typePrefix,
      nodeId,
      net.newCell(`${typePrefix} minX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} minY for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} width for ${nodeId}`, known(atLeast(0))),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(atLeast(0)))
    );
  }

  public static createNewWithDims(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string, dims: Dimensions): BoundingBox {
    return new BoundingBox(
      net,
      typePrefix,
      nodeId,
      net.newCell(`${typePrefix} minX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} minY for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} width for ${nodeId}`, known(dims.width)),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(dims.height))
    );
  }

  constructor(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
    this._minX = minX;
    this._minY = minY;
    this._width = width;
    this._height = height;

    this._typePrefix = typePrefix;

    this._nodeId = nodeId;

    this._maxX = net.newCell(`maxX [node ${nodeId}]`, unknown());
    this._maxY = net.newCell(`maxY [node ${nodeId}]`, unknown());

    // maxX = minX + width
    addRangePropagator(
      `${this._typePrefix} maxX calculation [node ${this._nodeId}]`,
      net,
      this._minX,
      this._width,
      this._maxX
    );

    // maxY = minY + height
    addRangePropagator(
      `${this._typePrefix} maxY calculation [node ${this._nodeId}]`,
      net,
      this._minY,
      this._height,
      this._maxY
    );

    const halfWidth = net.newCell(`halfWidth [node ${nodeId}]`, unknown());
    this._centerX = net.newCell(`centerX [node ${nodeId}]`, unknown());

    // halfWidth = width / 2
    divNumericRangeNumberPropagator(
      `${this._typePrefix} halfWidth calculation [node ${this._nodeId}]`,
      net,
      this._width,
      2,
      halfWidth
    );

    // centerX = minX + halfWidth
    addRangePropagator(
      `${this._typePrefix} centerX calculation [node ${this._nodeId}]`,
      net,
      this._minX,
      halfWidth,
      this._centerX
    );
  }

  public get left(): CellRef {
    return this._minX;
  }

  public get top(): CellRef {
    return this._minY;
  }

  public get right(): CellRef {
    return this._maxX;
  }

  public get bottom(): CellRef {
    return this._maxY;
  }

  public get width(): CellRef {
    return this._width;
  }

  public get height(): CellRef {
    return this._height;
  }

  public get centerX(): CellRef {
    return this._centerX;
  }

  public getDebugInfo(net: PropagatorNetwork<NumericRange>): string {
    const minXContent = net.readCell(this._minX);
    const minYContent = net.readCell(this._minY);
    const widthContent = net.readCell(this._width);
    const heightContent = net.readCell(this._height);

    return `BoundingBox: minX: ${printContent(printNumericRange)(minXContent)}, minY: ${printContent(printNumericRange)(minYContent)}, width: ${printContent(printNumericRange)(widthContent)}, height: ${printContent(printNumericRange)(heightContent)}`;
  }
}
