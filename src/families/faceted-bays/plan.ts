import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';
import { DIMENSIONS as D } from './dimensions.ts';

type Kind = 'cheek' | 'front' | 'panel' | 'slit' | 'trim' | 'entry';
interface Run { edge: number; offset: number; width: number; kind: Kind; face: number; module: number }
interface Profile { outline: Point[]; runs: Run[] }

/** A whole 12 m facade cell keeps the three-plane bay and narrow pier together. */
export class FacetedBayPlanner {
  plan(input: FamilyInput): FamilyPlan {
    const frame = this.frame(input);
    const fit = (length: number) => 2 * D.setback + D.module * Math.floor((length - 2 * D.margin - 2 * D.setback + 1e-8) / D.module);
    const width = input.fixedFaces ? frame.width : fit(frame.width);
    const depth = input.fixedFaces ? frame.depth : fit(frame.depth);
    if (Math.min(width, depth) < 2 * D.setback + D.module) throw new RangeError('faceted-bays needs one 12 m bay cell plus end piers on each face');
    const shift: Point = input.fixedFaces ? [0, 0] : [(frame.width - width) / 2, (frame.depth - depth) / 2];
    const world = ([x, z]: Point): Point => [
      input.rectangle[0][0] + frame.u[0] * (x + shift[0]) + frame.v[0] * (z + shift[1]),
      input.rectangle[0][1] + frame.u[1] * (x + shift[0]) + frame.v[1] * (z + shift[1]),
    ];
    const groups = [{ id: 0, fromFloor: 0, toFloor: 0, width, depth }];
    for (let start = 1; start < input.floorHeights.length; start += D.groupFloors) groups.push({
      id: groups.length, fromFloor: start, toFloor: Math.min(start + D.groupFloors - 1, input.floorHeights.length - 1), width, depth,
    });
    const ground = this.flat(width, depth, true);
    const upper = input.fixedFaces ? this.flat(width, depth, false) : this.faceted(width, depth);
    const floors = input.floorHeights.map((height, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const profile = floor === 0 ? ground : upper;
      const plinth = floor === group.fromFloor && group.toFloor > floor;
      const outline = input.fixedFaces ? input.rectangle.map(p => [...p] as Point) : profile.outline.map(world);
      const sections = profile.runs.map(run => this.section(run, height, floor, plinth));
      return { floor, group: group.id, outline, sections, balconySections: [] };
    });
    return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups, floors };
  }

  private frame(input: FamilyInput): { width: number; depth: number; u: Point; v: Point } {
    const { rectangle: r, floorHeights } = input;
    if (r.length !== 4 || r.some(p => p.length !== 2 || p.some(n => !Number.isFinite(n)))
      || floorHeights.length < 2 || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
      throw new RangeError('faceted-bays needs a finite rectangle and at least two floors of 3 m or more');
    }
    const x: Point = [r[1][0] - r[0][0], r[1][1] - r[0][1]], z: Point = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
    const width = Math.hypot(...x), depth = Math.hypot(...z);
    if (width <= 0 || depth <= 0 || Math.abs(x[0] * z[0] + x[1] * z[1]) > 1e-6
      || x[0] * z[1] - x[1] * z[0] <= 0
      || Math.hypot(r[2][0] - r[0][0] - x[0] - z[0], r[2][1] - r[0][1] - x[1] - z[1]) > 1e-6) {
      throw new RangeError('faceted-bays requires four CCW rectangle corners');
    }
    return { width, depth, u: [x[0] / width, x[1] / width], v: [z[0] / depth, z[1] / depth] };
  }

  private flat(width: number, depth: number, ground: boolean): Profile {
    const outline: Point[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
    const runs: Run[] = [];
    for (let face = 0; face < 4; face++) {
      const length = face % 2 === 0 ? width : depth;
      const count = Math.floor((length - 2 * D.setback) / D.module + 1e-8);
      const trim = (length - count * D.module) / 2;
      runs.push({ edge: face, offset: 0, width: trim, kind: 'trim', face, module: -1 });
      for (let module = 0; module < count; module++) {
        let offset = trim + module * D.module;
        const cells: [Kind, number][] = ground ? [['entry', 8], ['panel', 3], ['slit', 1]]
          : [['cheek', D.cheek], ['front', D.front], ['cheek', D.cheek], ['panel', D.panel], ['slit', D.slit]];
        for (const [kind, span] of cells) {
          runs.push({ edge: face, offset, width: span, kind, face, module });
          offset += span;
        }
      }
      runs.push({ edge: face, offset: length - trim, width: trim, kind: 'trim', face, module: -1 });
    }
    return { outline, runs };
  }

  private faceted(width: number, depth: number): Profile {
    const outline: Point[] = [], runs: Run[] = [];
    const point = (face: number, u: number, inward: number): Point => face === 0 ? [u, inward]
      : face === 1 ? [width - inward, u] : face === 2 ? [width - u, depth - inward] : [inward, depth - u];
    for (let face = 0; face < 4; face++) {
      const length = face % 2 === 0 ? width : depth;
      const count = Math.round((length - 2 * D.setback) / D.module);
      let u = D.setback;
      const add = (next: Point, kind: Kind, module: number) => {
        const current = outline.at(-1)!;
        runs.push({ edge: outline.length - 1, offset: 0, width: Math.hypot(next[0] - current[0], next[1] - current[1]), kind, face, module });
        outline.push(next);
      };
      if (face === 0) outline.push(point(face, u, D.setback));
      for (let module = 0; module < count; module++) {
        add(point(face, u + D.cheek, D.setback - D.cheek), 'cheek', module);
        u += D.cheek;
        add(point(face, u + D.front, D.setback - D.cheek), 'front', module);
        u += D.front;
        add(point(face, u + D.cheek, D.setback), 'cheek', module);
        u += D.cheek;
        add(point(face, u + D.panel, D.setback), 'panel', module);
        u += D.panel;
        add(point(face, u + D.slit, D.setback), 'slit', module);
        u += D.slit;
      }
    }
    outline.pop();
    return { outline, runs };
  }

  private section(run: Run, height: number, floor: number, plinth: boolean): FamilySection {
    const glazing = floor > 0 && (run.kind === 'slit' || !plinth && (run.kind === 'cheek' || run.kind === 'front'));
    const side = run.kind === 'slit' ? 0.3 : 0.055;
    const bottom = run.kind === 'slit' ? 0.85 : D.sill;
    const top = run.kind === 'slit' ? 0.85 : D.head;
    return {
      id: `fb:${run.face}:${run.module}:${run.edge}:${run.offset}:${run.kind}`,
      edge: run.edge, offset: run.offset, width: run.width,
      technique: glazing || floor === 0 && run.kind === 'entry' ? 'paired-glass' : 'paired-solid',
      border: { side: run.kind === 'slit' ? 0.035 : side, bottom, top, depth: run.kind === 'slit' ? 0.32 : 0.12 },
      windows: glazing ? [{ offset: side, width: run.width - 2 * side, sill: bottom, height: height - bottom - top }] : [],
    };
  }
}
