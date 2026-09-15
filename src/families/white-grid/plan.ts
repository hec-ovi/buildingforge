import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';
import { dimensions as d } from './dimensions.ts';

class WhiteGridPlan {
  private readonly input: FamilyInput;

  constructor(input: FamilyInput) { this.input = input; }

  build(): FamilyPlan {
    const { rectangle, floorHeights, fixedFaces } = this.input;
    if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || !p.every(Number.isFinite))) {
      throw new RangeError('white-grid requires four finite rectangle corners');
    }
    if (floorHeights.length < 4 || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
      throw new RangeError('white-grid requires a ground floor and three upper floors, each at least 3 m high');
    }
    const [a, b, c, e] = rectangle;
    const ux = b[0] - a[0], uz = b[1] - a[1];
    const vx = e[0] - a[0], vz = e[1] - a[1];
    const maxWidth = Math.hypot(ux, uz), maxDepth = Math.hypot(vx, vz);
    const minimum = d.bay + 2 * d.pier;
    if (maxWidth < minimum || maxDepth < minimum || ux * vz - uz * vx <= 0 ||
      Math.abs(ux * vx + uz * vz) > 1e-6 * maxWidth * maxDepth ||
      Math.hypot(c[0] - b[0] - vx, c[1] - b[1] - vz) > 1e-6) {
      throw new RangeError('white-grid requires a CCW rectangle at least 16.5 m wide on both axes');
    }
    const fit = (maximum: number) => fixedFaces ? maximum :
      d.pier + (d.bay + d.pier) * Math.floor((maximum - 2 * d.inset - d.pier + 1e-8) / (d.bay + d.pier));
    const width = fit(maxWidth), depth = fit(maxDepth);
    if (Math.min(width, depth) < minimum) throw new RangeError('white-grid cannot fit a complete 13.5 m bay and its panel relief');
    const widestBay = Math.max(this.bays(width).width, this.bays(depth).width);
    const floorsPerBrace = Math.max(d.floorsPerBrace, Math.round(d.floorsPerBrace * widestBay / d.bay));
    const du = Math.floor((maxWidth - width + 1e-8)) / 2;
    const dv = Math.floor((maxDepth - depth + 1e-8)) / 2;
    const outline: Point[] = fixedFaces ? rectangle.map(p => [...p]) :
      [[du, dv], [du + width, dv], [du + width, dv + depth], [du, dv + depth]].map(([u, v]) =>
        [a[0] + ux * u! / maxWidth + vx * v! / maxDepth, a[1] + uz * u! / maxWidth + vz * v! / maxDepth]);
    const groups: FamilyPlan['groups'] = [{ id: 0, fromFloor: 0, toFloor: 0, width, depth }];
    for (let from = 1; from < floorHeights.length; from += floorsPerBrace) {
      groups.push({ id: groups.length, fromFloor: from, toFloor: Math.min(from + floorsPerBrace - 1, floorHeights.length - 1), width, depth });
    }
    const floors = floorHeights.map((height, floor) => ({
      floor, group: floor ? Math.floor((floor - 1) / floorsPerBrace) + 1 : 0,
      outline: outline.map(p => [...p] as Point),
      sections: [width, depth, width, depth].flatMap((length, edge) => this.sections(length, edge, floor, height)),
      balconySections: [],
    }));
    return { grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups, floors };
  }

  private bays(length: number): { count: number; width: number } {
    const count = Math.max(1, Math.floor((length - d.pier + 1e-8) / (d.bay + d.pier)));
    return { count, width: (length - (count + 1) * d.pier) / count };
  }

  private sections(length: number, edge: number, floor: number, height: number): FamilySection[] {
    const { count: bays, width: bayWidth } = this.bays(length);
    const sections: FamilySection[] = [];
    const add = (offset: number, width: number, pier: boolean) => sections.push({
      id: `white-grid:${edge}:${sections.length}`, edge, offset, width,
      technique: pier ? 'paired-pier' : 'paired-glass',
      border: { side: 0.035, bottom: d.sill, top: d.head, depth: 0.18 },
      windows: floor === 0 || pier ? [] : [{ offset: 0.035, width: width - 0.07, sill: d.sill,
        height: height - d.sill - d.head, panes: { cols: Math.round(8 * width / d.bay), rows: 1 } }],
    });
    for (let bay = 0; bay < bays; bay++) {
      const at = bay * (bayWidth + d.pier);
      add(at, d.pier, true);
      add(at + d.pier, bayWidth, false);
    }
    add(length - d.pier, d.pier, true);
    return sections;
  }
}

export function plan(input: FamilyInput): FamilyPlan { return new WhiteGridPlan(input).build(); }
