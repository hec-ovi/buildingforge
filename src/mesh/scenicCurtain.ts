import type { PartSink } from './primitives.ts';
import type { RoomFrame } from './scenicFixtures.ts';

/** Pleated fabric hangs behind the blind plane, on two independently drawn panels. */
export function scenicCurtain(sink: PartSink, frame: RoomFrame, width: number, bottom: number, top: number, depth: number,
  closure: number, material: string): void {
  const panelWidth = Math.max(0.12, width * closure / 200);
  for (const start of [0, width - panelWidth]) {
    const folds = Math.max(3, Math.ceil(panelWidth / 0.07));
    for (let i = 0; i < folds * 2; i++) {
      const a = start + panelWidth * i / (folds * 2), b = start + panelWidth * (i + 1) / (folds * 2);
      const za = depth - (i % 2) * 0.06, zb = depth - ((i + 1) % 2) * 0.06;
      sink.quadFacing(material, frame.point(a, bottom + 0.05, za), frame.point(b, bottom + 0.05, zb),
        frame.point(b, top - 0.08, zb), frame.point(a, top - 0.08, za), [frame.normal[0], 0, frame.normal[1]],
        [[a, 1], [b, 1], [b, 0], [a, 0]]);
    }
  }
}
