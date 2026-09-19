# Corporate sectors

Builds two complete corporate feature faces, one screen face and one exposed window/service face.

- In: [FamilyInput](../api.ts), CCW rectangle, floor pitches, seed and fixed-face flag.
- Out: [FamilyPlan and DecorationContext](../api.ts), exported as `family` from `index.ts`.
- Dependencies: [building families](../CONTRACT.md), host glazing, formed coverings, scenery, doors and Materials.

## Dimensions

The family requires a parcel of at least 35 x 35 m and twelve floors, enough for the lower, balcony and upper-panel blocks. Automatic selection skips smaller candidates. The body reserves 3.5 m on every side for projections; both free dimensions fit whole 2 m repeats around 26 m of fixed frontage. Fixed connection faces keep their input coordinates, while the visible body and window recesses share the 3.5 m inset. Structural backing is 3.6 m inward. Floor pitches are unchanged, at least 3.5 m; the default 4.5 m pitches require 54 m for twelve floors.

Ground has an opaque 4.5 m default storey with a 6 m entrance field. Two framed portrait displays flank the entrance where reservations permit; `adScreens: off` omits these displays. The next three floors have 1 m slit cells over 2 m panel columns with 1.5 m courses. A single 2 m projecting rim finishes this lower block. All four rim corners meet at shared miters. The entrance canopy projects 3.25 m, covers at least 18 m where the face permits, and carries a continuous cyan LED edge and underside fixtures.

Faces 0 and 1 have the complete composition. Their next block has a fixed left wing of two 2 m panel columns in 3 m courses. Central 2 m repeats form one recessed bank: equal 0.32 m-high windows sit 0.3 m from the floor and upper boundary. The bank sits 1 m behind the body plane, with 0.75 m end reveals and a 1.5 m spacer before the balcony.

The lower block has a closed metal top beneath that recess. Published end-reveal profiles keep each upper slab behind its sloped trim.

The right limit has three fixed 6 m pieces sharing an 18 m balcony front, 2.4 m high and projecting 1.25 m. The left third is opaque. The right two thirds have one 11.8 x 1.2 m opening with two glazing panes. The glazed area has no upper cap or deep vertical partitions. A continuous apron has a 0.25 m lower fold and closed end returns; only the opaque left part has a 0.14 m top bevel. The shared window scenery owns the single interior covering; balcony geometry adds no outer blind.

Their upper blocks retain a complete window grid beneath a connected, stepped pale cover. Each four-floor composition spans broad groups of windows, varies the exposed area by row, and has a small deliberate opening in its upper sheet. Cover edges overlap different portions of the 3 m right service strip. Pale panel joints share a 3 x 3 m grid across floor slices and outline steps. Cover panels intentionally occlude windows; doors and connection apertures remain clear.

Face 2 holds one portrait screen and window flanks. Face 3 has the full window grid and exposed services without covering panels. Service strips have continuous pipes, ladder trays, cable bundles, brackets, cabinets and connecting branches. Upper blocks have no projecting separator roofs.

Upper groups cover four floors; the final group takes the remainder. Decorative cassettes have no traversable balcony doors. Invalid rectangles, small plates and invalid pitches throw `RangeError`.

## Decoration

Door cassettes and bridge cuts remain clear in both cladding and services. A bridge intersecting the screen suppresses it. Existing sources provide two ornamental trees where entrance planters fit. Cyan emitters publish 1,200 lm at the base and 1,800 lm beneath the canopy, each with a 10 m range. Original floor and bridge elevations remain authoritative.

Materials use `cyberpunk/<name>/mid`: `corporate-panel#joints`, `ivory-panel#cool-grey` for upper shields, `paired-frame-metal#surface`, `paired-cladding-metal#surface`, `paired-light-cool#surface` and `corporate-screen#native`. Corporate cladding uses world metre UVs and the variant's 3 x 3 m repeat for 1 x 1.5 m modules with 32 mm joints. Geometry supplies grouped panel boundaries and folds.

Check: `npm test -- src/families/corporate-sectors/tests/contract.test.ts`.
