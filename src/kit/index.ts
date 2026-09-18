// Public entry of the piece kit.

export { KIT, BANDS, PIECES, baysAcross, bandStack, type Band, type PieceKind } from './module.ts';
export { buildPiece, buildPieceMesh, pieceId } from './piece.ts';
export { assembleFromPieces } from './assemble.ts';
export { planAssembly } from './plan.ts';
export { KIT_FAMILIES } from './recipes/index.ts';
export type {
  AssemblyPlan, AssemblyRequest, AssemblyResult, DoorRecord, Geometry, PieceManifest, PieceOpening, PieceRequest, PieceResult, Placement, SignAnchor,
} from './types.ts';

import { BANDS, PIECES } from './module.ts';
import { buildPieceMesh } from './piece.ts';
import type { PieceManifest } from './types.ts';

/** Every piece of one family: three kinds in three bands. */
export function pieceSet(family: string, seed = 'kit'): PieceManifest[] {
  return BANDS.flatMap(band => PIECES.map(piece => buildPieceMesh({ family, band, piece, seed }).manifest));
}
