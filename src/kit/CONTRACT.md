# CONTRACT: piece kit

Version 0.58.4. Publishes nine facade pieces per family, with openings recorded by their glazing and entrance builders; [requests](../../schemas/kit-request.schema.json) accept parcel, building and seed plus family, or legacy lot and floors.

## Calls and schemas

From `src/index.ts`: `pieceSet(family, seed?)`, `buildPieceMesh(PieceRequest)`, `buildPiece(PieceRequest, TextureOptions?)`, `planAssembly(AssemblyRequest)` and `assembleFromPieces(AssemblyRequest, TextureOptions?)`. Inputs and library results: [types.ts](types.ts). Recipes: [recipe.ts](recipe.ts).

`npm run kit -- --out <dir> [--families <a,b,...>] [--seed <seed>]` writes `<dir>/<family>/<band>-<kind>.glb` and one `<dir>/kit.json` containing the selected families. Seed defaults to `kit`; families default to all six. Selection is sorted and deduplicated. GLBs contain material keys and authored variants, with every recipe part retained. Invalid arguments exit 2; write errors exit 1.

- [Kit JSON schema](../../schemas/kit.schema.json): module constants, files, local signs and doors, geometry sizes, origins, triangle counts, actual file bytes, band heights and fits.
- [Placement JSON schema](../../schemas/placement.schema.json): exactly the JSON result of `planAssembly`, including band elevations, placements and world space signs and doors.

Both schemas use draft 2020-12. Files have no paths or timestamps tied to a machine. The same seed and family give byte identical pieces and catalog metadata. Recipes use fixed geometry for every seed.

## Families

| Family | Bay and crown |
| --- | --- |
| balcony-grid | Recessed loggia beside glazing, concrete cap |
| corporate-sectors | Panel wings around a recessed window bank, ivory shield |
| faceted-bays | Three glass planes between ivory piers, concrete cap |
| mirror-frame | Deep glazed slot between graphite piers, stepped head |
| mirror-shutters | Glazed ribbon and bronze mullions around a service spine, cornice |
| white-grid | Ivory piers and diagonal brace over glazing, ivory cap |

Garden taper remains a landmark: [constraint](../../docs/ISSUES.md#garden-taper-stays-a-landmark-design). Faceted bays and balcony grid preserve their reference element order at the 8 m module; white grid uses one brace per storey.

## Module and placement

[Module constants](module.ts): 8 m bay, two 4 m corner arms, default 4.5 m floor pitch and 0.3 m ribbon. Nine pieces combine `corner`, `bay`, `entrance-bay` with `ground`, `middle`, `crown`. An edge of 8N metres contains two corner arms and N-1 straight pieces. N is any integer from two. Every family fits Atlas lots 16x32, 24x32, 24x40, 40x40, 40x56 and 56x56 in either orientation.

F is any integer from two: ground at floor 0, middle at 1 through F-2, crown at F-1. With two floors, crown at floor 1 sits directly on ground with no middle band. Every published band is 4.5 m, including crown parapets and roof caps. F floors measure F x 4.5 m and fit that exact parcel height. The catalog publishes those heights. Assembly height overrides require matching custom pieces; floorHeight includes crown details. The CLI exports recipe defaults.

Metres, +Y up, +X along a bay, +Z inward. The local origin is the bay run start or corner junction at the floor; a corner's second arm runs +Z. `size` is the geometry bounds extent including projections, not the tiling step. Signs and doors in kit.json use this local frame.

Parcel requests retain footprint coordinates and edge order; legacy lots start at [0,0,0]. Rectangles use complete bays, at least two floors, zero basements and heights within maxHeight; accessPoint and streetAccess select the entrance unless entranceEdge overrides it. Both assembly calls return the shared [blueprint](../../schemas/blueprint.schema.json): floors and envelopes from band heights, openings from transformed piece records, door ids matching placements, signs as signage/screens and materials from piece slots; door recessDepth locates recessed thresholds, and fixed loggia glass is a window. Engine writes blueprint unchanged beside placements; local sign ids repeat by placement, window ids identify each instance, and planning emits no GLB.

## Invariants and ownership

A bay tiles with itself and its corners. `PieceManifest.sections.start` and `.end` agree across every kind in a band. Ground top, middle bottom and top, and crown bottom agree per kind. Half piers omit touching end faces; half ribbons omit touching caps.

Every piece has a full height inner `backing` surface at `family.wallBackingDepth`, 3.6 m for corporate sectors and the default 0.12 m for the other families. Corner arms meet at a miter. Opening records cut the backing; reveals join it to the panel, with closed glass panes and clear door passages. Decorative members have closed backs and returns. The balcony ground band carries the loggia deck section from local X 0.5 to 3.5 m. White grid middle pieces measure exactly 4.5 m high.

Published GLBs share seam vertices within 1 mm and placements overlap by at most 1 mm. Their merged boundary edges lie only on the ground and roof planes. [Seam tessellation](seams.ts) splits mating edges at the same positions without changing their shape.

Sign anchors are published, never baked: centre, width and height, outward unit normal. Published sign fields fit inside their band height. Pieces contain facade, backing, decoration and glazing. A ground entrance contains addressable `door:<id>/frame` and `door:<id>/leaf:<n>` nodes. Floor plates belong to the building. `assembleFromPieces` shares each piece mesh and writes `floor:<index>/slab`, `roof:deck`, doors and requested `anchor:<id>` nodes in building coordinates.

Unknown families, invalid heights and entrance faces, or missing wire anchor edges raise `ExteriorError` with `E_SCHEMA`. Missing material roles raise `E_MATERIAL_UNRESOLVED`. Incomplete bay extents or fewer than two floors raise `RangeError`.

## Dependencies and checks

[Building families](../families/CONTRACT.md) supply recipe dimensions and roles. [Exterior](../../CONTRACT.md) supplies welding and GLB serialization. Materials resolves published keys at consumption time; the CLI reads no catalog.

`npm test -- tests/kit.test.ts tests/kit-cli.test.ts --maxWorkers=1` checks the contract. The geometric check instances published pieces on a 40 x 56 m lot at two and six floors for all six families. It measures seam vertices, placement bounds, signed boundary edge lengths, backing area and opening counts. Schema checks use the installed Python `jsonschema` draft 2020-12 validator.
