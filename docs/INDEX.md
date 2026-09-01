# Box map

- root: the exterior generator, see CONTRACT.md. Depends on atlas (parcel), connections (apertures), materials (material keys).
- src/core: seeded rng, polygon math, request validation, error set.
- src/rules: template families and the researched numeric tables (docs/RESEARCH.md).
- src/layout: style freeze, massing, floor stack, facade bays, features. Depends on core and rules.
- src/mesh: winding-safe primitives, trapezoid wall cutting, caps, mesher. Depends on layout.
- src/materials: the materials box seen from here: theme index types, key resolution, glTF material building, and the node source that reads the database from disk.
- src/glb + src/blueprint: output writers. Depend on mesh, layout and materials.
- src/ui: preview app (views/, widgets/, components/). Depends on the generator entry only.
- schemas/, fixtures/, tests/: the contract surface and its proof.
