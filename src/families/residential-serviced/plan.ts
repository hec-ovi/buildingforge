import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';

function dimensions(input: FamilyInput): { width: number; depth: number } {
  const { rectangle: r, floorHeights } = input;
  if (r.length !== 4 || r.some(p => p.length !== 2 || !p.every(Number.isFinite)) ||
      floorHeights.length < 3 || floorHeights.some(h => !Number.isFinite(h) || h < 2.6)) {
    throw new RangeError('residential-serviced requires four rectangle corners and at least three floors of 2.6 m');
  }
  const [a, b, c, d] = r, u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - a[0], d[1] - a[1]];
  const width = Math.hypot(...u), depth = Math.hypot(...v);
  if (width < 16 || depth < 16 || u[0]! * v[1]! - u[1]! * v[0]! <= 0 ||
      Math.abs(u[0]! * v[0]! + u[1]! * v[1]!) > 1e-7 * width * depth ||
      Math.hypot(c[0] - b[0] - v[0]!, c[1] - b[1] - v[1]!) > 1e-7) {
    throw new RangeError('residential-serviced needs a CCW rectangle at least 16 m on each side');
  }
  return { width, depth };
}

function footprint(input: FamilyInput, width: number, depth: number): Point[] {
  if (input.fixedFaces) return input.rectangle.map(p => [...p]);
  const inset = 0.8, radius = 4, [a, b, , d] = input.rectangle;
  const local: Point[] = [[inset, inset], [width - inset - radius, inset]];
  for (let step = 1; step <= 4; step++) {
    const angle = -Math.PI / 2 + step * Math.PI / 8;
    local.push([width - inset - radius + radius * Math.cos(angle), inset + radius + radius * Math.sin(angle)]);
  }
  local.push([width - inset, depth - inset], [inset, depth - inset]);
  return local.map(([u, v]) => [a[0] + (b[0] - a[0]) * u / width + (d[0] - a[0]) * v / depth,
    a[1] + (b[1] - a[1]) * u / width + (d[1] - a[1]) * v / depth]);
}

function section(edge: number, index: number, offset: number, width: number, role: string,
  floor: number, height: number, inset: number): FamilySection {
  const side = role === 'corner' ? 0.12 : 0.19, sill = 1.12, head = 0.42;
  return { id: `serviced:${edge}:${index}:${role}`, edge, offset, width,
    technique: role === 'pier' ? 'paired-solid' : 'paired-glass',
    border: { side, bottom: sill, top: head, depth: inset + 0.15, surfaceDepth: inset },
    windows: floor > 0 && role !== 'pier' ? [{ offset: side, width: width - side * 2,
      sill, height: height - sill - head, panes: { cols: role === 'corner' ? 2 : 3, rows: 2 } }] : [] };
}

function sections(outline: Point[], floor: number, height: number, inset: number): FamilySection[] {
  return outline.flatMap((a, edge) => {
    const b = outline[(edge + 1) % outline.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (outline.length === 8 && edge >= 1 && edge <= 4) return [section(edge, 0, 0, length, 'corner', floor, height, inset)];
    const count = Math.max(2, Math.round((length - 0.74) / 4.05)), pier = 0.74;
    const bay = (length - (count + 1) * pier) / count, result: FamilySection[] = [];
    let offset = 0;
    for (let i = 0; i <= count * 2; i++) {
      const solid = i % 2 === 0, width = solid ? pier : bay;
      result.push(section(edge, i, offset, width, solid ? 'pier' : 'bay', floor, height, inset));
      offset += width;
    }
    return result;
  });
}

/** One rounded corner is a continuous four-facet window ribbon; every row is an actual floor. */
export function plan(input: FamilyInput): FamilyPlan {
  const { width, depth } = dimensions(input), outline = footprint(input, width, depth);
  const inset = input.fixedFaces ? 0 : 0.8, extent = { width: width - inset * 2, depth: depth - inset * 2 };
  return { grid: 0.5, extent, corners: ['square', input.fixedFaces ? 'square' : 'rounded', 'square', 'square'],
    groups: input.floorHeights.map((_, floor) => ({ id: floor, fromFloor: floor, toFloor: floor, ...extent })),
    floors: input.floorHeights.map((height, floor) => ({ floor, group: floor, outline: outline.map(p => [...p]),
      sections: sections(outline, floor, height, input.fixedFaces ? 0.62 : 0.12), balconySections: [] })) };
}
