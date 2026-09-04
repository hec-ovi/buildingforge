import type { Blueprint } from '../types.ts';
import { materialSlot } from '../materials/slot.ts';
import { add, scale, type PartSink, type V3 } from './primitives.ts';

/** Recessed diffuser in a layered, hooded metal housing, fitted to its reserved seat. */
export function meshLightFixture(sink: PartSink, light: Blueprint['lights'][number], mat: (kind: string) => string): void {
  const n: V3 = [light.normal[0], 0, light.normal[1]];
  const right: V3 = [light.normal[1], 0, -light.normal[0]];
  const up: V3 = [0, 1, 0];
  const [w, h, d] = light.size;
  const at = (x: number, y: number, z: number): V3 =>
    add(add(add(light.position, scale(right, x)), scale(up, y)), scale(n, light.standoff + z));
  const metal = mat('window-frame');
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number) =>
    sink.box(metal, at(x, y, z), scale(right, width / 2), scale(up, height / 2), scale(n, depth / 2), 'along');
  box(0, 0, d * 0.12, w, h, d * 0.24);
  box(0, 0, d * 0.47, w * 0.88, h * 0.88, d * 0.46);
  // Separate projecting cap and bottom rail shade the lens at grazing angles.
  box(0, h * 0.44, d * 0.62, w, h * 0.12, d * 0.76);
  box(0, -h * 0.44, d * 0.58, w, h * 0.12, d * 0.68);
  for (const side of [-1, 1]) box(side * w * 0.43, 0, d * 0.56, w * 0.08, h * 0.76, d * 0.64);
  const x = w * 0.35, y = h * 0.35, z = d * 0.72;
  sink.quadFacing(materialSlot(mat('light-fixture'), 'strip'),
    at(-x, -y, z), at(x, -y, z), at(x, y, z), at(-x, y, z),
    n, [[0, 1], [1, 1], [1, 0], [0, 0]]);
}
