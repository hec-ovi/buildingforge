import { isFamilyArchitecture } from '../families/registry.ts';
import { isPaired } from '../sections/index.ts';
import { scenicState } from '../layout/scenicState.ts';
import type { FloorLayout, Layout } from '../layout/model.ts';
import type { Opening, P2 } from '../types.ts';
import { FacadeField } from './facadeField.ts';
import type { PartSink, V3 } from './primitives.ts';

/** Scenic windows divide shell-owned exterior reveals from removable interior returns. */
export function windowReturnProfile(layout: Layout, floor: FloorLayout, edge: number, wallDepth: number): (a: P2, b: P2) => { front: number; depth: number } | undefined {
  const shared = isPaired(layout.assembly?.architecture) || isFamilyArchitecture(layout.assembly?.architecture);
  const windows = floor.openings.filter(opening => opening.edge === edge && opening.kind === 'window' && opening.glazing);
  return (a, b) => {
    const u = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    for (const opening of windows) {
      const left = opening.offset, right = left + opening.width;
      const bottom = floor.elevation + opening.sill, top = bottom + opening.height;
      const horizontal = Math.abs(a[1] - b[1]) < 1e-7 && (Math.abs(y - bottom) < 1e-7 || Math.abs(y - top) < 1e-7)
        && u > left - 1e-7 && u < right + 1e-7;
      const vertical = Math.abs(a[0] - b[0]) < 1e-7 && (Math.abs(u - left) < 1e-7 || Math.abs(u - right) < 1e-7)
        && y > bottom - 1e-7 && y < top + 1e-7;
      if (horizontal || vertical) {
        const section = floor.assembly?.sections.find(s => s.id === opening.sectionId);
        const scenic = shared && floor.index > 0 && section
          && scenicState(layout.request.seed, floor.index, section.id, section.technique === 'rounded-glass').state !== 'dark';
        return { front: -(section?.border.surfaceDepth ?? 0), depth: scenic ? Math.min(wallDepth, opening.glazing!.glassDepth) : wallDepth };
      }
    }
    return undefined;
  };
}

/** Interior reveal faces meet the room mouth at the resolved shell lining plane. */
export function meshScenicLining(sink: PartSink, floor: FloorLayout, opening: Opening, wallDepth: number, state: 'lit' | 'dim'): void {
  const glassDepth = opening.glazing!.glassDepth;
  if (wallDepth - glassDepth < 1e-7) return;
  const frame = new FacadeField(floor.outline, opening.edge);
  const u0 = opening.offset, u1 = u0 + opening.width;
  const y0 = floor.elevation + opening.sill, y1 = y0 + opening.height;
  const faces: [P2, P2, 'floor' | 'ceiling' | 'wall'][] = [
    [[u1, y0], [u0, y0], 'floor'], [[u0, y1], [u1, y1], 'ceiling'],
    [[u0, y0], [u0, y1], 'wall'], [[u1, y1], [u1, y0], 'wall'],
  ];
  for (const [a, b, surface] of faces) {
    if (surface === 'wall' && (Math.abs(a[0]) < 1e-7 || Math.abs(a[0] - frame.length) < 1e-7)) continue;
    const normal: V3 = [frame.dir[0] * (b[1] - a[1]), a[0] - b[0], frame.dir[1] * (b[1] - a[1])];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const material = `cyberpunk/paired-room-${surface}${state === 'lit' ? '' : '-' + state}/mid#surface`;
    sink.quadFacing(material, frame.point(a[0], a[1], -glassDepth), frame.point(b[0], b[1], -glassDepth),
      frame.point(b[0], b[1], -wallDepth), frame.point(a[0], a[1], -wallDepth), normal,
      [[0, 0], [length, 0], [length, wallDepth - glassDepth], [0, wallDepth - glassDepth]]);
  }
}
