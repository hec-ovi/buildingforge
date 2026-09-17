// The order a shell sheds detail when it does not fit its geometry budget.
//
// Every step removes a feature that repeats per module, cheapest to the eye
// first, so a dense building keeps its massing, openings, frames and glazing and
// loses fittings before it loses architecture. The blueprint records which steps
// were taken.

export const SIMPLIFICATION = [
  /** Door handles, AC brackets and grille housings, small facade artifacts. */
  'fittings',
  /** Sill and jamb grime strips. */
  'weathering',
  /** The closed return around a window covering and its rails. */
  'housings',
  /** The mullion grid inside a glazed field: the pane becomes one light. */
  'mullions',
  /** Blinds, curtains and exterior louvre screens. */
  'coverings',
  /** Ceiling fixtures inside scenic rooms; the room keeps its surfaces. */
  'fixtures',
  /** Facade relief bands, ribs and panel divisions. */
  'relief',
] as const;

export type DetailStep = typeof SIMPLIFICATION[number];

export type DetailSet = ReadonlySet<DetailStep>;

export const FULL_DETAIL: DetailSet = new Set<DetailStep>();

/** The set after taking `count` steps of the ladder. */
export function simplifiedTo(count: number): DetailSet {
  return new Set(SIMPLIFICATION.slice(0, count));
}
