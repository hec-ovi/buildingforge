import { Rng } from '../core/rng.ts';
import { tubeSegment } from './tube.ts';
import type { PartSink, V3 } from './primitives.ts';

/** Arched palm fronds and small leaves share a closed planter's soil surface. */
export function gardenPlant(sink: PartSink, origin: V3, size: number, seed: string): void {
  const rng = new Rng(seed, 'plant');
  const stem = 'cyberpunk/garden-stem/mid#surface';
  const tip: V3 = [origin[0], origin[1] + size * 0.48, origin[2]];
  tubeSegment(sink, stem, origin, tip, size * 0.018);
  const fronds = 6 + rng.int(0, 2);
  for (let f = 0; f < fronds; f++) {
    const angle = f * Math.PI * 2 / fronds + rng.range(-0.15, 0.15);
    const along: [number, number] = [Math.cos(angle), Math.sin(angle)];
    const across: [number, number] = [-along[1], along[0]];
    const reach = size * rng.range(0.58, 0.9);
    const point = (t: number): V3 => [tip[0] + along[0] * reach * t,
      tip[1] + size * (0.5 * Math.sin(t * Math.PI) - 0.14 * t), tip[2] + along[1] * reach * t];
    for (let step = 0; step < 8; step++) {
      tubeSegment(sink, stem, point(step / 8), point((step + 1) / 8), size * 0.004);
      const t = (step + 0.7) / 8, base = point(t);
      for (const side of [-1, 1]) {
        const length = size * (0.23 * Math.sin(t * Math.PI) + 0.06);
        const end: V3 = [base[0] + across[0] * side * length + along[0] * length * 0.35,
          base[1] - size * 0.08, base[2] + across[1] * side * length + along[1] * length * 0.35];
        const half = size * 0.022;
        const left: V3 = [(base[0] + end[0]) / 2 - along[0] * half, (base[1] + end[1]) / 2 + half, (base[2] + end[2]) / 2 - along[1] * half];
        const right: V3 = [(base[0] + end[0]) / 2 + along[0] * half, (base[1] + end[1]) / 2 + half, (base[2] + end[2]) / 2 + along[1] * half];
        const material = `cyberpunk/garden-leaf${(f + step) % 4 === 0 ? '-light' : ''}/mid#surface`;
        const uv: [number, number][] = [[0.5, 0], [0, 0.5], [0.5, 1], [1, 0.5]];
        sink.quadFacing(material, base, left, end, right, [0, 1, 0], uv);
        sink.quadFacing(material, base, left, end, right, [0, -1, 0], uv);
      }
    }
  }
}
