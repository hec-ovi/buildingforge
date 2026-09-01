# Box map

- root: the exterior generator, see CONTRACT.md. Depends on atlas (parcel), connections (apertures), materials (material keys).
- src/core: seeded rng, random seeds for standalone runs, polygon math, request validation, error set.
- src/rules: template families, the researched numeric tables (docs/RESEARCH.md), the published proportion table and its fit arithmetic, and the signage glyph cells.
- src/layout: style freeze, massing, floor stack, facade bays, glazing pane grids, facade relief, the per-face obstacle map and its clear-rectangle scan, features. Depends on core and rules.
- src/mesh: winding-safe primitives, trapezoid wall cutting, caps, mesher, the wall depth measure. Depends on layout.
- src/materials: the materials box seen from here: theme index types, key resolution, glTF material building, and the sources that read the database from disk or over HTTP.
- src/glb + src/blueprint: output writers. Depend on mesh, layout and materials.
- src/ui: preview app (views/, widgets/, components/), orbit and street-eye cameras. Depends on the generator entry only.
- schemas/, fixtures/, tests/: the contract surface and its proof.
