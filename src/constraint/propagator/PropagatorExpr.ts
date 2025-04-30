import { addRangeListPropagator, addRangePropagator, between, divNumericRangeNumberPropagator, exactly, lessThanEqualPropagator, maxNumericRange, maxRangeListPropagator, multNumericRangeNumberPropagator, negateNumericRangePropagator, NumericRange, subtractRangePropagator } from "./NumericRange";
import { CellRef, known, PropagatorNetwork, unknown } from "./Propagator";

export type PExpr =
  (net: PropagatorNetwork<NumericRange>) => CellRef

export function litRange(
  min: number,
  max: number,
  description: string | null = null
): PExpr {
  return (net) => {
    if (!description) {
      description = `(${min}, ${max})`;
    }
    const cell = net.newCell(description, known(between(min, max)));
    return cell;
  };
}

export function litExact(
  value: number,
  description: string | null = null
): PExpr {
  return (net) => {
    if (!description) {
      description = `(${value}, ${value})`;
    }
    const cell = net.newCell(description, known(exactly(value)));
    return cell;
  };
}

export function add(
  a: PExpr,
  b: PExpr,
  description: string | null = null
): PExpr {
  return (net) => {
    const aCell = a(net);
    const bCell = b(net);
    if (!description) {
      description = `add`;
    }

    const cell = net.newCell(description, unknown())

    addRangePropagator(
      description,
      net,
      aCell,
      bCell,
      cell
    );

    return cell;
  };
}

export function sub(
  a: PExpr,
  b: PExpr,
  description: string | null = null
): PExpr {
  return (net) => {
    const aCell = a(net);
    const bCell = b(net);
    if (!description) {
      description = `sub`;
    }

    const cell = net.newCell(description, unknown())

    subtractRangePropagator(
      description,
      net,
      aCell,
      bCell,
      cell
    );

    return cell;
  };
}

export function lessThanEqual(
  a: PExpr,
  b: PExpr,
  description: string | null = null
) {
  return (net: PropagatorNetwork<NumericRange>) => {
    const aCell = a(net);
    const bCell = b(net);
    if (!description) {
      description = `lessThan`;
    }

    const cell = net.newCell(description, unknown())

    lessThanEqualPropagator(
      description,
      net,
      aCell,
      bCell
    );

    return cell;
  };
}

export function equal(
  a: PExpr,
  b: PExpr,
  description: string | null = null
) {
  return (net: PropagatorNetwork<NumericRange>) => {
    const aCell = a(net);
    const bCell = b(net);
    if (!description) {
      description = `equal`;
    }

    const cell = net.newCell(description, unknown())

    net.equalPropagator(
      description,
      aCell,
      bCell
    );

    return cell;
  };
}

export function addList(
  list: PExpr[],
  description: string | null = null
): PExpr {
  return (net) => {
    if (!description) {
      description = `addList`;
    }

    const cell = net.newCell(description, unknown())

    const cells = list.map((expr) => expr(net));

    addRangeListPropagator(
      description,
      net,
      cells,
      cell
    );

    return cell;
  };
}

export function multNumber(
  a: PExpr,
  b: number,
  description: string | null = null
): PExpr {
  return (net) => {
    const aCell = a(net);
    if (!description) {
      description = `mult`;
    }

    const cell = net.newCell(description, unknown())

    multNumericRangeNumberPropagator(
      description,
      net,
      aCell,
      b,
      cell
    );

    return cell;
  };
}

export function negate(
  a: PExpr,
  description: string | null = null
): PExpr {
  return (net) => {
    const aCell = a(net);
    if (!description) {
      description = `negate`;
    }

    const cell = net.newCell(description, unknown())

    negateNumericRangePropagator(
      description,
      net,
      aCell,
      cell
    );

    return cell;
  };
}

export function maxList(
  list: PExpr[],
  description: string | null = null
): PExpr {
  return (net) => {
    if (!description) {
      description = `maxList`;
    }

    const cell = net.newCell(description, unknown())

    const cells = list.map((expr) => expr(net));

    maxRangeListPropagator(
      description,
      net,
      cells,
      cell
    );

    return cell;
  };
}

export function minList(
  list: PExpr[],
  description: string | null = null
): PExpr {
  return (net) => {
    if (!description) {
      description = `minList`;
    }

    const cell = net.newCell(description, unknown())

    const cells = list.map((expr) => expr(net));

    maxRangeListPropagator(
      description,
      net,
      cells,
      cell
    );

    return cell;
  };
}

export function divNumber(
  a: PExpr,
  b: number,
  description: string | null = null
): PExpr {
  return (net) => {
    const aCell = a(net);
    if (!description) {
      description = `div`;
    }

    const cell = net.newCell(description, unknown())

    divNumericRangeNumberPropagator(
      description,
      net,
      aCell,
      b,
      cell
    );

    return cell;
  };
}
