import type { FamilyInput, FamilyPlan, FamilySection, Point, WindowField } from '../api.ts';

const TRIM = 0.5;
const SETBACK = 1.5;

function fit(input: FamilyInput): { outline: Point[]; width: number; depth: number } {
  const r = input.rectangle;
  if (r.length !== 4 || r.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw new RangeError('Corporate sectors require a finite rectangle.');
  const x: Point = [r[1][0] - r[0][0], r[1][1] - r[0][1]];
  const z: Point = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
  const w = Math.hypot(...x), d = Math.hypot(...z);
  if (x[0] * z[1] - x[1] * z[0] <= 0 || Math.abs(x[0] * z[0] + x[1] * z[1]) > 1e-6 * w * d || Math.hypot(r[2][0] - r[1][0] - z[0], r[2][1] - r[1][1] - z[1]) > 1e-6) throw new RangeError('Corporate sectors require four CCW rectangle corners.');
  const inset = input.fixedFaces ? 0 : SETBACK;
  const width = w - inset * 2, depth = d - inset * 2;
  if (Math.min(width, depth) < 17) throw new RangeError('Corporate sectors require 17 m shell faces, plus a 1.5 m perimeter when faces are not fixed.');
  const point = (u: number, v: number): Point => [r[0][0] + x[0] * u / w + z[0] * v / d, r[0][1] + x[1] * u / w + z[1] * v / d];
  return { width, depth, outline: input.fixedFaces ? r.map(p => [...p]) : [point(inset, inset), point(w - inset, inset), point(w - inset, d - inset), point(inset, d - inset)] };
}

function windowPair(width: number, height: number): WindowField[] {
  return [
    { offset: 0.22, width: width - 0.44, sill: 0.3, height: 0.32, panes: { cols: Math.max(1, Math.round(width / 3)), rows: 1 } },
    { offset: 0.22, width: width - 0.44, sill: height - 1.18, height: 0.72, panes: { cols: Math.max(1, Math.round(width / 3)), rows: 1 } },
  ];
}

class FaceSections {
  readonly values: FamilySection[] = [];
  private offset = 0;
  private readonly floor: number;
  private readonly edge: number;
  constructor(floor: number, edge: number) { this.floor = floor; this.edge = edge; }
  add(kind: string, width: number, windows: WindowField[] = [], depth = 0.18): void {
    this.values.push({ id: `corporate:${this.floor}:${this.edge}:${kind}:${this.values.length}`, technique: windows.length ? 'paired-glass' : 'paired-solid', edge: this.edge, offset: this.offset, width, border: { side: 0.18, bottom: 0.22, top: 0.22, depth }, windows });
    this.offset += width;
  }
}

function face(floor: number, group: number, localFloor: number, edge: number, length: number, height: number): FamilySection[] {
  const out = new FaceSections(floor, edge);
  if (floor === 0) {
    out.add('ground-panel', (length - 6) / 2);
    out.add('entry', 6);
    out.values[1]!.technique = 'paired-glass';
    out.add('ground-panel', (length - 6) / 2);
    return out.values;
  }
  out.add('end', TRIM);
  const usable = length - 2 * TRIM;
  if (group === 0) {
    const count = Math.max(1, Math.floor(usable / 1.5));
    for (let i = 0; i < count; i++) out.add('podium-slit', usable / count, [{ offset: 0.16, width: usable / count - 0.32, sill: height - 1.1, height: 0.7 }]);
  } else if (edge === 0) {
    const repeats = Math.max(1, Math.round(usable / 28));
    const unit = usable / (repeats * 7);
    for (let i = 0; i < repeats; i++) {
      out.add('large-panel', unit * 2);
      out.add('recessed-slit', unit, windowPair(unit, height), 0.8);
      out.add('spacer', unit);
      out.add('cassette', unit * 3, [1, 2].map(j => ({ offset: unit * j + 0.18, width: unit - 0.36, sill: height - 1.75, height: 0.9, panes: { cols: 1, rows: 1 } })), 0.16);
    }
  } else if (edge === 2) {
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
    out.add('screen', usable * 0.68);
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
  } else {
    const repeats = Math.max(1, Math.round(usable / 28));
    const unit = usable / (repeats * 7);
    for (let i = 0; i < repeats; i++) {
      out.add('side-pier', unit * 0.3);
      const lowerHalf = localFloor < 2;
      out.add('side-window', unit * (lowerHalf ? 3.2 : 1.6), windowPair(unit * (lowerHalf ? 3.2 : 1.6), height), 0.55);
      out.add('mask-panel', unit * (lowerHalf ? 2.6 : 4.2));
      out.add('mechanical', unit * 0.9, [], 0.65);
    }
  }
  out.add('end', TRIM);
  return out.values;
}

export function plan(input: FamilyInput): FamilyPlan {
  if (input.floorHeights.length < 5 || input.floorHeights.some(h => !Number.isFinite(h) || h < 3.5)) throw new RangeError('Corporate sectors require at least five floors and 3.5 m floor pitches.');
  const { outline, width, depth } = fit(input);
  const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 3, width, depth }];
  for (let start = 4; start < input.floorHeights.length;) {
    const remaining = input.floorHeights.length - start;
    const count = remaining <= 6 ? remaining : remaining === 7 ? 3 : 4;
    groups.push({ id: groups.length, fromFloor: start, toFloor: start + count - 1, width, depth });
    start += count;
  }
  return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups,
    floors: input.floorHeights.map((height, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const sections = [width, depth, width, depth].flatMap((length, edge) => face(floor, group.id, floor - group.fromFloor, edge, length, height));
      if (input.fixedFaces && floor >= 4) for (const section of sections) section.border.depth += 1.45;
      return { floor, group: group.id, outline: outline.map(p => [...p]), balconySections: [], sections };
    }),
  };
}
