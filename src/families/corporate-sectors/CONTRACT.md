# Corporate sectors

Builds four distinct corporate facades with a joined lower rim, fixed facade limits and a deep LED entrance canopy.

- In: [FamilyInput](../api.ts), CCW rectangle, floor pitches, seed and fixed-face flag.
- Out: [FamilyPlan and DecorationContext](../api.ts), exported as `family` from `index.ts`.
- Dependencies: [building families](../CONTRACT.md), host glazing, formed coverings, scenery, doors and Materials.

## Dimensions

The family decoration fits inside the input parcel. The body reserves 3.5 m on every side for projections; free front dimensions fit whole 2 m repeats around 26 m of fixed frontage. Minimum parcel: 35 x 24 m. Fixed connection faces keep their input coordinates, while the visible body and window recesses share the 3.5 m inset. Structural backing is 3.6 m inward. Floor pitches are unchanged, at least 3.5 m; at least five floors are required.

Ground has an opaque 4.5 m default storey with a 6 m entrance field. The next three floors have 1 m slit-window cells. A single 2 m projecting rim finishes this lower block. All four rim corners meet at shared miters. The entrance canopy projects 3.25 m, covers at least 18 m where the face permits, and carries a continuous cyan LED edge and underside fixtures.

The next front block has a fixed left wing of two 2 m panel columns in 3 m courses. Its central 2 m repeats form one recessed bank: equal 0.32 m-high windows sit 0.3 m from the floor and the upper floor boundary. The bank's panels sit 1 m behind the body plane. Each end has a 0.75 m reveal, with a 1.5 m opaque spacer before the balcony.

The right limit has three fixed 6 m pieces sharing an 18 m balcony front, 2.4 m high and projecting 1.25 m. The left third is opaque. The right two thirds have one 11.8 x 1.2 m opening with two glazing panes and formed louver banks 0.4 m behind the front. The glazed area has no upper cap or deep vertical partitions. A continuous apron has a 0.25 m lower fold and closed end returns; only the opaque left part has a 0.14 m top bevel. Louvers retain their punched apertures and clips, and remain clear of bridges.

The following front blocks use recessed window fields and projecting pale shields. The adjacent side has its own pale shield field; each has one mechanical strip at its right limit. Windows and shields repeat in 2 m cells. The fourth face has dark dual-window fields. The opposite face holds one portrait screen and window flanks. Upper blocks have no projecting separator roofs. Pale panels use a 3 x 3 m grid with shared origins across floor slices and stepped shield boundaries.

Upper groups cover 3 to 6 floors where possible; the final group takes the remainder. Decorative cassettes have no traversable balcony doors. Invalid rectangles, small plates and invalid pitches throw `RangeError`.

## Decoration

Openings, door cassettes and bridge cuts remain clear. A bridge intersecting the screen suppresses it. Existing sources provide two ornamental trees where entrance planters fit. Cyan emitters publish 1,200 lm at the base and 1,800 lm beneath the canopy, each with a 10 m range. Original floor and bridge elevations remain authoritative.

Materials use `cyberpunk/<name>/mid`: `corporate-panel#native`, `ivory-panel#cool-grey` for upper shields, `paired-blind#surface`, `paired-frame-metal#surface`, `paired-cladding-metal#surface`, `paired-light-cool#surface` and `corporate-screen#native`. Geometry owns panel joints and folds.

Check: `npm test -- src/families/corporate-sectors/tests/contract.test.ts`.
