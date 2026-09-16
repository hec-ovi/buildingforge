# CONTRACT: exterior

Version: 0.49.0.

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

The `rounded-corner`, `chamfered-corners` and `terrace-blocks` values of `options.architecture` select fixed corner and facade compositions. Their fixed corner and complete bay sections choose the actual footprint before opening and core planning. They require unbound parcel faces, the 0.5 m grid, windows, their authored balcony selection and a single swing entrance; incompatible options report `E_SCHEMA`, an unfittable complete assembly reports `E_CORE_PLATE`. `blueprint.assembly` records actual floor groups, outlines, section fields and balcony selections. Each opening carries its `sectionId` and curve-slice `sectionSpan` where applicable. A broad curved bay crosses multiple outline edges while keeping jambs only at its authored ends. Cut-corner compositions use horizontal glazed ribbons, recessed head baffles with housed underside lamps, solid end piers and an opaque top-frame storey. Their 0.85 m frame projection fits inside a reserved 1 m perimeter. `auto` uses the seeded [selection policy](schemas/architecture-policy.json): eligible unbound residential, hotel, office and corporate parcels can receive the rounded composition; other requests use ordinary generous glazing. Fixed aperture faces and explicit incompatible options keep ordinary geometry. A rejected candidate plate, entrance or sign fit records its error before ordinary generation. Material and invariant errors propagate. `blueprint.architectureSelection` records the selected recipe and reason. Automatic rounded output uses canonical native Materials identities, including `-exact` counterparts for full-panel mapping, in textured and keys-only exports.

`schemas/floor-constants.json#generationPolicy` publishes 4 m default clear height and 4.5 m default pitch, distinct from hard family minima. `options.minimumClearHeight` overrides the active clear minimum for every floor, including basements; the 0.5 m slab/ceiling allowance is additional. Ordinary window defaults use at least 4 m bays, one shared 0.5 m pier, tall glazing and large panes. Explicit section recipes retain their own dimensions. Taller ground programs remain taller; fixed connection bases remain fixed. Impossible heights return a checked envelope/aperture error.

Every generated floor publishes `roomEnvelope`: four CCW corners, origin, perpendicular unit axes, width/depth, vertical clear interval and the existing construction grid. The rectangle is contained behind measured shell/opening depth and door/portal movement clearance. It follows that floor's actual shape. This is an additive geometric handoff, not a minimum room-size or circulation-width policy. All openings remain hard reservations. Interior may partition inside the rectangle, respecting those reservations; the irregular perimeter remains open. Facade attachments and `partitionAnchors` retain their own published constraints.

Windows carry clear glazing dimensions, housing depth and exact curtain coverage (`0` open, `100` closed). Ground `windowTreatment` identifies removable `ground-privacy:<id>` nodes for shells without real interiors. Permanent exterior louvres remain separate. Pocket door `cassette` reserves the full opaque assembly; `clearance` is the usable passage and inward lining plane. Translate each pocket leaf along face U by `travelU * openFraction`; swing and roller motion retain their existing metadata.

The GLB wall body reaches the opening/housing depth measured against each vertex's same-height facade plane (at least 0.12 m), with mitered inward faces, one finished surface per window return and closed glazing/frame sections. Shared strip boundaries stay internal. Scenic rooms start at their window glazing and extend 1 m inward with rectangular side walls, one rear image and ceiling fixtures. Curved panes receive their own shallow rectangular scenes. Tapered facade placement preserves room depth in world metres. Coverings retain their glass-relative position. It has one replaceable, two-sided slab per floor, fitted frames, facade attachments, materials and roof access. Named mode preserves parts; merged mode groups material slots while retaining slabs, moving door leaves, anchors and ground privacy. Consumers rely on `floor:<index>/slab`, `door:<id>/frame`, `door:<id>/leaf:<n>` and `anchor:<id>`. Interior replaces its slabs; Engine renders one version of each slab.

`blueprint.version` identifies the generator package. `version` and `roomEnvelope` are optional in stored-data types/schemas for compatibility, present on every new output. Full provenance and consumer policy proposals are in [docs/ISSUES.md](docs/ISSUES.md).

