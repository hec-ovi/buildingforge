# Box map

- root: the exterior generator, see [CONTRACT.md](../CONTRACT.md). Depends on atlas (parcel), connections (apertures), interior (core fit), materials (material keys).
- src/facade-services: isolated arithmetic for attached service units, connected pipe and duct graphs, wall supports, clotheslines, hanging garments and sparse pane damage. See [CONTRACT.md](../src/facade-services/CONTRACT.md). Depends on nothing; the caller supplies its geometry, reservations and material keys.
- src/ui: preview app with orbit and street-eye cameras. See [CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root generator entry, Three.js, browser DOM and WebGL, and the read-only materials route.

## Root modules

- src/core: seeded rng, random seeds for standalone runs, polygon math, request validation, error set.
- src/rules: template families, the researched numeric tables (docs/RESEARCH.md), the published proportion table and its fit arithmetic, and the signage glyph cells.
- src/layout: style freeze, massing and the shared core placement every plate keeps (src/layout/core.ts, using the browser-safe static view of Interior's published constants in src/layout/coreFeasibility.ts), floor stack, facade bays, shared balcony bands, exact panel seams and partition anchors, glazing pane grids, facade relief, the per-face obstacle map and its clear-rectangle scan, condenser unit clusters, stable roof artifact IDs, fitted mast assemblies and external cable attachments, features. Depends on core and rules.
- src/mesh: winding-safe primitives, shared tube sections, fitted facade relief, recognizable facade and roof equipment, mast geometry, trapezoid wall cutting, caps, mesher, the wall depth measure. Depends on layout.
- src/materials: the materials box seen from here: canonical keys, authored GLB variant slots, theme index types, glTF material building, and the sources that read the database from disk or over HTTP.
- src/glb + src/blueprint: output writers. Depend on mesh, layout and materials.
- schemas/, fixtures/, tests/: the contract surface and its proof, including the linked external antenna attachment schema.
- reference coverage and cross-layer ownership: docs/REFERENCE-COVERAGE.md.
