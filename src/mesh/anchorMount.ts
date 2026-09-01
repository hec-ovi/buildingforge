// The wire anchor mount: a plate on the facade with the lug the wire hangs from.
// One node per anchor, its origin the attach point, so the game reads the wire's
// end straight off the node.

import { ANCHOR_MOUNT } from '../rules/tables.ts';
import { add, scale, type MeshBuilder, type V3 } from './primitives.ts';
import type { AnchorMount } from '../layout/anchors.ts';

export function meshAnchorMount(mb: MeshBuilder, a: AnchorMount, material: string): void {
  const sink = mb.part(`anchor:${a.id}`, { pivot: a.position });
  const n: V3 = [a.normal[0], 0, a.normal[1]];
  const along: V3 = [-a.normal[1], 0, a.normal[0]];
  const block = (side: number, back: number, depth: number) => {
    sink.box(material, add(a.position, scale(n, back + depth / 2)),
      scale(along, side / 2), [0, side / 2, 0], scale(n, depth / 2));
  };
  block(a.size, a.standoff, ANCHOR_MOUNT.thickness);
  block(ANCHOR_MOUNT.lug, a.standoff + ANCHOR_MOUNT.thickness, ANCHOR_MOUNT.lugDepth);
}
