# Exterior

Version 0.57.0. Generates a building exterior GLB and its floor/opening blueprint from a seeded request. Floors default to 4 m clear height with the slab/ceiling zone additional; ordinary facades use broad glazing. Each floor includes a contained rectangular room envelope. Optional section compositions build rounded or chamfered corners and grouped floors with selected balconies. The shell carries windows, doors, curtains, balconies, facade services and materials, with replaceable floor slabs.

Each of the six building families is also authored once as nine repeated pieces: a corner, a bay and an entrance bay in a ground, middle and crown band, on the 8 m module every Atlas lot is a whole number of. A bay repeats across a facade, a middle band repeats up it, and both fuse without a joint. See [the piece kit](src/kit/CONTRACT.md).

See [SKILL.md](SKILL.md) for a copyable call, [CONTRACT.md](CONTRACT.md) for the interface, and [docs/INDEX.md](docs/INDEX.md) for the box map.

## Run

Requires Node with TypeScript stripping, npm dependencies, and Interior's published `dist/feasibility.js` build beside this checkout. The orchestrator supplies that build. Textured output reads `URBE_MATERIALS_DIR` or the sibling Materials catalog.

```sh
npm ci
npm run generate -- fixtures/residential-mid.request.json out --keys-only
npm run kit -- --out out/kit
npm run preview
npm run typecheck
npm test
npm run preview:build
```

The preview selects a fixture, seed, style and shape, with orbit, street-eye and inside-shell cameras. `?fixture=architecture-01-rounded-corner` opens the rounded specimen; `&view=interior` inspects its inner faces. The CLI writes assets to the supplied output directory; the browser build uses ignored `dist/`. Geometry, openings and materials come from the same generation call.

Generation is deterministic for a fixed request, catalog and texture options. External textures can fall back to material keys with a reported reason; `--embed` requires maps. [Interface proposals](docs/ISSUES.md) record the coordinated work and remaining visual review.
