import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';

/** The outer frame groups three occupied floors; glazing always follows actual floors. */
export function plan({ rectangle, floorHeights, fixedFaces }: FamilyInput): FamilyPlan {
  if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError('industrial-framed requires four finite rectangle corners');
  }
  if (floorHeights.length < 3 || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
    throw new RangeError('industrial-framed requires at least three floors at least 3 m high');
  }
  const [a, b, c, d] = rectangle;
  const ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - a[0], vz = d[1] - a[1];
  const w = Math.hypot(ux, uz), h = Math.hypot(vx, vz);
  if (w < 16 || h < 16 || ux * vz - uz * vx <= 0 ||
      Math.abs(ux * vx + uz * vz) > 1e-7 * w * h ||
      Math.hypot(c[0] - b[0] - vx, c[1] - b[1] - vz) > 1e-7) {
    throw new RangeError('industrial-framed needs a CCW rectangle at least 16 m on each side');
  }
  const inset = fixedFaces ? 0 : 1;
  const width = w - inset * 2, depth = h - inset * 2;
  const point = (u: number, v: number): Point => [a[0] + ux * u / w + vx * v / h, a[1] + uz * u / w + vz * v / h];
  const outline: Point[] = fixedFaces ? rectangle.map(p => [...p]) :
    [point(inset, inset), point(w - inset, inset), point(w - inset, h - inset), point(inset, h - inset)];
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 0, width, depth }];
  for (let from = 1; from < floorHeights.length; from += 3) groups.push({ id: groups.length,
    fromFloor: from, toFloor: Math.min(from + 2, floorHeights.length - 1), width, depth });
  return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: floorHeights.map((height, floor) => ({ floor, group: floor ? Math.floor((floor - 1) / 3) + 1 : 0,
      outline: outline.map(p => [...p]), balconySections: [],
      sections: [width, depth, width, depth].flatMap((length, edge) => sections(length, edge, floor, height)) })) };
}

function sections(length: number, edge: number, floor: number, height: number): FamilySection[] {
  const pier = 1, count = Math.max(1, Math.floor((length - pier) / 9));
  const clear = (length - pier * (count + 1)) / count;
  const spine = clear * 0.4, glazed = (clear - spine) / 2;
  const result: FamilySection[] = [];
  let offset = 0;
  const add = (width: number, role: 'pier' | 'glass' | 'brace') => {
    const side = 0.16, bottom = 0.5, top = 0.6;
    result.push({ id: `industrial-framed:${edge}:${result.length}:${role}`, edge, offset, width,
      technique: role === 'glass' ? 'paired-glass' : 'paired-solid',
      border: { side, bottom, top, depth: 0.18, ...(floor > 0 ? { surfaceDepth: 0.12 } : {}) },
      windows: floor > 0 && role === 'glass' ? [{ offset: side, width: width - side * 2,
        sill: bottom, height: height - bottom - top, panes: { cols: Math.max(1, Math.floor(width / 1.2)), rows: 1 } }] : [] });
    offset += width;
  };
  add(pier, 'pier');
  for (let bay = 0; bay < count; bay++) {
    add(glazed, 'glass'); add(spine, 'brace'); add(glazed, 'glass'); add(pier, 'pier');
  }
  return result;
}
