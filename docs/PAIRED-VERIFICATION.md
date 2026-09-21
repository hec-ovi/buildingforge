# Paired exterior verification

Exterior 0.58.13 keeps one permanent inner facade on all seven reviewed architectures.
Removing `scenery:<floor>` removes the rear room image, fixtures and coverings while
preserving finished window jambs, heads and sills through the full published wall depth.
The existing measured `roomEnvelope` remains the construction limit for Interior
partitions; it does not define a second enclosing facade.

Scenic side, floor and ceiling surfaces are clipped behind the permanent lining.
Clipping follows the actual placed backing plane on tapered wings, rather than
assuming a constant unsloped inset. Corporate's 3.72 m lining can supply the whole
one-metre scenic room side; its removable rear image and fixtures remain at their
authored glass-relative depth. No additional lining overlays are needed in Interior.

## Reviewed source examples

The canonical requests are exported by `tests/family-fixtures.ts`. Coordinates below
are parcel dimensions, not fitted shell extents. Every complete assembly respects its
family's bay arithmetic, forecourt allowance and core feasibility.

| Architecture | Canonical parcel | Floors | Additional checked parcel | Floors |
| --- | --- | ---: | --- | ---: |
| balcony-grid | 70.5 × 32 m | 13 | 20.5 × 37.5 m, and transposed | 3, 7 |
| corporate-sectors | 51 × 39 m | 12 | 51 × 51 m | 16 |
| faceted-bays | 42 × 30 m | 10 | 40.5 × 28.5 m | 7 |
| garden-taper | 52 × 42 m | 4 | 42 × 62 m | 4 |
| mirror-frame | 35 × 27 m | 8 | 28 × 44 m | 7 |
| mirror-shutters | 54 × 34 m | 10 | 49 × 34 m | 7 |
| white-grid | 32.5 × 17.5 m | 7 | 32.5 × 47.5 m | 4 |

The default pitch is 4.5 m; white-grid has a 5 m ground floor. Garden's tapered wings
require at least 0.3 m of side setback per metre of rise and sufficient width for the
fixed planted spine. The canonical four-floor example narrows its tower from 49 m to
25 m at the roof. Higher floor counts must be accompanied by a wider base.

## Checks

`tests/window-lining.test.ts` ray-checks permanent jamb/head/sill surfaces through
actual exported meshes, with scenery present and removed, including curved balcony
glazing, multi-row corporate windows, deep mirror slots and angled faceted bays.
Every straight family is checked at the canonical dimensions and a second dimensions /
floor-count combination. Mitred adjacent faces meet on one shared boundary; the
check does not require a duplicate return beyond that boundary. Garden additionally
checks permanent tapered returns, no overlapping scenic surfaces and one rear image
at the one-metre depth.

`tests/family-host.test.ts` checks every registered family, preserved material variants,
roof housing/core alignment, entrance motion and glazing clearances. Its supported
32 × 24 m / 8-floor samples cover balcony-grid, faceted-bays, mirror-frame,
mirror-shutters and white-grid; corporate uses 40 × 40 m / 12 floors.

`tests/frame-ring.test.ts`, `fixed-face-shell.test.ts`, `garden-taper.test.ts`,
`geometry-budget.test.ts` and `glb-textures.test.ts` cover closed frames, exact supplied
cuts, tapered wing geometry, mesh budgets and material exports. The balcony family
regression also requires the rounded corner to continue through the podium.
