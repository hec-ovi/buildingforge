# Box map

| Box | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Exterior](../CONTRACT.md) | Builds one shell and its floor/opening blueprint | Atlas parcel, Connections apertures, Interior feasibility, Materials catalog | [Request](../schemas/building-request.schema.json), [blueprint](../schemas/blueprint.schema.json), [result](../src/types.ts) |
| [Facade sections](../src/sections/CONTRACT.md) | Fits fixed corners, horizontal ribbon facades and floor groups | Caller maximum rectangle and floor heights | [Input](../src/sections/schemas/input.schema.json), [output](../src/sections/schemas/output.schema.json) |
| [Building families](../src/families/CONTRACT.md) | Fits photographed facade families and their attached details | Facade sections, shared scenic rooms, Materials | [Input/output](../src/families/api.ts) |
| [Facade services](../src/facade-services/CONTRACT.md) | Fits attached services around reservations | Caller geometry and materials | [Input](../src/facade-services/schema/input.schema.json), [output](../src/facade-services/schema/output.schema.json) |
| [Preview](../src/ui/CONTRACT.md) | Displays a generated building and inspection controls | Exterior, Materials, Three.js | Request controls, GLB and blueprint |

- [Call guide](../SKILL.md): library and CLI usage.
- [Issues](ISSUES.md): interface proposals and unresolved constraints.
- `src/core`, `src/rules`: validation, polygon arithmetic and [canonical floor/window policy](../schemas/floor-constants.json).
- `src/layout`: [automatic architecture selection](../schemas/architecture-policy.json), floor stacks, volume fitting and section-driven openings.
- `src/sections/paired.ts`: rounded and rectangular facades assembled from complete two-room sections.
- `src/sections/garden.ts`: pale podium, fixed planted spine and tapered outer wings with base-relative height limits.
- `src/mesh/floorSlope.ts`: fits outer wing geometry and emitters to upper outlines while retaining the planted spine.
- `src/mesh`: shell walls with mitered inward lining, opening returns and closed frame/glazing sections.
- `src/families/registry.ts`: six explicit family IDs, their plans, material roles and decoration.
- `src/mesh/scenicCurve.ts`: shared room geometry derived from authored curved spans.
- `src/mesh/scenicLining.ts`, `wallBoundary.ts`: single window returns and room joins at the measured lining depth.
- `src/mesh/profiledBlind.ts`: formed slats with punched openings, folded lips, support clips and raised stacks.
- `src/blueprint`: versioned blueprint and per-floor room rectangles.
- `src/glb`, `src/materials`: GLB output and material resolution.
- `src/layout/validateLayout.ts`: final geometry and opening guards.
- [Preview layout](../src/ui/views/preview.json): control definitions rendered by the shared Form component.
- [Native finishes](../assets/native/INDEX.md): bundled material assets and recipes.
- [Requirements](REQUIREMENTS.md): local raw user instructions, excluded from git.

Roof surface identity is published in `Blueprint.roof.material` through the root blueprint schema.
