import { Rng } from '../core/rng.ts';
import { tubeSegment } from './tube.ts';
import type { PartSink, V3 } from './primitives.ts';

const FROND_STEPS = 8;

/**
 * Arched palm fronds on a closed planter's soil surface. A frond is one tapered
 * double-sided blade following its arc, with the leaflet pattern in the leaf
 * map, so a planted band stays affordable at facade scale.
 */
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
    const half = (t: number) => size * (0.23 * Math.sin(t * Math.PI) + 0.06);
    const edge = (t: number, side: number): V3 => {
      const centre = point(t), spread = half(t) * side;
      return [centre[0] + across[0] * spread, centre[1] - size * 0.04, centre[2] + across[1] * spread];
    };
    const material = `cyberpunk/garden-leaf${f % 4 === 0 ? '-light' : ''}/mid#surface`;
    for (let step = 0; step < FROND_STEPS; step++) {
      const t0 = step / FROND_STEPS, t1 = (step + 1) / FROND_STEPS;
      const uv: [number, number][] = [[0, t0], [1, t0], [1, t1], [0, t1]];
      const blade: [V3, V3, V3, V3] = [edge(t0, -1), edge(t0, 1), edge(t1, 1), edge(t1, -1)];
      sink.quadFacing(material, ...blade, [0, 1, 0], uv);
      sink.quadFacing(material, ...blade, [0, -1, 0], uv);
    }
  }
}
