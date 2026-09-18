import { BANDS, KIT, PIECES, type Band, type PieceKind } from './module.ts';
import type { BuiltPiece } from './piece.ts';
import type { DoorRecord, P3, PieceOpening, SignAnchor } from './types.ts';

export interface KitPieceFile {
  id: string;
  kind: PieceKind;
  band: Band;
  file: string;
  /** Geometry bounds extents, including decoration, in metres. */
  size: P3;
  origin: 'corner-at-floor' | 'run-start-at-floor';
  signAnchors: SignAnchor[];
  doors: DoorRecord[];
  openings: PieceOpening[];
  triangles: number;
  bytes: number;
}

export interface KitFamily {
  id: string;
  pieces: KitPieceFile[];
  bands: {
    ground: { floor: 0; height: number };
    middle: { firstFloor: 1; lastFloor: 'floors-2'; height: number };
    crown: { floor: 'floors-1'; height: number };
  };
  fits: {
    /** N for an edge of 8N metres, containing N-1 straight pieces. */
    bays: { minimum: 2; maximum: null; step: 1 };
    floors: { minimum: 3; maximum: null; step: 1 };
    atlasLots: [number, number][];
  };
}

export interface KitCatalog {
  seed: string;
  module: typeof KIT & { bands: typeof BANDS; pieces: typeof PIECES };
  families: KitFamily[];
}

export function pieceFile(built: BuiltPiece, bytes: number): KitPieceFile {
  const { manifest, mb } = built;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const part of mb.parts) for (const prim of part.prims.values()) {
    for (const index of prim.indices) for (let axis = 0; axis < 3; axis++) {
      const value = prim.positions[index * 3 + axis]! + (part.pivot?.[axis] ?? 0);
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
    }
  }
  return {
    id: manifest.id, kind: manifest.piece, band: manifest.band,
    file: `${manifest.family}/${manifest.band}-${manifest.piece}.glb`,
    size: min.map((v, i) => Number((max[i]! - v).toFixed(5))) as P3,
    origin: manifest.piece === 'corner' ? 'corner-at-floor' : 'run-start-at-floor',
    signAnchors: manifest.signAnchors, doors: manifest.doors, openings: manifest.openings,
    triangles: manifest.geometry.triangles, bytes,
  };
}
