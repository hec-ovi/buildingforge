import { tubeSegment, type FacadeField, type MeshBuilder } from '../api.ts';
import { overlaps, type Box } from './geometry.ts';

interface CableInput { builder: MeshBuilder; field: FacadeField; material: (role: string) => string; name: string; skin: number }

/** One low service conductor joins existing condenser-side sockets, never absent equipment. */
export function serviceCable(input: CableInput, installed: number[], base: number, holes: Box[]): boolean {
  for (let i = 1; i < installed.length; i++) {
    const left = installed[i - 1]! + 0.54, right = installed[i]! - 0.54;
    const box = { u0: left - 0.025, u1: right + 0.025, y0: base + 0.42, y1: base + 0.58 };
    if (right <= left || holes.some(h => overlaps(box, h))) continue;
    conductor(input, left, right, base);
    return true;
  }
  return false;
}

function conductor({ builder, field, material, name, skin }: CableInput, left: number, right: number, base: number): void {
  const depth = skin + 0.4, sink = builder.part(`${name}:conductor`);
  const point = (t: number) => field.point(left + (right - left) * t, base + 0.55 - 0.1 * 4 * t * (1 - t), depth);
  for (let segment = 0; segment < 5; segment++) tubeSegment(sink, material('service-dark'), point(segment / 5), point((segment + 1) / 5), 0.008);
  for (const [index, u] of [left, right].entries()) field.solid(builder.part(`${name}:anchor:${index}`), material('service'),
    u - 0.02, u + 0.02, base + 0.53, base + 0.57, depth + 0.03, depth - 0.03);
}
