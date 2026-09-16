# Corporate sectors

Builds four distinct corporate facades with a joined lower rim, fixed facade limits and a deep LED entrance canopy.

- In: [FamilyInput](../api.ts), CCW rectangle, floor pitches, seed and fixed-face flag.
- Out: [FamilyPlan and DecorationContext](../api.ts), exported as `family` from `index.ts`.
- Dependencies: [building families](../CONTRACT.md), host glazing, formed coverings, scenery, doors and Materials.

## Dimensions

The complete model fits inside the input parcel. The body reserves 3.5 m on every side for projections; free dimensions fit whole 2 m repeats around 15 m of fixed frontage. Minimum parcel: 24 x 24 m. Fixed connection faces keep their input coordinates, while the visible body and window recesses share the 3.5 m inset. Structural backing is 3.6 m inward. Floor pitches are unchanged, at least 3.5 m; at least five floors are required.

Ground has an opaque 4.5 m default storey with a 6 m entrance field. The next three floors have 1 m slit-window cells. A single 2 m projecting rim finishes this lower block. All four rim corners meet at shared miters. The entrance canopy projects 3.25 m, covers at least 18 m where the face permits, and carries a continuous cyan LED edge and underside fixtures.

The next front block has a fixed left wing of two 2 m panel columns, 3 m high courses, a central repeat of 2 m dual-window fields with separate stepped end borders, and one fixed right 9 m cassette. Viewed from outside, the cassette's left third is opaque and its two right thirds have narrow covered windows. Its enclosed body has a folded lower lip. The low central windows start 0.3 m above each floor; upper windows start 1.18 m below the next floor.

The following front blocks use recessed window fields and projecting pale shields. The adjacent side has its own pale shield field; each has one mechanical strip at its right limit. Windows and shields repeat in 2 m cells. The fourth face has dark dual-window fields. The opposite face holds one portrait screen and window flanks. Upper blocks have no projecting separator roofs. Pale panels use a 1 x 0.75 m grid with shared origins across floor slices and stepped shield boundaries.

Upper groups cover 3 to 6 floors where possible; the final group takes the remainder. Decorative cassettes have no traversable balcony doors. Invalid rectangles, small plates and invalid pitches throw `RangeError`.

## Decoration

Openings, door cassettes and bridge cuts remain clear. A bridge intersecting the screen suppresses it. Existing sources provide two ornamental trees where entrance planters fit. Cyan emitters publish 1,200 lm at the base and 1,800 lm beneath the canopy, each with a 10 m range. Original floor and bridge elevations remain authoritative.

Materials use `cyberpunk/<name>/mid`: `corporate-panel#native`, `ivory-panel#cool-grey` for upper shields, `paired-frame-metal#surface`, `paired-cladding-metal#surface`, `paired-light-cool#surface` and `corporate-screen#native`. Geometry owns panel joints and folds.

Check: `npm test -- src/families/corporate-sectors/tests/contract.test.ts`.
