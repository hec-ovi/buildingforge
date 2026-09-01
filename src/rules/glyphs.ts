// Glyph cells for modular signage: which material a letter quad wears and which
// cell of the letter atlas it shows.

import { SIGNAGE } from './tables.ts';

const ATLAS = SIGNAGE.letterAtlas;
const BLANK = ATLAS.charset.indexOf(' ');

/** Material kind a glyph quad uses. */
export function glyphKind(): string {
  return ATLAS.kind;
}

/** Cell index of a character, uppercased; anything off the charset is the blank cell. */
function glyphIndex(char: string): number {
  const index = ATLAS.charset.indexOf(char.toUpperCase());
  return index < 0 ? BLANK : index;
}

/**
 * [u0, v0, u1, v1] of a character's cell. V follows the glTF convention the
 * meshes already use: row 0 sits at v = 0 and rows run downwards, so v0 is the
 * top edge of the cell and the glyph stands upright on the quad.
 */
export function glyphUv(char: string): [number, number, number, number] {
  const index = glyphIndex(char);
  const col = index % ATLAS.cols;
  const row = Math.floor(index / ATLAS.cols);
  return [col / ATLAS.cols, row / ATLAS.rows, (col + 1) / ATLAS.cols, (row + 1) / ATLAS.rows];
}

/** A blank cell reserves its width in the text but carries no glyph, so it gets no quad. */
export function isBlank(char: string): boolean {
  return glyphIndex(char) === BLANK;
}
