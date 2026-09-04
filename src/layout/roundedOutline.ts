import type { P2 } from '../core/polygon.ts';

/** CCW rectangle with circular corner returns, at most 10 mm chord error. */
export function roundedOutline(halfU: number, halfV: number, radius: number): P2[] {
  const segments = Math.max(8, Math.ceil((Math.PI / 2) / (2 * Math.acos(1 - 0.01 / radius))));
  const centers: P2[] = [
    [halfU - radius, -halfV + radius], [halfU - radius, halfV - radius],
    [-halfU + radius, halfV - radius], [-halfU + radius, -halfV + radius],
  ];
  return centers.flatMap(([x, z], corner) => Array.from({ length: segments + 1 }, (_, step): P2 => {
    const angle = -Math.PI / 2 + corner * Math.PI / 2 + step * Math.PI / (2 * segments);
    return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
  }));
}
