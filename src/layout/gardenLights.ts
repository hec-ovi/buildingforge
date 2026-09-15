import { edgeDir, edgeLength, edgeNormal } from '../core/polygon.ts';
import type { FloorLayout } from './model.ts';
import type { Blueprint } from '../types.ts';

export function gardenLights(floor: FloorLayout): Blueprint['lights'] {
  const lights: Blueprint['lights'] = [];
  for (const edge of [0, 2]) {
    const dir = edgeDir(floor.outline, edge), normal = edgeNormal(floor.outline, edge);
    const length = edgeLength(floor.outline, edge), count = Math.max(1, Math.floor(length / 6));
    for (let i = 0; i < count; i++) {
      const u = length * (i + 0.5) / count, p = floor.outline[edge]!;
      lights.push({ kind: 'accent', edge, position: [p[0] + dir[0] * u, floor.height - 0.12, p[1] + dir[1] * u],
        normal, size: [length / count - 0.12, 0.12, 0.10], standoff: 0.02,
        material: 'cyberpunk/paired-light-cool/mid#surface', color: '#99fff0', lumens: 1400, range: 14 });
    }
  }
  return lights;
}
