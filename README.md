# buildingforge

Deterministic building generator. Give it a footprint polygon, a building type and a floor count; get back a glTF binary shell with split grammar facades, carved openings, balconies, signage and roof artifacts, plus a JSON blueprint of every floor and every opening on it.

Same request in, byte-identical GLB and JSON out. No LLM, no wall clock, no environment reads, no service to run.

The shell is empty inside except one separator plane per floor, which a floor-filling tool can replace with real slabs ([interiorforge](../interiorforge) does exactly that).

## Run

```
npm install
npm test                                              # contract tests
npm run preview                                       # 3D viewer: orbit, per-floor isolation, opening highlight
npm run generate -- fixtures/corpo-tower.request.json out
npm run typecheck
```

`fixtures/` ships five requests to generate from: a corpo tower, a mid residential block, a factory, a bridged tower and a sliver parcel. The preview loads any fixture or a pasted request and generates in the browser.

## In

`generate(request)` in TypeScript, or the CLI above. A request (`schemas/building-request.schema.json`) carries:

- **seed** and **parcel**: footprint polygon, street access point, max height
- **building**: type (residential, hotel, offices, corpo, hospital, clinic, police, military, factory, commerce, mall, restaurant, coffee shop), wealth tier (poor, mid, rich, high rich), floor count, basements, optional per-floor kind labels
- **theme** slug for material keys
- **apertures**: required openings for bridges, AC tubes, tunnels and wire anchors, each with a face index, an absolute base height and a world space cut polygon
- **options**: shape, balconies, fire escape, window style, signage marquee or logo, ad screens, roof artifacts, curtain profile

`schemas/floor-constants.json` publishes the per-type constants (floor height bands, minimum footprint area) and the recipe a caller uses to pick a guaranteed feasible floor count before generating, so a batch never discovers infeasibility halfway through.

## Out

- **GLB shell**: glTF 2.0, one scene, named nodes (`floor:<i>/slab`, `wall:<floor>/<edge>`, `window:`, `door:`, `balcony:`, `aperture:`, `anchor:`, `roof`, `parapet`, `terrace:`, `columns`, `signage:`, `screen:`, `light:`, `fire-escape`). `options.glb: "merged"` swaps to one mesh per material key for runtime scale, with an identical blueprint. Materials carry no textures: each is named by the canonical `theme/kind/tier` key, ready for a texture library like [pbrforge](../pbrforge) to resolve. Tiled materials get world scale UVs so nothing stretches; ad screens, signage and window glass get exact 0..1 UVs over their quad.
- **Blueprint JSON** (`schemas/blueprint.schema.json`): per floor, basements included, the index, kind, elevation, height, outline and every opening positioned by outline edge, offset and sill, with curtain state, balcony dimensions and material key. Plus signage, screens, lights, fire escape, roof artifacts and the deduplicated material key list.

The generator checks itself before returning: openings fit their edge and their floor, no two openings on a floor overlap, a 0.3 m minimum pier between them, floor elevations contiguous from ground zero, every requested aperture carved exactly where asked with a floor tall enough to contain it, the structure inside the parcel footprint, and GLB geometry matching the blueprint exactly. `CONTRACT.md` has the closed error set, each error naming the numbers that made the request infeasible.

## How it works

Facades come from a split grammar per building type and tier: bay rhythm, column material, window proportion, balcony rules, curtain states. The floor solver searches legal splits between aperture bases, so a bridge always lands on a real walking surface. Openings are grid-cut into the wall, watertight and free of T-junctions; windows sit proud of the uncut wall as overlay units. The research behind the dimensional rules is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

The whole surface is a JSON request in and files out, offline and deterministic, so it drops into a batch script, a build step or an agent tool loop without a server. `CONTRACT.md` plus `schemas/` describe the request, the result and the closed error set well enough to call it without reading the code, and the feasibility constants let a caller compose valid requests up front.

## Consumers

[urbe](../urbe) is a deterministic city sandbox that generates thousands of these buildings from one seed: it feeds parcels from its city plan and aperture requests from its bridge and tube layer, then fills the shells with [interiorforge](../interiorforge) and textures them with [pbrforge](../pbrforge).
