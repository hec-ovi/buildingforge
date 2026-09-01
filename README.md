# buildingforge

Deterministic building generator. Give it a footprint polygon, a building type and a floor count; get back a finished, textured glTF binary of the exterior: split grammar facades, real window units, carved openings, balconies, signage and roof artifacts, plus a JSON blueprint of every floor and every opening on it.

Same request in, byte-identical GLB and JSON out. No LLM, no wall clock, no environment reads, no service to run.

The shell is empty inside except one separator plane per floor, which a floor-filling tool can replace with real slabs ([interiorforge](../interiorforge) does exactly that).

## Run

```
npm install
npm test                                              # contract tests
npm run preview                                       # 3D viewer: orbit, per-floor isolation, opening highlight
npm run generate -- fixtures/corpo-tower.request.json out   # textured GLB + blueprint
npm run typecheck
```

`fixtures/` ships five requests to generate from: a corpo tower, a mid residential block, a factory, a bridged tower and a sliver parcel. The preview loads any fixture, generates it in the browser and shows the finished textured building.

A run with no seed rolls one and prints it, so the building can be regenerated exactly:

```
npm run generate -- request.json out --seed 9f3c1a20b7e4
npm run generate -- request.json out --embed            # one self-contained file
npm run generate -- request.json out --keys-only        # material keys, no maps
```

## In

`generate(request)` in TypeScript, or the CLI above. A request (`schemas/building-request.schema.json`) carries:

- **seed** and **parcel**: footprint polygon, street access point, max height
- **building**: type (residential, hotel, offices, corpo, hospital, clinic, police, military, factory, commerce, mall, restaurant, coffee shop), wealth tier (poor, mid, rich, high rich), floor count, basements, optional per-floor kind labels
- **theme** slug for material keys
- **apertures**: required openings for bridges, AC tubes, tunnels and wire anchors, each with a face index, an absolute base height and a world space cut polygon
- **options**: shape, balconies, fire escape, window style, signage marquee or logo, ad screens, roof artifacts, curtain profile
- **textures**: `external` map URIs against a base path (default), `embed` for one self-contained file, or `keys` for a consumer that resolves the material keys itself

`schemas/floor-constants.json` publishes the per-type constants (floor height bands, minimum footprint area) and the recipe a caller uses to pick a guaranteed feasible floor count before generating, so a batch never discovers infeasibility halfway through.

## Out

- **GLB**: glTF 2.0, one scene, named nodes (`floor:<i>/slab`, `wall:<floor>/<edge>`, `window:`, `door:`, `balcony:`, `aperture:`, `anchor:`, `roof`, `parapet`, `terrace:`, `columns`, `facade-relief`, `facade-artifacts`, `bulkhead`, `signage:`, `screen:`, `light:`, `fire-escape`). Every mesh carries positions, normals and UVs. `options.glb: "merged"` swaps to one mesh per material key for runtime scale, with an identical blueprint. Each material is named by the canonical `theme/kind/tier` key and resolved through a texture library like [pbrforge](../pbrforge) into basecolor, normal, occlusion and emission maps with its physical factors; tiled maps carry a texture transform over world-meter UVs so nothing stretches, and ad screens, signage and window glass get exact 0..1 UVs over their quad. With no texture library present the output falls back to keys and says so, so the tool still runs alone.
- **Blueprint JSON** (`schemas/blueprint.schema.json`): per floor, basements included, the index, kind, elevation, height, outline and every opening positioned by outline edge, offset and sill, with curtain state, pane grid, balcony dimensions and material key. Plus signage, screens, lights, facade style and artifacts, fire escape, the roof bulkhead and its artifacts, and the deduplicated material key list.

The generator checks itself before returning: openings fit their edge and their floor, no two openings on a floor overlap, a 0.3 m minimum pier between them, floor elevations contiguous from ground zero, every requested aperture carved exactly where asked with a floor tall enough to contain it, the structure inside the parcel footprint, and GLB geometry matching the blueprint exactly. `CONTRACT.md` has the closed error set, each error naming the numbers that made the request infeasible.

## How it works

Facades come from a split grammar per building type and tier: bay rhythm, column material, window proportion, balcony rules, curtain states. The floor solver searches legal splits between aperture bases, so a bridge always lands on a real walking surface. Every opening is grid-cut into the wall, watertight and free of T-junctions, and lined by a reveal back to the unit that fills it.

A window is a real unit: a frame profile with reveal depth, a mullion grid splitting it into panes no larger than the tier's structural limit, and glass recessed behind the profile. The tier also picks the facade style, from clean mullioned glazing on flush panels through thin panel relief to a ribbed megablock with small deep-set windows scattered inside the panel grid and utility boxes bolted to it. Signs are modular: one letter per cell, running as a marquee band over the entrance or stacking into a blade sign that protrudes edge-on from the facade. The roof carries a stair-head cutout with its housing, and roof artifacts keep clear of it.

The research behind the dimensional rules is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

The whole surface is a JSON request in and files out, offline and deterministic, so it drops into a batch script, a build step or an agent tool loop without a server. `CONTRACT.md` plus `schemas/` describe the request, the result and the closed error set well enough to call it without reading the code, and the feasibility constants let a caller compose valid requests up front.

## Consumers

[urbe](../urbe) is a deterministic city sandbox that generates thousands of these buildings from one seed: it feeds parcels from its city plan and aperture requests from its bridge and tube layer, then fills the shells with [interiorforge](../interiorforge) and textures them with [pbrforge](../pbrforge).
