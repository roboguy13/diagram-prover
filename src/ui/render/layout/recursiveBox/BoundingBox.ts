import { NumericRange, addRangePropagator, atLeast, divNumericRangeNumberPropagator, exactly, lessThan, lessThanEqualPropagator, printNumericRange } from "../../../../constraint/propagator/NumericRange";
import { CellRef, known, printContent, PropagatorNetwork, unknown } from "../../../../constraint/propagator/Propagator";
import { Dimensions } from "../../../NodeDimensions";

export abstract class BoundingBox {
  abstract get left(): CellRef
  abstract get top(): CellRef
  abstract get right(): CellRef
  abstract get bottom(): CellRef
  abstract get width(): CellRef
  abstract get height(): CellRef
  abstract get centerX(): CellRef
  protected abstract get _typePrefix(): string

  public containedInConstraints(net: PropagatorNetwork<NumericRange>, box: BoundingBox): void {
    lessThanEqualPropagator(
      `${this._typePrefix} width <= box.width`,
      net,
      this.width,
      box.width
    );

    lessThanEqualPropagator(
      `${this._typePrefix} height <= box.height`,
      net,
      this.height,
      box.height
    );
  
    // this.left <= box.right
    lessThanEqualPropagator(
      `${this._typePrefix} left <= box.right`,
      net,
      this.left,
      box.right
    );

    // this.top <= box.bottom
    lessThanEqualPropagator(
      `${this._typePrefix} top <= box.bottom`,
      net,
      this.top,
      box.bottom
    );

    // this.right >= box.left
    lessThanEqualPropagator(
      `${this._typePrefix} right >= box.left`,
      net,
      box.left,
      this.right
    );

    // this.bottom >= box.top
    lessThanEqualPropagator(
      `${this._typePrefix} bottom >= box.top`,
      net,
      box.top,
      this.bottom
    );
  }

  public equalConstraints(net: PropagatorNetwork<NumericRange>, box: BoundingBox): void {
    net.equalPropagator(
      `${this._typePrefix} left = box.left`,
      this.left,
      box.left
    );


    net.equalPropagator(
      `${this._typePrefix} top = box.top`,
      this.top,
      box.top
    );

    net.equalPropagator(
      `${this._typePrefix} right = box.right`,
      this.right,
      box.right
    );

    net.equalPropagator(
      `${this._typePrefix} bottom = box.bottom`,
      this.bottom,
      box.bottom
    );

    net.equalPropagator(
      `${this._typePrefix} width = box.width`,
      this.width,
      box.width
    );

    net.equalPropagator(
      `${this._typePrefix} height = box.height`,
      this.height,
      box.height
    );

    net.equalPropagator(
      `${this._typePrefix} centerX = box.centerX`,
      this.centerX,
      box.centerX
    );
  }
}

export class SimpleBoundingBox extends BoundingBox {
  public static createNew(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string): SimpleBoundingBox {
    return SimpleBoundingBox.create(
      net,
      typePrefix,
      nodeId,
      net.newCell(`${typePrefix} minX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} minY for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} width for ${nodeId}`, known(atLeast(0))),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(atLeast(0)))
    );
  }

  public static createNewWithDims(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string, dims: Dimensions): SimpleBoundingBox {
    return SimpleBoundingBox.create(
      net,
      typePrefix,
      nodeId,
      net.newCell(`${typePrefix} minX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} minY for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} width for ${nodeId}`, known(dims.width)),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(dims.height))
    );
  }

  public static createNewWithUnknowns(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string): SimpleBoundingBox {
    return SimpleBoundingBox.create(
      net,
      typePrefix,
      nodeId,
      net.newCell(`${typePrefix} minX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} minY for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} width for ${nodeId}`, known(atLeast(0))),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(atLeast(0)))
    );
  }

  public static createFromMinMax (
    net: PropagatorNetwork<NumericRange>,
    typePrefix: string,
    nodeId: string,
    minX: CellRef,
    minY: CellRef,
    maxX: CellRef,
    maxY: CellRef
  ) {
    return SimpleBoundingBox._internalCreate(
      net,
      typePrefix,
      nodeId,
      minX,
      minY,
      maxX,
      maxY,
      net.newCell(`${typePrefix} width for ${nodeId}`, known(atLeast(0))),
      net.newCell(`${typePrefix} height for ${nodeId}`, known(atLeast(0))),
    )
  }

  public static create(
    net: PropagatorNetwork<NumericRange>,
    typePrefix: string,
    nodeId: string,
    minX: CellRef,
    minY: CellRef,
    width: CellRef,
    height: CellRef
  ) {
    return SimpleBoundingBox._internalCreate(
      net,
      typePrefix,
      nodeId,
      minX,
      minY,
      net.newCell(`${typePrefix} maxX for ${nodeId}`, unknown()),
      net.newCell(`${typePrefix} maxY for ${nodeId}`, unknown()),
      width,
      height
    );
  }

  /**
   * @internal
   */
  private static _internalCreate(
    net: PropagatorNetwork<NumericRange>,
    typePrefix: string,
    nodeId: string,
    minX: CellRef,
    minY: CellRef,
    maxX: CellRef,
    maxY: CellRef,
    width: CellRef,
    height: CellRef
  ): SimpleBoundingBox {
    // // For debug purposes:
    // net.writeCell(
    //   { description: `${typePrefix} width [node ${nodeId}]`, inputs: [], outputs: [width] },
    //   width,
    //   known(atLeast(0))
    // );
    // net.writeCell(
    //   { description: `${typePrefix} height [node ${nodeId}]`, inputs: [], outputs: [height] },
    //   height,
    //   known(atLeast(0))
    // );

    // maxX = minX + width
    addRangePropagator(
      `${typePrefix} maxX calculation [node ${nodeId}]`,
      net,
      minX,
      width,
      maxX
    );

    // maxY = minY + height
    addRangePropagator(
      `${typePrefix} maxY calculation [node ${nodeId}]`,
      net,
      minY,
      height,
      maxY
    );

    const halfWidth = net.newCell(`halfWidth [node ${nodeId}]`, unknown());
    const centerX = net.newCell(`centerX [node ${nodeId}]`, unknown());

    // halfWidth = width / 2
    divNumericRangeNumberPropagator(
      `${typePrefix} halfWidth calculation [node ${nodeId}]`,
      net,
      width,
      2,
      halfWidth
    );

    // centerX = minX + halfWidth
    addRangePropagator(
      `${typePrefix} centerX calculation [node ${nodeId}]`,
      net,
      minX,
      halfWidth,
      centerX
    );

    return new SimpleBoundingBox(
      typePrefix,
      nodeId,
      minX,
      minY,
      width,
      height,
      maxX,
      maxY,
      centerX
    );
  }

  private constructor(
    protected _typePrefix: string,
    private _nodeId: string,

    private _minX: CellRef,
    private _minY: CellRef,
    private _width: CellRef,
    private _height: CellRef,

    private _maxX: CellRef,
    private _maxY: CellRef,

    private _centerX: CellRef,
  ) {
    super()
  }

  // constructor(net: PropagatorNetwork<NumericRange>, typePrefix: string, nodeId: string, minX: CellRef, minY: CellRef, width: CellRef, height: CellRef) {
  //   // this._maxY = net.newCell(`maxY [node ${nodeId}]`, unknown());
  // }

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
