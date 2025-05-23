export function portOffsetPercentages(portCount: number): number[] {
  const offset = 100 / (portCount + 1);
  return Array.from({ length: portCount }, (_, i) => (i + 1) * offset);
}

export function inputHandleName(i: number): string {
  return `top-${i}`;
}

export function outputHandleName(i: number): string {
  return `bottom-${i}`;
}

export function nestedOutputHandleName(i: number): string {
  return `nested-bottom-${i}`;
}

export function parameterHandleName(i: number): string {
  return `parameter-${i}`;
}

export function freeVarHandleName(i: number): string {
  return `free-var-${i}`;
}
