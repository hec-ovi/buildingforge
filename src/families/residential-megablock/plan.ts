import { Rng, type FamilyInput, type FamilyPlan, type FamilySection, type Point } from '../api.ts';
import { dimensions as d } from './dimensions.ts';

/** Broad, stacked residential slabs keep their openings on one stable bay grid. */
export function plan(input: FamilyInput): FamilyPlan {
  const { rectangle, floorHeights, fixedFaces = false } = input;
  if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError('residential-megablock needs four finite rectangle corners');
  }
  const [a, b, c, z] = rectangle;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = Math.hypot(z[0] - a[0], z[1] - a[1]);
  const u: Point = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const v: Point = [(z[0] - a[0]) / depth, (z[1] - a[1]) / depth];
  if (Math.min(width, depth) < 16 - 1e-7 || Math.max(width, depth) < 20 - 1e-7 || !Number.isFinite(width + depth)
    || Math.abs(u[0] * v[0] + u[1] * v[1]) > 1e-7
    || u[0] * v[1] - u[1] * v[0] < 0.999999
    || Math.hypot(c[0] - b[0] - z[0] + a[0], c[1] - b[1] - z[1] + a[1]) > 1e-7) {
    throw new RangeError('residential-megablock needs a CCW rectangle at least 20 by 16 m');
  }
  if (!floorHeights.length || floorHeights.some(h => !Number.isFinite(h) || h < 2.6)) {
    throw new RangeError('residential-megablock needs finite storeys at least 2.6 m high');
  }
  const w = fixedFaces ? width : Math.floor((width - 2 * d.reserve + 1e-8) * 2) / 2;
  const h = fixedFaces ? depth : Math.floor((depth - 2 * d.reserve + 1e-8) * 2) / 2;
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 0, width: w, depth: h }];
  for (let first = 1; first < floorHeights.length; first += d.groupFloors) {
    const setback = fixedFaces ? 0 : Math.min(d.maxSetback, (groups.length - 1) * d.groupSetback,
      Math.max(0, (Math.min(w, h) - 6.8) / 2));
    groups.push({ id: groups.length, fromFloor: first,
      toFloor: Math.min(first + d.groupFloors - 1, floorHeights.length - 1), width: w - 2 * setback, depth: h - 2 * setback });
  }
  // A seed chooses where the three-bay service divisions begin, not arbitrary window sizes.
  const rhythm = new Rng(input.seed, 'residential-megablock/bay-rhythm').int(0, 2);
  return {
    grid: 0.5, extent: { width: w, depth: h }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: floorHeights.map((height, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const x = (width - group.width) / 2, y = (depth - group.depth) / 2;
      const point = (s: number, t: number): Point => [a[0] + u[0] * s + v[0] * t, a[1] + u[1] * s + v[1] * t];
      const outline: Point[] = fixedFaces ? rectangle.map(p => [...p]) : [
        point(x, y), point(x + group.width, y), point(x + group.width, y + group.depth), point(x, y + group.depth),
      ];
      return { floor, group: group.id, outline, balconySections: [],
        sections: [group.width, group.depth, group.width, group.depth]
          .flatMap((length, edge) => sections(length, edge, height, floor, floor === group.toFloor, rhythm, fixedFaces)) };
    }),
  };
}

function sections(length: number, edge: number, height: number, floor: number, groupHead: boolean, rhythm: number, fixed: boolean): FamilySection[] {
  const count = Math.max(1, Math.floor((length - 2 * d.endPier) / d.bayTarget));
  const pierWidths = Array.from({ length: count - 1 }, (_, i) => (i + rhythm) % 3 === 2 ? d.servicePier : d.pier);
  const bayWidth = (length - 2 * d.endPier - pierWidths.reduce((sum, value) => sum + value, 0)) / count;
  const result: FamilySection[] = [];
  let offset = 0;
  const add = (width: number, kind: 'bay' | 'pier' | 'service' | 'end') => {
    const top = floor === 0 ? 0.4 : groupHead ? d.groupHead : d.head;
    const bottom = floor === 0 ? 0.08 : d.sill;
    const glassWidth = (width - 2 * d.side - d.windowGap) / 2;
    result.push({ id: `megablock:${edge}:${result.length}:${kind}`, edge, offset, width,
      technique: kind === 'bay' ? 'paired-glass' : 'paired-solid',
      border: { side: kind === 'bay' ? d.side : 0.025, bottom, top,
        depth: kind === 'bay' ? d.recess : fixed ? 0 : d.relief,
        ...(kind === 'bay' && fixed ? { surfaceDepth: d.relief } : {}) },
      windows: kind === 'bay' && floor > 0 ? [0, 1].map(index => ({
        offset: d.side + index * (glassWidth + d.windowGap), width: glassWidth,
        sill: bottom, height: height - bottom - top, panes: { cols: 2, rows: 2 },
      })) : [] });
    offset += width;
  };
  add(d.endPier, 'end');
  for (let bay = 0; bay < count; bay++) {
    add(bayWidth, 'bay');
    if (bay < count - 1) add(pierWidths[bay]!, pierWidths[bay] === d.servicePier ? 'service' : 'pier');
  }
  add(d.endPier, 'end');
  return result;
}
