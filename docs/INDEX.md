# Box map

| Box | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Exterior](../CONTRACT.md) | Builds one shell and its floor/opening blueprint | Atlas parcel, Connections apertures, Interior feasibility, Materials catalog | [Request](../schemas/building-request.schema.json), [blueprint](../schemas/blueprint.schema.json), [result](../src/types.ts) |
| [Facade services](../src/facade-services/CONTRACT.md) | Fits attached services around reservations | Caller geometry and materials | [Input](../src/facade-services/schema/input.schema.json), [output](../src/facade-services/schema/output.schema.json) |
| [Preview](../src/ui/CONTRACT.md) | Displays a generated building and inspection controls | Exterior, Materials, Three.js | Request controls, GLB and blueprint |

- [Call guide](../SKILL.md): library and CLI usage.
- [Issues](ISSUES.md): interface proposals and unresolved constraints.
- `src/core`, `src/rules`: validation, polygon arithmetic and dimension tables.
- `src/layout`: floor stacks, massing, openings and fitted attachments.
- `src/mesh`: shell walls with mitered inward lining, opening returns and closed frame/glazing sections.
- `src/blueprint`: versioned blueprint and per-floor room rectangles.
- `src/glb`, `src/materials`: GLB output and material resolution.
- `src/layout/validateLayout.ts`: final geometry and opening guards.
- [Preview layout](../src/ui/views/preview.json): control definitions rendered by the shared Form component.
- [Native finishes](../assets/native/INDEX.md): bundled material assets and recipes.
- [Requirements](REQUIREMENTS.md): local raw user instructions, excluded from git.
