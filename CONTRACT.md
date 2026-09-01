# CONTRACT: exterior

Purpose: deterministically generates one building exterior as a GLB shell (empty inside, one separator plane per floor) plus a JSON blueprint of every exterior opening per floor.

Status: v0.3. Schemas stable to build against; additive fields may come, breaking changes go through the orchestrator.

## Conventions
- Units: meters. Ground plane XZ, +Y up, right-handed. 2D points `[x, z]`, CCW rings, first point not repeated (same as atlas).
- Outputs share the request footprint's coordinate frame; ground floor walking surface at Y = 0.
- Determinism: same request, byte-identical GLB and blueprint JSON. No LLM, no wall clock, no environment reads.

## In
`generate(request: BuildingRequest): { glb: Uint8Array, blueprint: Blueprint }`

Request: [schemas/building-request.schema.json](schemas/building-request.schema.json). Seed, parcel (footprint, street access point, max height), building (atlas type and tier verbatim, floor count, basements, optional per-floor kind labels), theme slug, required apertures (absolute face-plane cut constraints from connections), options (shape, balconies, fire escape, windows, signage marquee/logo, ad screens, roof artifacts, curtain profile).

CLI: `npm run generate -- <request.json> <outDir>` writes `<buildingId>.glb` and `<buildingId>.blueprint.json`.

## Out
Blueprint: [schemas/blueprint.schema.json](schemas/blueprint.schema.json). Per floor (basements included): index, kind, elevation, height, CCW outline, openings (door | window | balconyDoor | aperture) positioned by outline edge + offset + sill, with curtain state, balcony dimensions, material key. Plus signage, screens, lights, fire escape, roof artifacts, and the deduplicated material key list.

GLB shell:
- Binary glTF 2.0, one scene, named nodes: `floor:<index>/slab`, `wall:<floor>/<edge>`, `window:<opening-id>`, `door:<opening-id>`, `balcony:<opening-id>`, `aperture:<id>`, `roof`, `parapet`, `signage:<n>`, `screen:<n>`, `light:<n>`, `fire-escape`.
- Empty inside except one upward-facing separator plane per floor at its elevation.
- All triangles CCW front, outward normals; windows are overlay units proud of the uncut wall; real holes only for doors and apertures (grid-cut, watertight, no T-junctions).
- Materials carry no textures; each is named by the canonical key `theme/kind/tier` (lowercase slugs) and resolved by the materials index. Kinds used: wall, wall-trim, column, window-glass, window-frame, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact.
- Faces carrying tiled materials are sized in whole tile units with world-scale UVs (1 UV unit = 1 tile).

## Errors
Thrown as `ExteriorError { code, message, details? }`:
- `E_SCHEMA`: request fails schema validation; message names the path.
- `E_FOOTPRINT_INVALID`: footprint self-intersects, has under 3 points, or zero area.
- `E_FOOTPRINT_TOO_SMALL`: usable area below the type's minimum.
- `E_ENVELOPE_TOO_LOW`: floor count at the type's minimum floor height exceeds maxHeight.
- `E_FLOORKINDS_MISMATCH`: floorKinds length differs from floors.
- `E_APERTURE_UNREACHABLE`: aperture plane misses the buildable boundary, or baseY outside the vertical range.
- `E_APERTURE_OVERLAP`: two aperture cuts overlap on the same plane.
- `E_SIGNAGE_TEXT_TOO_LONG`: marquee text exceeds the facade's computed capacity.

## Invariants
- Every required aperture yields exactly one `aperture` opening with its exact cut, on a wall lying exactly in the given face plane, and a floor walking surface at exactly its baseY. The per-floor elevation table in the blueprint is final; interior consumes it.
- Floor elevations are contiguous: `elevation[i+1] = elevation[i] + height[i]`; ground floor at 0.
- Openings on one floor never overlap; min 0.3 m pier between openings.
- Every balconyDoor carries balcony dimensions; balconies protrude beyond the outline but stay inside the parcel footprint.
- The structure never exceeds the parcel footprint; it need not fill it.
- The main entrance lands on the facade nearest the parcel access point.
- Blueprint floors match GLB geometry exactly (same outlines, same opening rectangles).

## Preview
`npm run preview`: vite app, loads a fixture or pasted request, generates in-browser, orbit controls, per-floor isolation and opening highlighting. UI in `src/ui/` with `views/`, `widgets/`, `components/`.

## Depends on
- ../atlas/CONTRACT.md (parcel: footprint, access point, envelope, type, tier)
- ../connections/CONTRACT.md (aperture constraints)
- ../materials/CONTRACT.md (material key resolution)
