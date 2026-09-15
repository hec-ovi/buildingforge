import type { FamilyInput, FamilyPlan } from '../api.ts';
import { DIMENSIONS as D } from './dimensions.ts';
import { footprint } from './footprint.ts';
import { sections } from './sections.ts';

export function plan(input: FamilyInput): FamilyPlan {
  if (input.floorHeights.length < 2 || input.floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
    throw new RangeError('mirror-shutters requires ground plus an upper floor, each at least 3 m');
  }
  const { outline, width, depth } = footprint(input);
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 0, width, depth }];
  for (let from = 1; from < input.floorHeights.length; from += D.groupFloors) {
    groups.push({ id: groups.length, fromFloor: from, toFloor: Math.min(from + D.groupFloors - 1, input.floorHeights.length - 1), width, depth });
  }
  return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: input.floorHeights.map((height, floor) => ({ floor,
      group: groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!.id,
      outline: outline.map(p => [...p]), balconySections: [],
      sections: outline.flatMap((_, edge) => sections(edge, edge % 2 ? depth : width, floor, height)),
    })),
  };
}
