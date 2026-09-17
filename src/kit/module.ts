// The repeating module every family's piece set is authored on.
//
// Atlas lot dimensions are multiples of 8 m, so an edge of 8N metres is two
// corner arms of 4 m and N-1 bays of 8 m. Nothing is stretched to fit.
//
// Two authoring rules make the pieces tile without a visible joint:
//  - a run boundary falls in the middle of a joint pier, and the two halves
//    omit their end faces, so neighbours fuse into one pier;
//  - a band boundary falls in the middle of the floor ribbon, and the two
//    halves omit their cap faces, so bands fuse into one ribbon.

export const KIT = {
  /** One repeating facade bay. */
  bay: 8,
  /** Each arm of a corner piece, measured along its edge. */
  cornerArm: 4,
  /** Default storey pitch when the caller gives none. */
  floorHeight: 4.5,
  /** Total height of the floor ribbon that straddles a band boundary. */
  ribbon: 0.3,
} as const;

export const BANDS = ['ground', 'middle', 'crown'] as const;
export const PIECES = ['corner', 'bay', 'entrance-bay'] as const;
export type Band = typeof BANDS[number];
export type PieceKind = typeof PIECES[number];

/** Bays along one edge: 8N metres is two corner arms and N-1 bays. */
export function baysAcross(metres: number): number {
  const n = metres / KIT.bay;
  if (!Number.isInteger(n) || n < 2) {
    throw new RangeError(`a kit edge is a whole number of ${KIT.bay} m bays, at least two: ${metres} m`);
  }
  return n;
}

/** The three bands of a building of `floors` storeys, top to bottom counts. */
export function bandStack(floors: number): { ground: 1; middle: number; crown: 1 } {
  if (!Number.isInteger(floors) || floors < 3) throw new RangeError(`a kit building needs at least three floors: ${floors}`);
  return { ground: 1, middle: floors - 2, crown: 1 };
}
