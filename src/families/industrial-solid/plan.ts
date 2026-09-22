import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';

/** Broad enclosed sections expose only real, floor-aligned horizontal slot windows. */
export function plan({ rectangle, floorHeights, fixedFaces }: FamilyInput): FamilyPlan {
  if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError('industrial-solid requires four finite rectangle corners');
  }
  if (floorHeights.length < 3 || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
    throw new RangeError('industrial-solid requires at least three floors at least 3 m high');
  }
  const [a, b, c, d] = rectangle;
  const ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - a[0], vz = d[1] - a[1];
  const w = Math.hypot(ux, uz), h = Math.hypot(vx, vz);
  if (w < 16 || h < 16 || ux * vz - uz * vx <= 0 ||
      Math.abs(ux * vx + uz * vz) > 1e-7 * w * h ||
      Math.hypot(c[0] - b[0] - vx, c[1] - b[1] - vz) > 1e-7) {
    throw new RangeError('industrial-solid needs a CCW rectangle at least 16 m on each side');
  }
  const inset = fixedFaces ? 0 : 1, width = w - inset * 2, depth = h - inset * 2;
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
  const support = 2.2, count = Math.max(1, Math.floor((length - support) / 11));
  const field = (length - support * (count + 1)) / count;
  const result: FamilySection[] = [];
  let offset = 0;
  const add = (width: number, pier: boolean) => {
    const side = 0.22, sill = Math.min(1.65, height * 0.43), slotHeight = Math.min(0.62, height * 0.18);
    const slotCount = Math.max(2, Math.floor(width / 2.7)), pitch = (width - side * 2) / slotCount;
    result.push({ id: `industrial-solid:${edge}:${result.length}:${pier ? 'support' : 'slots'}`, edge, offset, width,
      technique: pier ? 'paired-solid' : 'paired-glass',
      border: { side, bottom: 0.4, top: 0.6, depth: 0.2, ...(floor > 0 ? { surfaceDepth: 0.12 } : {}) },
      windows: floor > 0 && !pier ? Array.from({ length: slotCount }, (_, i) => ({
        offset: side + i * pitch + 0.16, width: pitch - 0.32, sill, height: slotHeight, panes: { cols: 1, rows: 1 } })) : [] });
    offset += width;
  };
  add(support, true);
  for (let bay = 0; bay < count; bay++) { add(field, false); add(support, true); }
  return result;
}
