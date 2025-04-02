import { NumericRange, addRangePropagator } from "../../../../constraint/propagator/NumericRange";
import { CellRef, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";


export class BoundingBox {
  private _minX: CellRef;
  private _minY: CellRef;
  private _width: CellRef;
  private _height: CellRef;

  private _maxX: CellRef;
  private _maxY: CellRef;

  private _typePrefix: string;

  constructor(net: PropagatorNetwork<NumericRange>, typePrefix: string, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
    this._minX = minX;
    this._minY = minY;
    this._width = width;
    this._height = height;

    this._maxX = net.newCell('maxX', unknown());
    this._maxY = net.newCell('maxY', unknown());

    this._typePrefix = typePrefix;

    // maxX = minX + width
    addRangePropagator(
      `${this._typePrefix} maxX calculation`,
      net,
      this._minX,
      this._width,
      this._maxX
    );

    // maxY = minY + height
    addRangePropagator(
      `${this._typePrefix} maxY calculation`,
      net,
      this._minY,
      this._height,
      this._maxY
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
}
