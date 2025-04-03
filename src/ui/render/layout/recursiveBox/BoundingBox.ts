import { NumericRange, addRangePropagator, divNumericRangeNumberPropagator } from "../../../../constraint/propagator/NumericRange";
import { CellRef, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";


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

  constructor(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
    this._minX = minX;
    this._minY = minY;
    this._width = width;
    this._height = height;

    this._maxX = net.newCell('maxX', unknown());
    this._maxY = net.newCell('maxY', unknown());

    this._typePrefix = typePrefix;

    this._nodeId = nodeId;

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

    const halfWidth = net.newCell('halfWidth', unknown());
    this._centerX = net.newCell('centerX', unknown());

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

  public get minX(): CellRef {
    return this._minX;
  }

  public get minY(): CellRef {
    return this._minY;
  }

  public get maxX(): CellRef {
    return this._maxX;
  }

  public get maxY(): CellRef {
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
}
