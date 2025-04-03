import { PropagatorNetwork } from "./Propagator"

export class PropagatorNetworkToJson<A> {
  toJsonText(net: PropagatorNetwork<A>): string {
    return JSON.stringify(this.toJson(net));
  }

  toJson(net: PropagatorNetwork<A>): PropagatorNetworkJson {
    return {
      cells: this.getCells(net),
      propagators: this.getPropagators(net),
    };
  }

  private getCells(net: PropagatorNetwork<A>): string[] {
    return net.getCellRefs().map(cellRef => net.cellDescription(cellRef));
  }

  private getPropagators(net: PropagatorNetwork<A>): PropagatorJson[] {
    return net.propagatorConnections.map(propagator => {
      return {
        label: propagator.description,
        inputs: propagator.inputs.map(cellRef => net.cellDescription(cellRef)),
        outputs: propagator.outputs.map(cellRef => net.cellDescription(cellRef)),
      };
    });
  }
}

type PropagatorNetworkJson =
  {
    cells: string[],
    propagators: PropagatorJson[]
  }

type PropagatorJson =
  {
    label: string,
    inputs: string[],
    outputs: string[]
  }