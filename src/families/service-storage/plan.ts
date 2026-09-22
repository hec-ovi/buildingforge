import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';
import { dimensions as d } from './dimensions.ts';

/** One section grid owns solid piers, sealed ground shutters and upper windows. */
export function plan(input: FamilyInput): FamilyPlan {
  const { rectangle, floorHeights, fixedFaces } = input;
  if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError('service-storage requires four finite rectangle corners');
  }
  if (floorHeights.length < 1 || floorHeights.length > 3
    || floorHeights.some(h => !Number.isFinite(h) || h < d.minimumFloorHeight)) {
    throw new RangeError('service-storage requires 1–3 floors, each at least 3 m high');
  }
  const [a, b, c, e] = rectangle;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = Math.hypot(e[0] - a[0], e[1] - a[1]);
  const u: Point = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const v: Point = [(e[0] - a[0]) / depth, (e[1] - a[1]) / depth];
  if (!Number.isFinite(width + depth) || Math.min(width, depth) < d.minimumSide
    || Math.abs(u[0] * v[0] + u[1] * v[1]) > 1e-7
    || u[0] * v[1] - u[1] * v[0] < 0.999999
    || Math.hypot(c[0] - b[0] - e[0] + a[0], c[1] - b[1] - e[1] + a[1]) > 1e-7) {
    throw new RangeError('service-storage requires a CCW rectangle at least 16 × 16 m');
  }
  const fit = (length: number) => fixedFaces ? length : Math.floor((length - 2 * d.inset + 1e-8) * 2) / 2;
  const w = fit(width), h = fit(depth);
  const point = (x: number, z: number): Point => [
    a[0] + u[0] * ((width - w) / 2 + x) + v[0] * ((depth - h) / 2 + z),
    a[1] + u[1] * ((width - w) / 2 + x) + v[1] * ((depth - h) / 2 + z),
  ];
  const outline: Point[] = fixedFaces ? rectangle.map(p => [...p]) : [point(0, 0), point(w, 0), point(w, h), point(0, h)];
  return {
    grid: 0.5, extent: { width: w, depth: h }, corners: ['square', 'square', 'square', 'square'],
    groups: [{ id: 0, fromFloor: 0, toFloor: floorHeights.length - 1, width: w, depth: h }],
    floors: floorHeights.map((height, floor) => ({
      floor, group: 0, outline: outline.map(p => [...p]), balconySections: [],
      sections: [w, h, w, h].flatMap((length, edge) => sections(length, edge, floor, height, !!fixedFaces)),
    })),
  };
}

function sections(length: number, edge: number, floor: number, height: number, fixed: boolean): FamilySection[] {
  const count = Math.max(1, Math.floor((length - d.entrance - 2 * d.pier + 1e-8) / (d.targetShutter + d.pier)));
  const shutterWidth = (length - d.entrance - (count + 2) * d.pier) / count;
  const result: FamilySection[] = [];
  let offset = 0;
  const add = (width: number, kind: 'pier' | 'sealed-shutter' | 'entrance') => {
    const glazed = floor > 0 && kind !== 'pier';
    result.push({
      id: `service-storage:${edge}:${result.length}:${glazed ? 'window' : kind}`, edge, offset, width,
      technique: kind === 'pier' || kind === 'sealed-shutter' && floor === 0 ? 'paired-solid' : 'paired-glass',
      border: { side: d.windowSide, bottom: floor === 0 ? 0.08 : d.windowSill,
        top: floor === 0 ? 0.35 : d.windowHead, depth: fixed ? 0 : d.projection },
      windows: glazed ? [{ offset: d.windowSide, width: width - 2 * d.windowSide, sill: d.windowSill,
        height: height - d.windowSill - d.windowHead, panes: { cols: Math.max(1, Math.ceil((width - 2 * d.windowSide) / 1.5)), rows: 1 } }] : [],
    });
    offset += width;
  };
  add(d.pier, 'pier');
  for (let bay = 0; bay < count; bay++) { add(shutterWidth, 'sealed-shutter'); add(d.pier, 'pier'); }
  add(d.entrance, 'entrance');
  add(d.pier, 'pier');
  return result;
}
