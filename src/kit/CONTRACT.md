# CONTRACT: piece kit

Authors each registered family once as a set of repeated pieces, and places those pieces around a lot.

A building is not generated per parcel here. Nine pieces per family carry the whole family, and a lot decides how many times each one repeats.

## Call and schemas

From `src/index.ts`, beside the per-parcel `generate`, which is unchanged:

- `buildPieceMesh(PieceRequest): {mb, manifest}` and `buildPiece(PieceRequest, TextureOptions?): Promise<PieceResult>` build one piece.
- `pieceSet(family, seed?): PieceManifest[]` builds all nine.
- `planAssembly(AssemblyRequest): AssemblyPlan` decides which piece stands where, without geometry.
- `assembleFromPieces(AssemblyRequest, TextureOptions?): Promise<AssemblyResult>` also writes the GLB.
- Types: [types.ts](types.ts). Module constants: [module.ts](module.ts). Recipe surface: [recipe.ts](recipe.ts).
- `KIT_FAMILIES` lists the families that have a set: `corporate-sectors`, `faceted-bays`, `white-grid`, `balcony-grid`, `mirror-shutters`, `mirror-frame`.

## The module

`corner`, `bay` and `entrance-bay`, each in the `ground`, `middle` and `crown` band: nine pieces.

A bay is 8 m. A corner has two 4 m arms, one on each edge it turns. An edge of 8N metres is therefore two corner arms and N-1 bays, and Atlas lot sizes (16, 24, 32, 40, 56 m) are 2, 3, 5 and 7 bays. `baysAcross` refuses anything else. A building of F floors is one ground band, F-2 middle bands and one crown, so `bandStack` needs at least three floors. A middle band repeats any number of times; a bay repeats any number of times between two corners.

Piece frame: +X is the run of the first arm, +Y is up, +Z is inward, origin at the run start on the walking surface. A corner's second arm leaves the same origin along +Z. `Placement` gives a translation and a turn about +Y, so one mesh draws every instance.

## How the pieces tile

Two authoring rules, and `PieceManifest.sections` publishes the evidence as four hashes of the merged outline the piece presents on each boundary plane.

- A run boundary falls in the middle of a joint pier, mullion, panel course or glazed cell, and each half leaves off the face its neighbour supplies. `sections.start` equals `sections.end` for every piece of a band, so any piece of that band meets any other. Material is part of the horizontal section: pieces of one band share their finishes.
- A band boundary falls in the middle of the floor ribbon, and each half leaves off the cap the band above or below supplies. `ground.top`, `middle.bottom`, `middle.top` and `crown.bottom` are equal per piece kind. `ground.bottom` is the street and `crown.top` is the sky, so both are free.

The measured result on a 56 x 40 m, 20 floor assembly of each family: no coincident face pair anywhere, and scanning the outer facade plane at every 0.05 m of height finds no uncovered interval narrower than 0.12 m, so no joint leaves a sliver.

## What a piece carries and what it does not

A piece carries its own skin, its openings and glazing, its inner lining and its family decoration. It does not carry signage: `signAnchors` publishes each sign field as a position, a width and height on the facing plane, and an outward unit normal, and the consumer letters the building. It does not carry floor plates either: those belong to the building.

The entrance-bay ground piece carries `door:<id>/frame` and `door:<id>/leaf:<n>`, each leaf on its own hinge node. `assembleFromPieces` places it once and writes those nodes in building coordinates, so they stay addressable. It also writes `floor:<index>/slab` per storey, `roof:deck`, and `anchor:<id>` for each requested wire anchor.

Glazing is a host role. A recipe's `materials` are the registered family's own role slots plus the shared `glass` key.

Same family, band, piece and seed give byte-identical geometry and GLB bytes. No randomness is drawn today; the seeded stream is there for per-instance variation later.

## What each family's set looks like

| Family | The 8 m bay | The corner | Crown |
| --- | --- | --- | --- |
| corporate-sectors | two 2 m panel columns meeting at the boundary in a 0.04 m joint, around a 4 m bank recessed 1 m with slit windows and a projecting cassette | the panel wing turning the angle, one column per 2 m | pale ivory shield on the 2 m panel grid under a closed metal top |
| faceted-bays | 1 m ivory pier split by the boundary, then a three-plane glass bay: 1.5 m cheeks at 45 degrees and a 4 m front between concrete sill and head | ivory panel column with the family's 0.4 m vertical slot | 0.32 m concrete cap |
| white-grid | 1.5 m ivory pier split by the boundary, 6.5 m of glazing in four panes, one 0.14 m ivory brace across it, reflective floor ribbons | ivory column with its own glazed return | 0.28 m ivory cap |
| balcony-grid | 1 m pier split by the boundary, a 3 m loggia recessed 2 m with rail and deck, a 1 m dividing pier and a 3 m paired glazed room | 3.5 m coated metal end pier | 0.3 m concrete cap |
| mirror-shutters | a 3 m service spine with three 0.55 m windows between the two halves of a 5 m ribbon cell, bronze mullions at 0.625 m with a half bar on the boundary | bronze bank handing over to the ribbon | 0.5 m continuous cornice |
| mirror-frame | 3 m graphite pier split by the boundary and a 5 m slot glazed 0.65 m back | solid graphite end pier | 0.73 m stepped pier head |

Two references are re-proportioned to the 8 m module and say so here. faceted-bays authors its 12 m reference cell as 8 m, keeping every element and their order. balcony-grid authors its 17 m reference repeat as 8 m the same way. white-grid's reference brace crosses a three-floor group; a middle band has to tile at any floor count, so the brace spans one bay per storey and the bays read as one continuous ivory diagonal.

## Errors

`ExteriorError` with `E_SCHEMA` for an unknown family, a non-positive band height or an anchor on a missing edge, and `E_MATERIAL_UNRESOLVED` for a role a family does not define. `RangeError` for a lot that is not a whole number of 8 m bays, or fewer than three floors.

## Dependencies

- [Building families](../families/CONTRACT.md): each recipe takes its dimensions and material roles from the registered family it authors.
- [Exterior](../../CONTRACT.md): welding, measurement and material resolution.
- [Materials](../../../materials/CONTRACT.md): catalog slots.
- Check: `npm test -- tests/kit.test.ts`.
