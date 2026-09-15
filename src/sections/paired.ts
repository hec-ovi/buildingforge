import type { Architecture, Point, Section } from './types.ts';

export const ROOM_WIDTH = 5;
export const PAIR_WIDTH = 2 * ROOM_WIDTH;
export const END_TRIM = 0.5;
export const ROUNDED_RADIUS = 10;

export function isPaired(architecture?: string): boolean {
  return architecture === 'paired-rounded' || architecture === 'paired-rectangular';
}

export function pairedExtent(maximum: number): number {
  return 2 * END_TRIM + PAIR_WIDTH * Math.floor((maximum - 2 * END_TRIM + 1e-8) / PAIR_WIDTH);
}

/** Complete glazed/solid room pairs share one frame grid and one silhouette. */
export function pairedOutline(width: number, depth: number, architecture: Architecture): { outline: Point[]; sections: Section[] } {
  const rounded = architecture === 'paired-rounded';
  const radius = rounded ? ROUNDED_RADIUS : 0;
  const outline: Point[] = [[0, 0], [width, 0]];
  if (rounded) {
    for (let i = 0; i <= 18; i++) {
      const angle = i * Math.PI / 36;
      outline.push([width - radius + radius * Math.cos(angle), depth - radius + radius * Math.sin(angle)]);
    }
  } else outline.push([width, depth]);
  outline.push([0, depth]);
  const sections: Section[] = [];
  const add = (edge: number, offset: number, span: number, technique: Section['technique']) => {
    const section: Section = {
      id: `s:${sections.length}`, edge, offset, width: span, technique,
      border: { side: technique === 'paired-glass' ? 0.04 : 0.03, bottom: 0.22, top: 0.28, depth: 0.12 },
    };
    sections.push(section);
    return section;
  };
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge]!, b = outline[(edge + 1) % outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rounded && edge >= 2 && edge < 20) {
      const slice = edge - 2;
      const section = slice % 3 === 0 ? add(edge, 0, 3 * length, 'rounded-glass') : sections.at(-1)!;
      section.corner = 2;
      section.spans ??= [];
      section.spans.push({ edge, offset: 0, width: length, sectionOffset: (slice % 3) * length });
      continue;
    }
    add(edge, 0, END_TRIM, 'paired-pier');
    const count = Math.round((length - 2 * END_TRIM) / PAIR_WIDTH);
    for (let pair = 0; pair < count; pair++) {
      add(edge, END_TRIM + pair * PAIR_WIDTH, PAIR_WIDTH, pair % 2 === 0 ? 'paired-glass' : 'paired-solid');
    }
    add(edge, length - END_TRIM, END_TRIM, 'paired-pier');
  }
  return { outline, sections };
}
