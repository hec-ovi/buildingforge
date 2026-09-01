# CONTRACT: exterior

Purpose: deterministically generates one building exterior as a GLB shell (empty inside, one separator plane per floor) plus a JSON blueprint of every exterior opening per floor.

Status: v0.9.1, implemented. Schemas stable to build against; additive fields may come, breaking changes go through the orchestrator.

## Conventions
- Units: meters. Ground plane XZ, +Y up, right-handed. 2D points `[x, z]`, CCW rings, first point not repeated (same as atlas).
- Outputs share the request footprint's coordinate frame; ground floor walking surface at Y = 0.
- Determinism: same request, same materials database and same texture options give a byte-identical GLB and blueprint JSON. No LLM, no wall clock, no ambient randomness.

## In
`generate(request: BuildingRequest, options?: GenerateOptions): { glb: Uint8Array, blueprint: Blueprint, textures: { mode, reason? } }`

Request: [schemas/building-request.schema.json](schemas/building-request.schema.json). Seed, parcel (footprint, street access point, max height), building (atlas type and tier verbatim, floor count, basements, optional per-floor kind labels), theme slug, required apertures (connections' aperture schema verbatim: face = parcel footprint segment index, absolute base, world-space cut polygon; kinds bridge, ac-tube, tunnel, wire-anchor), options (shape, balconies, fire escape, windows, signage marquee/logo, ad screens, roof artifacts, curtain profile).

`options.textures`: `{ mode?: "external" | "embed" | "keys", dir?, baseUrl?, source? }`. `dir` is the materials box root (defaults to `URBE_MATERIALS_DIR`, else the sibling `materials` box), `baseUrl` is the URI prefix written into the GLB before `themes/<theme>/assets/...`, and `source` is a preloaded materials source for callers with no filesystem (the browser preview) or `null` to force the keys fallback.

CLI: `npm run generate -- <request.json> <outDir> [--embed | --keys-only] [--materials DIR] [--materials-base URI]` writes `<buildingId>.glb` and `<buildingId>.blueprint.json`; external map URIs are written relative to the output directory by default.

Feasibility: [schemas/floor-constants.json](schemas/floor-constants.json) carries the per-type constants the generator enforces (type-to-family map, min and max floor height, min footprint area) plus the recipe for pre-computing a guaranteed-feasible floor count, with or without apertures.

## Out
Blueprint: [schemas/blueprint.schema.json](schemas/blueprint.schema.json). Per floor (basements included): index, kind, elevation, height, CCW outline, openings (door | window | balconyDoor | aperture) positioned by outline edge + offset + sill, with curtain state, balcony dimensions, material key. Plus signage, screens, lights, fire escape, roof artifacts, and the deduplicated material key list.

Floor `kind` slugs are atlas vocabulary verbatim: the parcel type itself (`restaurant`, `coffee_shop`, `commerce`, `mall`, `residential`, ...) on every typed floor, venue and ground floors included, so interior assigns real venue programs. The only slugs that are not atlas types: `lobby` and `entry` (non-venue ground floors), `basement`, and the special top floor of a tall rich hotel (`bar`) or corpo (`executive`). Request `floorKinds` pass through unchanged.

GLB shell:
- Binary glTF 2.0, one scene, named nodes: `floor:<index>/slab`, `wall:<floor>/<edge>`, `window:<opening-id>`, `door:<opening-id>`, `balcony:<opening-id>`, `aperture:<id>`, `anchor:<id>`, `roof`, `parapet`, `terrace:<floor>` (setback rings), `columns`, `roof-artifacts`, `base` (bottom cap), `signage:<n>`, `screen:<n>`, `light:<n>`, `fire-escape`.
- `options.glb: "merged"` swaps the node scheme for one mesh per material key (`merged:<theme/kind/tier>`), for runtime scale; anchors stay named nodes and the blueprint is identical either way. Default `"named"` is the canonical interchange.
- Empty inside except one upward-facing separator plane per floor at its elevation. The `floor:<index>/slab` nodes are replaceable: interior re-emits them with stair and elevator holes under the same names.
- All triangles CCW front, outward normals; every mesh carries a NORMAL attribute (flat per face, matching the winding) so it shades correctly in any viewer. Windows are overlay units proud of the uncut wall; real holes only for doors and apertures (grid-cut, watertight, no T-junctions).
- Every material is named by the canonical key `theme/kind/tier` (lowercase slugs). Kinds used: wall, wall-trim, column, window-glass, window-frame, curtain, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact.
- Tiled materials get world-scale UVs (1 UV unit = 1 tile meter, planar per face, origin at the face's bottom-left, U along the face's own horizontal edge) so textures never stretch; opening and style dimensions are quantized to 0.05 m, positions to millimeters. Exact-placement materials (ad-screen, signage, window glass) get exact 0..1 UVs over their quad, never a partial tile.

Textures. The default export is a finished exterior: every key resolves through ../materials into real maps (basecolor, normal, occlusion, emission where the entry has one, plus its metallic and roughness factors, transmission and IOR for glass). Tiled entries carry a `KHR_texture_transform` scale of 1 / tiling worldSize over the world-meter UVs; exact entries get clamped 0..1 UVs and no transform. The map variant is picked deterministically per material key from the seed. `textures.mode` on the result says which mode the GLB carries:
- `external` (default): map URIs written against `baseUrl`, nothing embedded.
- `embed`: the maps packed into one self-contained GLB.
- `keys`: material names only, for a consumer that resolves them itself (the engine runtime).
With no materials database at the configured path, output falls back to `keys` and `textures.reason` says so, so the box still runs standalone.

## Errors
Thrown as `ExteriorError { code, message, details? }`:
- `E_SCHEMA`: request fails schema validation; message names the path.
- `E_FOOTPRINT_INVALID`: footprint self-intersects, has under 3 points, or zero area.
- `E_FOOTPRINT_TOO_SMALL`: usable area below the type's minimum.
- `E_ENVELOPE_TOO_LOW`: floors x the type's minimum floor height exceeds maxHeight; the message carries the exact numbers.
- `E_FLOORKINDS_MISMATCH`: floorKinds length differs from floors.
- `E_APERTURE_UNREACHABLE`: face index outside the footprint, base outside the vertical range, an aperture taller than the type's max floor height, or no legal floor split exists for the requested floor count; the message names the feasible count range.
- `E_APERTURE_INVALID`: cut polygon off its face plane or inconsistent with u/width/height.
- `E_APERTURE_OVERLAP`: two aperture cuts overlap on the same face.
- `E_SIGNAGE_TEXT_TOO_LONG`: marquee text exceeds the facade's computed capacity.
- `E_MATERIAL_UNRESOLVED`: the materials theme has no entry for a key the building uses, or embedded textures were asked for without the database on disk.
- `E_INVARIANT`: post-generation coherence check failed; exterior bug, report with the request.

## Invariants
- Face i is the vertical quad over parcel footprint segment i -> i+1 (connections convention). Every face carrying an aperture keeps its wall exactly on that segment; shape variation (octagon, cylinder, pyramid, inset) applies to aperture-free buildings, setbacks only above the topmost aperture.
- Every bridge, ac-tube and tunnel aperture yields exactly one `aperture` opening carving exactly the given cut, with a floor walking surface at exactly its base; that floor is tall enough to contain the aperture's full vertical extent. Wire anchors cut no hole: the region stays clear of openings and the GLB carries node `anchor:<id>`. The per-floor elevation table in the blueprint is final; interior consumes it.
- Floor elevations are contiguous: `elevation[i+1] = elevation[i] + height[i]`; ground floor at 0.
- Openings on one floor never overlap; min 0.3 m pier between openings. Every opening lies entirely inside its edge with non-negative offset and inside its floor's height (machine-checked before output).
- The entrance goes to a street-facing edge at least 3 m long when one exists (true point-to-segment distance from the access point, never a corner-touching sliver), and its zone is reserved before any window fill.
- Every balconyDoor carries balcony dimensions; balconies protrude beyond the outline but stay inside the parcel footprint.
- The structure never exceeds the parcel footprint; it need not fill it.
- Blueprint floors match GLB geometry exactly (same outlines, same opening rectangles).

## Preview
`npm run preview`: vite app, loads a fixture or pasted request, generates in-browser, orbit controls, per-floor isolation and opening highlighting. UI in `src/ui/` with `views/`, `widgets/`, `components/`.

## Depends on
- ../atlas/CONTRACT.md (parcel: footprint, access point, envelope, type, tier)
- ../connections/CONTRACT.md (aperture constraints)
- ../materials/CONTRACT.md (material key resolution)
