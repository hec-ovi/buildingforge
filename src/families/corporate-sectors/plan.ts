import type { FamilyInput, FamilyPlan } from '../api.ts';
import { fit } from './fit.ts';
import { face } from './sections.ts';

export function plan(input: FamilyInput): FamilyPlan {
  if (input.floorHeights.length < 5 || input.floorHeights.some(h => !Number.isFinite(h) || h < 3.5)) throw new RangeError('Corporate sectors require at least five floors and 3.5 m floor pitches.');
  const { outline, width, depth, inset } = fit(input);
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 3, width, depth }];
  for (let start = 4; start < input.floorHeights.length;) {
    const remaining = input.floorHeights.length - start;
    const count = Math.min(4, remaining);
    groups.push({ id: groups.length, fromFloor: start, toFloor: start + count - 1, width, depth });
    start += count;
  }
  return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: input.floorHeights.map((height, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const sections = [width, depth, width, depth].flatMap((length, edge) => face(floor, group.id, edge, length, height, inset));
      return { floor, group: group.id, outline: outline.map(p => [...p]), balconySections: [], sections };
    }),
  };
}
