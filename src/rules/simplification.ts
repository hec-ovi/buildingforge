// The order a shell sheds detail when it does not fit its geometry budget.
//
// Every step removes repeat detail, cheapest to the eye first. Form is never on
// this list: massing, bays, piers, cassettes, wings, slots, ribbons, chamfers,
// curved corners, setbacks, tapers, openings, frames, mullions and glazing are
// what the building is, and they stay whatever the shell costs. The blueprint
// records which steps were taken.

export const SIMPLIFICATION = [
  /** Door handles and AC bracket struts. */
  'fittings',
  /** Sill and jamb grime strips. */
  'weathering',
  /** The closed return around a window covering and its rails. */
  'housings',
  /** Ceiling fixtures inside scenic rooms; the room keeps its surfaces and its emitters. */
  'fixtures',
  /** Blinds, curtains and exterior louvre screens. */
  'coverings',
] as const;

export type DetailStep = typeof SIMPLIFICATION[number];

export type DetailSet = ReadonlySet<DetailStep>;

export const FULL_DETAIL: DetailSet = new Set<DetailStep>();

/** The set after taking `count` steps of the ladder. */
export function simplifiedTo(count: number): DetailSet {
  return new Set(SIMPLIFICATION.slice(0, count));
}
