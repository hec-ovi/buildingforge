import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';
import { dimensions as d } from './dimensions.ts';

/** Retains the supplied rectangle's orientation and fixed infrastructure edges. */
export function plan(input: FamilyInput): FamilyPlan {
  const { rectangle, floorHeights, fixedFaces } = input;
  if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError('portal-pier needs four finite rectangle corners');
  }
  const [a, b, c, z] = rectangle;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = Math.hypot(z[0] - a[0], z[1] - a[1]);
  const u: Point = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const v: Point = [(z[0] - a[0]) / depth, (z[1] - a[1]) / depth];
  if (!Number.isFinite(width + depth) || width < d.repeat || depth < d.repeat
    || Math.abs(u[0] * v[0] + u[1] * v[1]) > 1e-7 || u[0] * v[1] - u[1] * v[0] < 0.999999
    || Math.hypot(c[0] - b[0] - z[0] + a[0], c[1] - b[1] - z[1] + a[1]) > 1e-7) {
    throw new RangeError('portal-pier needs a CCW rectangle at least 8 m per side');
  }
  if (!floorHeights.length || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
    throw new RangeError('portal-pier storeys need at least 3 m total height');
  }
  const inset = fixedFaces ? 0 : d.reserve;
  const w = fixedFaces ? width : Math.floor((width - inset * 2 + 1e-8) * 2) / 2;
  const h = fixedFaces ? depth : Math.floor((depth - inset * 2 + 1e-8) * 2) / 2;
  if (w < d.repeat || h < d.repeat) throw new RangeError('portal-pier cannot fit one complete 8 m repeat and its relief');
  const origin: Point = [a[0] + u[0] * (width - w) / 2 + v[0] * (depth - h) / 2,
    a[1] + u[1] * (width - w) / 2 + v[1] * (depth - h) / 2];
  const point = (x: number, y: number): Point => [origin[0] + u[0] * x + v[0] * y, origin[1] + u[1] * x + v[1] * y];
  const outline: Point[] = fixedFaces ? rectangle.map(p => [...p]) : [point(0, 0), point(w, 0), point(w, h), point(0, h)];
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 0, width: w, depth: h }];
  for (let first = 1; first < floorHeights.length; first += d.groupFloors) {
    groups.push({ id: groups.length, fromFloor: first, toFloor: Math.min(first + d.groupFloors - 1, floorHeights.length - 1), width: w, depth: h });
  }
  return {
    grid: 0.5, extent: { width: w, depth: h }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: floorHeights.map((height, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const opaque = floor === 0 || floor === group.fromFloor && group.toFloor > floor;
      return { floor, group: group.id, outline: outline.map(p => [...p]), balconySections: [],
        sections: [w, h, w, h].flatMap((length, edge) => sections(length, edge, height, opaque, floor === group.toFloor, fixedFaces ?? false)) };
    }),
  };
}

function sections(length: number, edge: number, height: number, opaque: boolean, head: boolean, fixed: boolean): FamilySection[] {
  const count = Math.floor((length + 1e-8) / d.repeat);
  const end = d.pier / 2 + (length - count * d.repeat) / 2;
  const result: FamilySection[] = [];
  let offset = 0;
  const add = (width: number, slot: boolean) => {
    const top = head ? 0.9 : 0.45, bottom = 0.38, side = slot ? 0.16 : 0.025;
    result.push({ id: `portal:${edge}:${result.length}:${slot ? 'slot' : 'pier'}`, edge, offset, width,
      technique: slot ? 'paired-glass' : 'paired-solid',
      border: { side, bottom, top, depth: slot ? d.recess : fixed ? 0 : d.projection,
        ...(slot && !opaque && !fixed ? { surfaceDepth: 0.45 } : {}) },
      windows: slot && !opaque ? [{ offset: side, width: width - 2 * side, sill: bottom, height: height - top - bottom }] : [] });
    offset += width;
  };
  add(end, false);
  for (let i = 0; i < count; i++) {
    add(d.slot, true);
    add(i === count - 1 ? end : d.pier, false);
  }
  return result;
}
