export function portOffsetPercentages(portCount: number): number[] {
  const offset = 100 / (portCount + 1);
  return Array.from({ length: portCount }, (_, i) => (i + 1) * offset);
}
