// Glyph cells for modular signage: which material a letter quad wears and which
// part of it the quad shows. With no letter atlas published the quad takes the
// whole emissive signage map, which reads as a lit letter cell.

import { SIGNAGE } from './tables.ts';

/** Material kind a glyph quad uses. */
export function glyphKind(): string {
  return SIGNAGE.letterAtlas?.kind ?? 'signage';
}

/** [u0, v0, u1, v1] of one character in the atlas, or the full quad without one. */
export function glyphUv(char: string): [number, number, number, number] {
  const atlas = SIGNAGE.letterAtlas;
  if (!atlas) return [0, 0, 1, 1];
  const index = atlas.charset.indexOf(char.toUpperCase());
  if (index < 0) return [0, 0, 1, 1];
  const col = index % atlas.cols;
  const row = Math.floor(index / atlas.cols);
  return [col / atlas.cols, row / atlas.rows, (col + 1) / atlas.cols, (row + 1) / atlas.rows];
}

/** A space reserves its cell but carries no glyph. */
export function isBlank(char: string): boolean {
  return char.trim().length === 0;
}
