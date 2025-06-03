import { BoundingBox } from "./BoundingBox";
import { NodeLayout } from "./NodeLayout";

export class DebugBoundingBox {
  static createFromIntrinsicBox(
    layout: NodeLayout
  ): DebugBoundingBox {
    return new DebugBoundingBox(layout.intrinsicBox, layout.nodeId, layout.nestingParentId);
  }

  static createFromSubtreeExtentBox(
    layout: NodeLayout
  ): DebugBoundingBox {
    return new DebugBoundingBox(layout.subtreeExtentBox, layout.nodeId, layout.nestingParentId);
  }

  constructor(
    private _box: BoundingBox,
    private _label: string,
    private _nestingParentId: string | null,
  ) {
  }

  get box() {
    return this._box;
  }

  get nestingParentId() {
    return this._nestingParentId;
  }

  get label() {
    return this._label;
  }
}