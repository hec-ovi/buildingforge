# Exterior

Version 0.47.0. Generates a building exterior GLB and its floor/opening blueprint from a seeded request. Each floor includes a contained rectangular room envelope. The shell carries windows, doors, curtains, balconies, facade services and materials, with replaceable floor slabs.

See [SKILL.md](SKILL.md) for a copyable call, [CONTRACT.md](CONTRACT.md) for the interface, and [docs/INDEX.md](docs/INDEX.md) for the box map.

## Run

Requires Node with TypeScript stripping, npm dependencies, and Interior's published `dist/feasibility.js` build beside this checkout. The orchestrator supplies that build. Textured output reads `URBE_MATERIALS_DIR` or the sibling Materials catalog.

```sh
npm ci
npm run generate -- fixtures/residential-mid.request.json out --keys-only
npm run preview
npm run typecheck
npm test
npm run preview:build
```

The preview selects a fixture, seed, style and shape, with orbit/street-eye cameras and clipping. Production assets are generated into ignored `dist/`. Geometry, openings and materials come from the same generation call.

Generation is deterministic for a fixed request, catalog and texture options. External textures can fall back to material keys with a reported reason; `--embed` requires maps. [Interface proposals](docs/ISSUES.md) record the coordinated work and remaining visual review.
