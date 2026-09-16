import type { DecorationContext } from '../api.ts';
import { Surface } from './surface.ts';

export function accent(context: DecorationContext, surface: Surface, edge: number, u: number, y: number, outward: number, lumens: number): void {
  if (!surface.clear([u - 0.13, u + 0.13, y - 0.065, y + 0.065])) return;
  context.layout.lights.push({ kind: 'accent', edge, material: context.material('light'), color: '#9bdded', lumens, range: 10,
    position: surface.point(u, y, outward), normal: [...surface.field.normal], size: [0.18, 0.08, 0.04], standoff: 0 });
}
