# buildingforge

Deterministic building generator. Give it a footprint polygon, a building type and a floor count; get back a finished, textured glTF binary of the exterior: split grammar facades, real window units, carved openings, balconies, fitted facade services, signage and roof artifacts, plus a JSON blueprint of every floor and every opening on it.

The same request, materials database and texture options produce byte-identical GLB and JSON. Node reads `URBE_MATERIALS_DIR` only to locate the default materials box. No LLM, wall clock or service is involved.

The shell is empty inside except one separator plane per floor, which a floor-filling tool can replace with real slabs ([interiorforge](https://github.com/hec-ovi/interiorforge) does exactly that).

## Run

```
npm install
npm test                                              # contract tests
npm run preview                                       # 3D viewer: orbit or street eye, height clipping, opening highlight
npm run generate -- fixtures/corpo-tower.request.json out   # textured GLB + blueprint
npm run typecheck
```

`fixtures/` ships ten requests: corpo, residential, factory, bridged, pinned and shallow towers, a sliver parcel, a rotated core, and two city integration cases. The preview loads any fixture, generates it in the browser and shows the finished textured building.

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
- **options**: shape, balconies and balcony style, open business frontage, fire escape, window style and sparse damage, facade services, hanging clothes, signage marquee or logo, ad screens, roof artifacts, curtain profile and per-opening open percentage
- **textures**: `external` map URIs against a base path (default), `embed` for one self-contained file, or `keys` for a consumer that resolves the material keys itself

`schemas/floor-constants.json` publishes the per-type constants (floor height bands, minimum footprint area) and the recipe a caller uses to pick a guaranteed feasible floor count before generating, so a batch never discovers infeasibility halfway through. `schemas/proportions.json` publishes the opening sizes: entrance heights by family (2.4 m residential up to 6 m corpo lobbies) and widths, window heights as a share of each floor's clear height with sill ranges, and the storefront and megablock rows.

## Out

- **GLB**: glTF 2.0, one scene, named nodes (`floor:<i>/slab`, `wall:<floor>/<edge>`, `window:`, `door:` with a frame and one subtree per swinging leaf, `open-front:`, `balcony:`, `balcony-band:`, `aperture:`, `anchor:`, `roof`, `parapet`, `terrace:`, `columns`, `facade-relief`, `facade-artifacts`, `facade-ac`, `facade-services`, `bulkhead`, `signage:`, `screen:`, `light:`, `fire-escape`). Every mesh carries positions, normals and UVs. `options.glb: "merged"` swaps to one mesh per material key and authored variant for runtime scale, keeping door leaves, anchors and floor slabs as named nodes, with an identical blueprint. Each material is named by the canonical `theme/kind/tier` key and resolved through a texture library like [pbrforge](https://github.com/hec-ovi/pbrforge) into basecolor, normal, occlusion and emission maps with its physical factors; an authored non-default variant travels in `extras.materialVariant`. Tiled maps carry a texture transform over world-meter UVs so nothing stretches, and ad screens, signage and window glass get exact 0..1 UVs over their quad (a letter cell gets its sub-rect of the glyph atlas). With no texture library present the output falls back to keys and says so, so the tool still runs alone.
- **Blueprint JSON** (`schemas/blueprint.schema.json`): per floor, basements included, the index, kind, elevation, height, outline and every opening positioned by outline edge, offset and sill, with exact curtain closure, pane grid, optional damaged pane, fitted door set, door role and movement clearance, open-portal clearance, balcony band link and material key. Balcony bands publish shared slab and rail dimensions plus every access door. Each face publishes its fixed 2 x 1 m panel field, solid fitted borders, opening-free wall runs and safe partition anchors. The facade also publishes connected service graphs, their attached endpoint units and supports, optional supported clotheslines, its neutral concrete, border and trim keys with stable named variants. Roof antennas and crossarm masts publish exact supports, arms, internal cable paths and stable external cable attachments. The rest covers lights, signage, screens, facade style, measured wall depth, opaque slab bands, facade equipment, fire escape and roof bulkhead.

The generator checks itself before returning: openings fit their edge and their floor, no two openings on a floor overlap, a 0.3 m minimum pier between them, floor elevations contiguous from ground zero, every requested aperture carved exactly where asked with a floor tall enough to contain it, every floor plate large enough to host the core rectangle an interior needs, no glass crossing the band that hides a slab, nothing hung on a facade covering an opening, the structure inside the parcel footprint, and GLB geometry matching the blueprint exactly. `CONTRACT.md` has the closed error set, each error naming the numbers that made the request infeasible.

## How it works

Facades come from a split grammar per building type and tier: bay rhythm, column material, window proportion, balcony rules, curtain states. The floor solver searches legal splits between aperture bases, so a bridge always lands on a real walking surface. Massing picks a box whose plates share one core placement behind the facade. The concrete field keeps fixed 2 x 1 m panels, with unmatched face or storey space as equal solid borders, and floor bands close through convex corners with fitted joins. Core size follows the actual storey heights and the interior's published stair arithmetic; a skewed lot gets the same 5 degree frame search as the interior. A setback steps in only while that shared placement remains, and a lot that can host none is named before anything is built. Every opening is grid-cut into the wall, watertight and free of T-junctions, and lined by a reveal back to the unit that fills it.

A window is a real unit: a closed frame profile with reveal depth, a mullion grid splitting it into panes no larger than the tier's structural limit, neutral glass recessed behind the profile and a fitted roller shade. The shade publishes exact closure from 0 to 100 percent and supports per-opening open-percentage overrides. Sparse damage targets one explicit pane and leaves the rest of the unit intact. The family and tier pick the facade style: a curtain wall on office and corpo towers (a continuous glazed skin, thin mullions, a head spandrel over each ceiling plenum and slab edge, transom lights over the doors), clean mullioned glazing on flush panels, thin panel relief, or a ribbed megablock with small deep-set windows scattered inside the panel grid and utility boxes bolted to it. On a punched facade the glass fills its hole and the frame ring straddles the edge, half over the glass and half over the wall. Condenser clusters use modeled fan guards, blades, hubs and wall brackets and connect to supported dimensioned pipe routes. Industrial faces can add fitted duct runs, a selected solid span may carry a supported 12- or 15-strand cable bundle with slack and a wall entry, and residential clotheslines hang from paired wall mounts. Compact commerce, restaurant and coffee-shop buildings can use a framed 4 to 12 m open frontage with published navigation clearance. Shared balcony bands cover bay, Juliet and full-frontage variants; office curtain walls add fitted access on alternating floors while retaining the glazing beside it. Long public frontages repeat the complete main entrance set at metre-aligned positions and publish each secondary connection. Signs are modular: one letter per cell, each luminous glyph recessed inside its own metal case, running as a marquee band over the entrance or stacking into a blade sign that protrudes edge-on from the facade and reads from both sides. Signs and ad screens scan for clear facade space, then fit by size and face. The roof carries a stair-head cutout with its housing, a room with four walls and a door onto the roof. Fitted rooftop equipment includes guarded HVAC and cooling-tower fans, tanks, vents, stacks, solar panels, dishes and use-specific assemblies. Whip antennas and crossarm masts publish their internal cables and stable external fittings for a downstream span generator. Every artifact stays clear of the roof access. Eligible buildings may carry a fire escape whose platforms serve a real window on every floor they pass.

The research behind the dimensional rules is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

The whole surface is a JSON request in and files out, offline and deterministic, so it drops into a batch script, a build step or an agent tool loop without a server. `CONTRACT.md` plus `schemas/` describe the request, the result and the closed error set well enough to call it without reading the code, and the feasibility constants let a caller compose valid requests up front.

## Consumers

[urbe](https://github.com/hec-ovi/urbe) is a deterministic city sandbox that generates thousands of these buildings from one seed: it feeds parcels from its city plan and aperture requests from its bridge and tube layer, then fills the shells with [interiorforge](https://github.com/hec-ovi/interiorforge) and textures them with [pbrforge](https://github.com/hec-ovi/pbrforge).
