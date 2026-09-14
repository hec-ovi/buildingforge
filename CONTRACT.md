# CONTRACT: exterior

Version: 0.47.0.

Generates one deterministic building exterior GLB and the matching floor/opening blueprint.

## Call and schemas

`generate(request, options?): Promise<GenerateResult>` from `src/index.ts`.

- Input: [BuildingRequest](schemas/building-request.schema.json), [GenerateOptions and result types](src/types.ts), [texture options/source](src/materials/apply.ts).
- Output: GLB bytes, [Blueprint](schemas/blueprint.schema.json), and `textures: {mode: external|embed|keys, reason?: string}`.
- CLI: `npm run generate -- request.json outDir [--seed S] [--embed|--keys-only] [--materials DIR] [--materials-base URI]`. Writes `<buildingId>.glb` and `<buildingId>.blueprint.json`; prints the resolved seed. Missing/unknown CLI arguments exit 2; generation errors exit 1. Filesystem/JSON failures use Node's process error reporting.
- Defaults and a copyable example: [SKILL.md](SKILL.md).

## Geometry and ownership

Metres, +Y up, XZ ground, right-handed; CCW rings without a repeated endpoint. Output shares the request footprint frame, with the ground walking surface at Y=0. Same request, catalog and texture options produce identical blueprint JSON and GLB bytes. Only CLI/preview seed resolution uses randomness.

The parcel limits massing. Auto uses construction-grid rectangles. Explicit rounded-box, octagon, cylinder, pyramid and setback forms fit where possible, with box fallback for core/parcel constraints. Aperture-bound parcels keep their exact faces; traversable cuts pin floor elevations to their absolute bases. Wire anchors are attachments. Building type and supplied floor programs retain their incoming vocabulary.

Every generated floor publishes `roomEnvelope`: four CCW corners, origin, perpendicular unit axes, width/depth, vertical clear interval and the existing construction grid. The rectangle is contained behind measured shell/opening depth and door/portal movement clearance. It follows that floor's actual shape. This is an additive geometric handoff, not a minimum room-size or circulation-width policy. All openings remain hard reservations. Interior may partition inside the rectangle, respecting those reservations; the irregular perimeter remains open. Facade attachments and `partitionAnchors` retain their own published constraints.

Windows carry clear glazing dimensions, housing depth and exact curtain coverage (`0` open, `100` closed). Ground `windowTreatment` identifies removable `ground-privacy:<id>` nodes for shells without real interiors. Permanent exterior louvres remain separate. Pocket door `cassette` reserves the full opaque assembly; `clearance` is the usable passage and inward lining plane. Translate each pocket leaf along face U by `travelU * openFraction`; swing and roller motion retain their existing metadata.

The GLB contains a 0.12 m wall body with mitered inward faces, finished opening returns and closed glazing/frame sections. It has one replaceable, two-sided slab per floor, fitted frames, facade attachments, materials and roof access. Named mode preserves parts; merged mode groups material slots while retaining slabs, moving door leaves, anchors and ground privacy. Consumers rely on `floor:<index>/slab`, `door:<id>/frame`, `door:<id>/leaf:<n>` and `anchor:<id>`. Interior replaces its slabs; Engine renders one version of each slab.

`blueprint.version` identifies the generator package. `version` and `roomEnvelope` are optional in stored-data types/schemas for compatibility, present on every new output. Full provenance and consumer policy proposals are in [docs/ISSUES.md](docs/ISSUES.md).

## Materials

Keys use `theme/kind/tier`, with named variant requests. `external` writes configurable URIs and embeds selected bundled finishes; absent catalog returns `keys` with a reason. `embed` requires all selected maps; `keys` intentionally leaves resolution to the caller. Built-in sources enable bundled finishes; custom sources opt in. `dir` defaults to `URBE_MATERIALS_DIR`, then sibling `materials`; explicit `source` overrides disk access. World-metre mapping follows catalog tiling dimensions.

## Closed generation errors

`ExteriorError {code, message, details?}`:

| Code | Meaning |
| --- | --- |
| `E_SCHEMA` | Malformed request field or incompatible options |
| `E_FOOTPRINT_INVALID` | Degenerate or self-intersecting footprint |
| `E_FOOTPRINT_TOO_SMALL` | Footprint below the building family's minimum area |
| `E_ENVELOPE_TOO_LOW` | Requested floor count cannot fit the permitted height |
| `E_FLOORKINDS_MISMATCH` | Program-label count differs from above-ground floor count |
| `E_APERTURE_UNREACHABLE` | Face, height or floor stack cannot receive the aperture |
| `E_APERTURE_INVALID` | Cut plane or dimensions disagree with the aperture |
| `E_APERTURE_OVERLAP` | Planned aperture reservations overlap |
| `E_SIGNAGE_TEXT_TOO_LONG` | Text cannot fit a complete sign field |
| `E_CORE_PLATE` | Published circulation feasibility rejects the plate or openings |
| `E_DOOR_FIT` | Required entrance or complete pocket assembly cannot fit |
| `E_MATERIAL_UNRESOLVED` | Required material, variant or embedded map is unavailable |
| `E_INVARIANT` | Generated output or a dependency fails a consistency check |

Runtime guards protect openings and geometry; tests exercise the public surface. Optional detail can be omitted when it cannot fit.

## Dependencies

- [Atlas](../atlas/CONTRACT.md): supplied parcel data; no Atlas runtime calls.
- [Connections](../connections/CONTRACT.md): supplied aperture constraints.
- [Interior](../interior/CONTRACT.md): published `schemas/core-feasibility.json` and browser-safe `dist/feasibility.js`; this build must exist before generation or preview bundling.
- [Materials](../materials/CONTRACT.md): catalog, named style bindings and maps.
- [Facade services](src/facade-services/CONTRACT.md): [input](src/facade-services/schema/input.schema.json), [output](src/facade-services/schema/output.schema.json).
- External attachment records: [schema](schemas/external-attachment.schema.json). Dimension tables: [floors](schemas/floor-constants.json), [openings](schemas/proportions.json).
- Installed npm dependencies: glTF Transform and earcut. No LLM or live city process.
