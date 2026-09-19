# Box map

Version 0.58.5.

| Box | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Exterior](../CONTRACT.md) | Builds one shell and its floor/opening blueprint | Atlas parcel, Connections apertures, Interior feasibility, Materials catalog | [Request](../schemas/building-request.schema.json), [blueprint](../schemas/blueprint.schema.json), [result](../src/types.ts) |
| [Facade sections](../src/sections/CONTRACT.md) | Fits fixed corners, horizontal ribbon facades and floor groups | Caller maximum rectangle and floor heights | [Input](../src/sections/schemas/input.schema.json), [output](../src/sections/schemas/output.schema.json) |
| [Building families](../src/families/CONTRACT.md) | Fits photographed facade families and their attached details | Facade sections, shared scenic rooms, Materials | [Input/output](../src/families/api.ts) |
| [Piece kit](../src/kit/CONTRACT.md) | Publishes watertight pieces, parcel placements and the shared opening blueprint; assemblies start at two floors | Building families, Exterior blueprint helpers and GLB writer, Materials keys | [Request](../schemas/kit-request.schema.json), [kit](../schemas/kit.schema.json), [placements](../schemas/placement.schema.json), [blueprint](../schemas/blueprint.schema.json) |
| [Facade services](../src/facade-services/CONTRACT.md) | Fits attached services around reservations | Caller geometry and materials | [Input](../src/facade-services/schema/input.schema.json), [output](../src/facade-services/schema/output.schema.json) |
| [Preview](../src/ui/CONTRACT.md) | Displays a generated building and inspection controls | Exterior, Materials, Three.js | Request controls, GLB and blueprint |

- [Call guide](../SKILL.md): library and CLI usage.
- [Issues](ISSUES.md): interface proposals and unresolved constraints.
- `src/core`, `src/rules`: validation, polygon arithmetic and [canonical floor/window policy](../schemas/floor-constants.json).
- `src/layout`: [weighted automatic architecture selection](../schemas/architecture-policy.json), including fitted luxury families, floor stacks, volume fitting and section-driven openings.
- `src/sections/paired.ts`: rounded and rectangular facades assembled from complete two-room sections.
- `src/sections/garden.ts`: pale podium, fixed planted spine and tapered outer wings with base-relative height limits.
- `src/mesh/floorSlope.ts`: fits outer wing geometry and emitters to upper outlines while retaining the planted spine.
- `src/mesh/wallField.ts`: clips shell faces, lining and opening returns to shared corner miters while retaining opening coordinates.
- `src/mesh`: closed frame and glazing sections.
- `src/mesh/slabOutline.ts`, `slabSpans.ts`: floor edges follow flat and sloped facade profiles, close storey transitions and retain floor-level access corridors.
- `src/families/registry.ts`: six explicit family IDs, their plans, material roles and decoration.
- `src/kit/recipes`: one authored piece set per family on the 8 m bay module, with every band 4.5 m including crown details; the joint pier and floor ribbon meet at each boundary.
- `src/kit/author.ts`, `backing.ts`, `seams.ts`: authored surfaces, clear openings through the inner plane and shared seam vertices.
- `src/kit/cli.ts`, `export.ts`: deterministic piece files and one catalog for selected families.
- `src/kit/plan.ts`, `request.ts`, `blueprint.ts`: parcel requests, placements and blueprints from piece openings.
- `src/kit/assemble.ts`: instanced pieces with building slabs, roof, entrance and wire anchors.
- `src/families/corporate-sectors`: two complete special faces with balcony bands and broad cladding over a window grid, one screen face and one uncovered window/service face; candidates require 35 x 35 m and twelve floors, including space for facade projections.
- `src/mesh/scenicRoom.ts`, `scenicCurve.ts`, `scenicSlope.ts`: rectangular window scenes with a 1 m depth, one rear image, ceiling lights and fitted placement on curved or tapered facades.
- `src/mesh/scenicLining.ts`, `wallBoundary.ts`: single window returns ending at the glazing plane for authored scenery.
- `src/mesh/profiledBlind.ts`: a covering as fitted panels between head and bottom rail, with the blade pitch in the blind map.
- `src/families/api.ts`: shared geometry helpers, including the shared blind for family-owned exterior coverings.
- `src/blueprint`: versioned blueprint and per-floor room rectangles.
- `src/mesh/frameProfile.ts`, `frameRing.ts`: one welded extruded ring per opening, built once per size.
- `src/glb`, `src/materials`: GLB output and material resolution.
- `src/glb/weld.ts`: attribute snapping, vertex welding, 16-bit indices and quantized normals.
- `src/rules/geometryBudget.ts`, `simplification.ts`: the [per-shell allowance](../schemas/geometry-budget.json) and the order a shell sheds repeat detail to fit it.
- `src/layout/corePlateOffers.ts`: the plates one request may be built on, so a lot that can hold a core gets a building.
- `src/layout/validateLayout.ts`: final geometry and opening guards.
- [Preview layout](../src/ui/views/preview.json): control definitions rendered by the shared Form component.
- `vite.config.ts`: preview serving and source watching, excluding generated output trees.
- [Native finishes](../assets/native/INDEX.md): bundled material assets and recipes.
- [Requirements](REQUIREMENTS.md): local raw user instructions, excluded from git.

Roof surface identity is published in `Blueprint.roof.material` through the root blueprint schema.
