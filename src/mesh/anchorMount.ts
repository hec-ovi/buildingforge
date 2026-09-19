import type { MeshBuilder } from './primitives.ts';
import type { AnchorMount } from '../layout/anchors.ts';

/** Addressable wire attachment at its published world position. */
export function meshAnchorMount(builder: MeshBuilder, anchor: AnchorMount): void {
  builder.part(`anchor:${anchor.id}`, { pivot: anchor.position, keepNode: true });
}
