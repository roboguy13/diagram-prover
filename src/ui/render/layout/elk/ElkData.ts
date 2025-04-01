import { ElkLabel } from "elkjs";

export class ElkColorLabel implements ElkLabel {
  private _color: string

  constructor(color: string) {
    this._color = color
  }

  get text(): string {
    return this._color
  }
}

export class ElkNoHandlesLabel implements ElkLabel {
}
