import { BAY_WIDTH, BORDERS, CORNER_EXTENT } from './catalog.ts';
import type { CornerTechnique, Point, Section, SectionTechnique } from './types.ts';

/** An outline and its exact facade runs share the same ordered edge indices. */
export function sectionOutline(width: number, depth: number, corners: CornerTechnique[], bay: SectionTechnique): { outline: Point[]; sections: Section[] } {
  const vertices: Point[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  const along: Point[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const outline: Point[] = [];
  const sections: Section[] = [];
  const push = (point: Point) => { outline.push(point); return outline.length - 1; };
  const section = (edge: number, offset: number, span: number, technique: SectionTechnique, corner?: number) => {
    sections.push({ id: `s:${sections.length}`, technique, edge, offset, width: span, border: { ...BORDERS[technique] }, ...(corner === undefined ? {} : { corner }) });
  };
  for (let corner = 0; corner < 4; corner++) {
    const vertex = vertices[corner]!, prev = along[(corner + 3) % 4]!, next = along[corner]!;
    const technique = corners[corner]!;
    const radius = CORNER_EXTENT;
    const entry: Point = [vertex[0] - prev[0] * radius, vertex[1] - prev[1] * radius];
    const exit: Point = [vertex[0] + next[0] * radius, vertex[1] + next[1] * radius];
    if (technique === 'chamfered') {
      const edge = push(entry);
      section(edge, 0, Math.hypot(exit[0] - entry[0], exit[1] - entry[1]), 'chamfered-glass', corner);
    } else if (technique === 'rounded') {
      const center: Point = [entry[0] + next[0] * radius, entry[1] + next[1] * radius];
      const start = Math.atan2(entry[1] - center[1], entry[0] - center[0]);
      const segments = 12;
      for (let step = 0; step < segments; step++) {
        const angle = start + step * Math.PI / (2 * segments);
        const endAngle = start + (step + 1) * Math.PI / (2 * segments);
        const p: Point = [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
        const q: Point = [center[0] + radius * Math.cos(endAngle), center[1] + radius * Math.sin(endAngle)];
        section(push(p), 0, Math.hypot(q[0] - p[0], q[1] - p[1]), 'rounded-glass', corner);
      }
    }
    const edge = push(technique === 'square' ? vertex : exit);
    const length = corner % 2 === 0 ? width : depth;
    let offset = 0;
    if (technique === 'square') {
      section(edge, offset, radius, 'corner-leg', corner);
      offset += radius;
    }
    const count = Math.round((length - 2 * radius) / BAY_WIDTH);
    for (let b = 0; b < count; b++) {
      section(edge, offset, BAY_WIDTH, bay);
      offset += BAY_WIDTH;
    }
    if (corners[(corner + 1) % 4] === 'square') section(edge, offset, radius, 'corner-leg', (corner + 1) % 4);
  }
  return { outline, sections };
}
