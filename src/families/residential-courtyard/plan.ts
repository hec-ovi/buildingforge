import type { FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';

/** The front setback is an actual circulation reserve for the host's floor-connected stairs. */
export function plan(input: FamilyInput): FamilyPlan {
  const { rectangle: r, floorHeights, fixedFaces } = input;
  if (r.length !== 4 || r.some(p => p.length !== 2 || p.some(n => !Number.isFinite(n)))
    || floorHeights.length < 2 || floorHeights.some(h => !Number.isFinite(h) || h < 2.6)) {
    throw new RangeError('residential-courtyard requires a finite rectangle and at least two floors of 2.6 m');
  }
  const x: Point = [r[1][0] - r[0][0], r[1][1] - r[0][1]], z: Point = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
  const rawWidth = Math.hypot(...x), rawDepth = Math.hypot(...z);
  if (rawWidth <= 0 || rawDepth <= 0 || Math.abs(x[0] * z[0] + x[1] * z[1]) > 1e-6
    || x[0] * z[1] - x[1] * z[0] <= 0
    || Math.hypot(r[2][0] - r[0][0] - x[0] - z[0], r[2][1] - r[0][1] - x[1] - z[1]) > 1e-6) {
    throw new RangeError('residential-courtyard requires four CCW rectangle corners');
  }
  const width = rawWidth - (fixedFaces ? 0 : 1.3), depth = rawDepth - (fixedFaces ? 0 : 4.65);
  if (width < 16 - 1e-8 || depth < 16 - 1e-8) {
    throw new RangeError('residential-courtyard needs a 16 m building behind its 4 m front circulation reserve');
  }
  const world = ([a, b]: Point): Point => [r[0][0] + x[0] / rawWidth * (a + .65) + z[0] / rawDepth * (b + 4),
    r[0][1] + x[1] / rawWidth * (a + .65) + z[1] / rawDepth * (b + 4)];
  const outline = fixedFaces ? r.map(p => [...p] as Point) : ([[0, 0], [width, 0], [width, depth], [0, depth]] as Point[]).map(world);
  const groups = [{ id: 0, fromFloor: 0, toFloor: floorHeights.length - 1, width, depth }];
  const floors = floorHeights.map((height, floor) => {
    const sections: FamilySection[] = [];
    for (let edge = 0; edge < 4; edge++) {
      const length = edge % 2 === 0 ? width : depth, bays = Math.max(4, Math.round(length / 4.5));
      const bayWidth = length / bays;
      for (let bay = 0; bay < bays; bay++) sections.push({
        id: `rc:${edge}:${bay}`, edge, offset: bay * bayWidth, width: bayWidth, technique: 'paired-glass',
        border: { side: .7, bottom: .92, top: .62, depth: .16 }, panes: { cols: 3, rows: 2 },
        windows: floor === 0 ? [] : [{ offset: .7, width: bayWidth - 1.4, sill: .92, height: height - 1.54, panes: { cols: 3, rows: 2 } }],
      });
    }
    return { floor, group: 0, outline: outline.map(p => [...p] as Point), sections, balconySections: [] };
  });
  return { grid: .5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'], groups, floors };
}
