import type { Floor, Opening } from '../types.ts';
import { POCKET, pocketLeafBounds } from '../layout/pocketDoor.ts';
import type { FrameBasis } from './frameRing.ts';
import { meshDoorPanels, meshDoorRibs } from './doorPanels.ts';
import { meshDoorSurround } from './doorSurround.ts';
import { cutWall, rectHole } from './wallcut.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';

/** Closed skins leave a continuous lateral throat at the moving leaf plane. */
export function meshPocketDoor(
  builder: MeshBuilder, basis: FrameBasis, floor: Floor, opening: Opening, material: (kind: string) => string,
): void {
  const door = opening.door!;
  if (door.motion.kind !== 'pocket') return;
  const cassette = door.cassette!, passage = door.clearance!;
  const first = door.motion.leaves[0]!.pocket;
  const a = cassette.offset, b = a + cassette.width;
  const u0 = passage.offset, u1 = u0 + passage.width;
  const y0 = floor.elevation + cassette.sill, y1 = y0 + cassette.height;
  const head = floor.elevation + passage.sill + passage.height;
  const chamberBottom = floor.elevation + first.sill;
  const chamberTop = chamberBottom + first.height;
  const front = first.frontDepth, back = first.backDepth;
  const base = `door:${opening.id}`;
  builder.part(base);
  const skins = builder.part(`${base}/cassette`, { parent: base });
  const box = (lo: number, hi: number, bottom: number, top: number, near: number, far: number, key: string) =>
    faceBox(skins, basis, lo, hi, bottom, top, near, far, material(key));

  // Front and rear fields partition the rough opening, with no wall behind them.
  for (const [lo, hi] of [[a, u0], [u1, b]] as [number, number][]) {
    box(lo, hi, y0, y1, 0, front, 'ground');
    box(lo, hi, y0, y1, back, cassette.backDepth, 'window-frame');
    box(lo, hi, y0, chamberBottom, front, back, 'window-frame');
  }
  box(u0, u1, head, y1, 0, front, 'ground');
  box(u0, u1, head, y1, back, cassette.backDepth, 'window-frame');
  // End caps and header close the cavity without putting a jamb across its slot.
  box(a, a + POCKET.skin, chamberBottom, chamberTop, front, back, 'window-frame');
  box(b - POCKET.skin, b, chamberBottom, chamberTop, front, back, 'window-frame');
  box(a, b, chamberTop, y1, front, back, 'window-frame');

  const frame = builder.part(`${base}/frame`, { parent: base });
  meshDoorSurround(frame, basis, u0, u1, floor.elevation + passage.sill, head,
    door.frameWidth, door.frameDepth, material('window-frame'));
  for (const leaf of door.motion.leaves) {
    const [lo, hi] = pocketLeafBounds(opening.offset, opening.width, door.motion.leaves.length, leaf.leaf);
    const bottom = floor.elevation + opening.sill + POCKET.bottom;
    const top = floor.elevation + opening.sill + opening.height + POCKET.overlap;
    const pivot = point(basis, (lo + hi) / 2, bottom, door.recessDepth + POCKET.leafThickness / 2);
    const sink = builder.part(`${base}/leaf:${leaf.leaf}`, { parent: base, pivot });
    const handle = leaf.travelU < 0 ? hi - 0.085 : lo + 0.03;
    recessedLeaf(sink, basis, lo, hi, bottom, top, door.recessDepth, handle, material('door'), material('window-frame'));
    meshDoorPanels(sink, basis, lo, hi, bottom, top, door, material('door'));
    meshDoorRibs(sink, basis, lo, hi, bottom, top, door, material('window-frame'));
  }
}

function point(basis: FrameBasis, u: number, y: number, inward: number): V3 {
  return [basis.v[0] + basis.dir[0] * u - basis.n[0] * inward, y,
    basis.v[1] + basis.dir[1] * u - basis.n[1] * inward];
}

function faceBox(
  sink: PartSink, basis: FrameBasis, a: number, b: number, bottom: number, top: number,
  front: number, back: number, material: string,
): void {
  if (b <= a || top <= bottom || back <= front) return;
  sink.box(material, point(basis, (a + b) / 2, (bottom + top) / 2, (front + back) / 2),
    [basis.dir[0] * (b - a) / 2, 0, basis.dir[1] * (b - a) / 2], [0, (top - bottom) / 2, 0],
    [basis.n[0] * (back - front) / 2, 0, basis.n[1] * (back - front) / 2]);
}

/** Solid leaf with a real recessed finger cup cut into its front, beside the pressed panel. */
function recessedLeaf(
  sink: PartSink, basis: FrameBasis, a: number, b: number, bottom: number, top: number,
  front: number, handle: number, material: string, hardware: string,
): void {
  const width = 0.055, height = 0.28, y = bottom + Math.min(1.0, (top - bottom) * 0.45);
  const back = front + POCKET.leafThickness, cup = front + 0.018;
  const normal: V3 = [basis.n[0], 0, basis.n[1]];
  const quad = (lo: number, hi: number, low: number, high: number, depth: number, key: string, outward: V3) =>
    sink.quadFacing(key, point(basis, lo, low, depth), point(basis, hi, low, depth),
      point(basis, hi, high, depth), point(basis, lo, high, depth), outward,
      [[lo - a, top - low], [hi - a, top - low], [hi - a, top - high], [lo - a, top - high]]);
  for (const piece of cutWall(b - a, bottom, top, [rectHole(handle - a, y, width, height)])) {
    const corners = [piece.bl, piece.br, piece.tr, piece.tl];
    sink.quadFacing(material, ...corners.map(([u, v]) => point(basis, u + a, v, front)) as [V3, V3, V3, V3],
      normal, corners.map(([u, v]) => [u, top - v] as [number, number]));
  }
  quad(a, b, bottom, top, back, material, [-normal[0], 0, -normal[2]]);
  quad(handle, handle + width, y, y + height, cup, hardware, normal);
  const rim = (lo: number, hi: number, low: number, high: number, near: number, far: number, inward: boolean, key: string) => {
    const corners: [number, number][] = [[lo, low], [hi, low], [hi, high], [lo, high]];
    for (let i = 0; i < 4; i++) {
      const from = corners[i]!, to = corners[(i + 1) % 4]!;
      const du = to[0] - from[0], dy = to[1] - from[1];
      const direction = inward ? -1 : 1;
      const facing: V3 = [basis.dir[0] * dy * direction, -du * direction, basis.dir[1] * dy * direction];
      const length = Math.hypot(du, dy);
      sink.quadFacing(key, point(basis, ...from, near), point(basis, ...to, near),
        point(basis, ...to, far), point(basis, ...from, far), facing,
        [[0, 0], [length, 0], [length, far - near], [0, far - near]]);
    }
  };
  rim(a, b, bottom, top, front, back, false, material);
  rim(handle, handle + width, y, y + height, front, cup, true, hardware);
}