The `paired-rounded` and `paired-rectangular` architectures use 5 m room widths in alternating 10 m glazed and solid pairs. Extents fit complete pairs with 0.5 m end trims. The rounded form has one 10 m radius corner; its other corners remain rectangular. Floor rims use 0.22 m below glazing and 0.28 m above it. Ground entries occupy a centered 3 m passage. Basement apertures keep their original parcel faces; above-ground aperture constraints reject these recipes. Upper openings publish `scenery` with a node, depth, fixture layout and light state. Its removable `scenery:<floor>` node contains rectangular 1 m-deep room surfaces, a single rear image cropped from its 2:1 source, ceiling strips or fitted spot arrays, formed louvers with a 0.14 m pitch, 0.095 m inclined webs, 0.076 x 0.026 m punched openings, folded lips, guide clips and raised stacks. Ground floors are opaque and retain their main entrance. Optional `scenery.lights` publishes one emitter per real fixture with its world position, color, flux and range: 2,400 lm per strip or 1,200 lm per spot, a 12 m range, 15 percent power in dim rooms and zero in dark rooms. Engine feeds these records into its fixed light pool, renders the authored nodes and omits generated room replacements. Upper glazing uses the paired clear-glass key; upper facade and frame surfaces use the paired metal keys.

`garden-taper` builds a pale 4.5 m podium and a straight planted spine between tapering glazed wings. The long parcel axis defines its front. The spine uses complete 10 m pairs near one third of the base width and keeps that width and depth on every floor. Enclosed balcony cassettes have opaque bevelled fronts, side closures and an overhead lip. Upper floors publish `topOutline`; only the outer wings contract. The roof ends with 1.5 m glazed wing tips around the fixed spine. Side setback is at least 0.3 m per metre of rise, so tall requests need a wider base. The footprint needs 35 x 25 m and three floors. Podium panels occupy the 4 m field between 0.25 m rims. Planted bands are exterior ornament. Basement apertures retain the original parcel faces.

Paired-family dark windows use opaque reflective black glass and omit scenic rooms. Optional facade light `material`, `color`, `lumens` and `range` fields bind authored podium light surfaces and their emitters.

The six [registered building families](src/families/CONTRACT.md) select authored facade plans through `options.architecture`. Their material roles override the host, with structural wall backing at `family.wallBackingDepth` (default 0.12 m inward). The lining reserves at least another 0.12 m behind that backing. Ground fields are opaque unless explicit windows are supplied. Apertures reaching above ground fix rectangular parcel faces and exact connection bases; unsupported fixed shapes return `E_SCHEMA`. Basement-only cuts keep their original parcel faces and permit free upper family shapes. Required cuts remain clear. Multiple window rows use floor-relative sills and section-relative horizontal fields. Curved sections keep their authored pane spans, and narrow service windows use appropriately spaced room fixtures.

Section `border.surfaceDepth` gives the inward plane of a recessed facade panel. Its straight window casings, opening returns and fitted weathering share that plane; glazing retains its independently authored recess. Floor slabs follow these recessed edges and retain approaches to floor-level doors and connection openings. Omission uses the outline plane.

Family decoration owns screen and mechanical details, while the host retains requested signage and entrance fixtures. Family `parapetHeight` can retain a flush roof cap. Decoration runs after shared rooms and before light meshes. Optional `modelInstances` publishes existing vegetation requests for the consuming engine; each has a kind, world root position, allowed size and optional rotation. Room surfaces, formed coverings and seeded black reflective windows use the shared system. Ground height normally follows the common 4.5 m pitch; white-grid requests a 5 m podium, subject to fixed bridge bases.

## Materials

`roof.material` publishes the actual roof key and named variant on every new output, including canonical native identities. Keys use `theme/kind/tier`, with named variant requests. Cut-corner exterior fields use the published graphite concrete, cast structural concrete and paint frame variants; their exact key/variant identities are retained in keys-only output. `external` writes configurable URIs and embeds selected bundled finishes; absent catalog returns `keys` with a reason. `embed` requires all selected maps; `keys` intentionally leaves resolution to the caller. Built-in sources enable bundled finishes; custom sources opt in. `dir` defaults to `URBE_MATERIALS_DIR`, then sibling `materials`; explicit `source` overrides disk access. World-metre mapping follows catalog tiling dimensions. Cut-facade concrete uses the catalog world-metre mapping. Other authored section fields carry full 0..1 maps with `textureMapping: exact` material extras and clamped texture edges.

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
- [Facade sections](src/sections/CONTRACT.md): [input](src/sections/schemas/input.schema.json), [output](src/sections/schemas/output.schema.json).
- [Facade services](src/facade-services/CONTRACT.md): [input](src/facade-services/schema/input.schema.json), [output](src/facade-services/schema/output.schema.json).
- External attachment records: [schema](schemas/external-attachment.schema.json). Dimension tables: [floors](schemas/floor-constants.json), [openings](schemas/proportions.json).
- Installed npm dependencies: glTF Transform and earcut. No LLM or live city process.
