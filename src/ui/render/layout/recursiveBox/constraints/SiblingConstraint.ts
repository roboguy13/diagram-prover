import { writeAtLeastPropagator, exactly } from "../../../../../constraint/propagator/NumericRange";
import { known } from "../../../../../constraint/propagator/Propagator";
import { HORIZONTAL_PADDING } from "../SpacingConstraints";
import { Constraint } from "../Constraint";
import { SpacingMap } from "./SpacingMap";

export class SiblingConstraint implements Constraint {
  private _nodeId1: string;
  private _nodeId2: string;

  constructor(nodeId1: string, nodeId2: string) {
    this._nodeId1 = nodeId1;
    this._nodeId2 = nodeId2;
  }

  public apply(spacingMap: SpacingMap): void {
    let xSpacing = spacingMap.getXSpacing(this._nodeId1, this._nodeId2);
    let ySpacing = spacingMap.getYSpacing(this._nodeId1, this._nodeId2);

    // spacingMap.net.writeCell({ description: `xSpacing ∈ [${HORIZONTAL_PADDING}, ${HORIZONTAL_PADDING*2}]`, inputs: [xSpacing], outputs: [] }, xSpacing, known(between(HORIZONTAL_PADDING, HORIZONTAL_PADDING * 2)))
    // writeBetweenPropagator(spacingMap.net, xSpacing, HORIZONTAL_PADDING, HORIZONTAL_PADDING * 2)
    writeAtLeastPropagator(spacingMap.net, xSpacing, HORIZONTAL_PADDING);

    spacingMap.net.writeCell({ description: 'ySpacing = 0', inputs: [ySpacing], outputs: [] }, ySpacing, known(exactly(0)));
  }
}
