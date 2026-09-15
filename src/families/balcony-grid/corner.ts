import type { FamilySection, Point } from '../api.ts';

export const CORNER_RADIUS = 5;
export const CORNER_SLICES = 12;

/** Four window fields follow a quarter circle, each spanning three mesh slices. */
export function glazedCorner(rectangle: Point[], outline: Point[], sections: FamilySection[]): void {
  const a = rectangle[0]!, b = rectangle[1]!, c = rectangle[2]!;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const x: Point = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const z: Point = [(c[0] - b[0]) / depth, (c[1] - b[1]) / depth];
  const center: Point = [c[0] - CORNER_RADIUS * (x[0] + z[0]), c[1] - CORNER_RADIUS * (x[1] + z[1])];
  const chord = 2 * CORNER_RADIUS * Math.sin(Math.PI / (4 * CORNER_SLICES));
  for (let slice = 0; slice < CORNER_SLICES; slice++) {
    const angle = slice * Math.PI / (2 * CORNER_SLICES);
    const edge = outline.length;
    outline.push([center[0] + CORNER_RADIUS * (x[0] * Math.cos(angle) + z[0] * Math.sin(angle)),
      center[1] + CORNER_RADIUS * (x[1] * Math.cos(angle) + z[1] * Math.sin(angle))]);
    if (slice % 3 === 0) sections.push({ id: `bg:corner:curve:${slice / 3}`, edge, offset: 0, width: chord * 3,
      technique: 'paired-glass', corner: 2, panes: { cols: 1, rows: 1 }, spans: [],
      border: { side: 0.025, bottom: 0.25, top: 0.25, depth: 0.12 } });
    sections.at(-1)!.spans!.push({ edge, offset: 0, width: chord, sectionOffset: slice % 3 * chord });
  }
}
