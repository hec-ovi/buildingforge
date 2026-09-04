import { edgeLength } from '../core/polygon.ts';
import type { Floor, Opening } from '../types.ts';
import type { Family } from '../rules/families.ts';

/** Paired ground openings leave broad solid fields around the entrance. */
export function fitGroundWindows(family: Family, floor: Floor): void {
  if (floor.index !== 0 || !['residential', 'office', 'corpo', 'industrial', 'security'].includes(family)
    || ['commerce', 'restaurant', 'coffee_shop', 'mall'].includes(floor.kind)) return;
  const original = floor.openings.filter((opening) => opening.kind === 'window');
  if (original.length === 0) return;
  floor.openings = floor.openings.filter((opening) => opening.kind !== 'window');
  for (let edge = 0; edge < floor.outline.length; edge++) {
    const template = original.find((opening) => opening.edge === edge);
    if (!template) continue;
    const length = edgeLength(floor.outline, edge);
    const occupied = floor.openings.filter((opening) => opening.edge === edge);
    const entrance = occupied.find((opening) => opening.kind === 'door' && opening.doorRole === 'main');
    const center = entrance ? entrance.offset + entrance.width / 2 : length / 2;
    const width = Math.min(2, template.width);
    const firstRadius = entrance ? entrance.width / 2 + 2 + width / 2 : 3;
    const fits = (offset: number) => offset >= 1 && offset + width <= length - 1
      && occupied.every((opening) => offset + width + 1 <= opening.offset
        || offset >= opening.offset + opening.width + 1);
    const accepted: Opening[] = [];
    for (let pair = 0; pair < 2; pair++) {
      const radius = firstRadius + pair * 7;
      const offsets = [center - radius - width / 2, center + radius - width / 2]
        .map((offset) => Math.round(offset * 1000) / 1000);
      if (!offsets.every(fits)) continue;
      for (const offset of offsets) {
        const opening = { ...template, id: `w:0:${edge}:${accepted.length * 2}`, offset, width };
        delete opening.damage;
        accepted.push(opening);
      }
    }
    if (accepted.length === 0 && !entrance && fits(center - width / 2)) {
      accepted.push({ ...template, id: `w:0:${edge}:0`, offset: Math.round((center - width / 2) * 1000) / 1000, width });
    }
    floor.openings.push(...accepted);
  }
}
