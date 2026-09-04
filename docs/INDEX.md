# Box map

- root: the exterior generator, see [CONTRACT.md](../CONTRACT.md). Depends on atlas (parcel), connections (apertures), interior (core fit), materials (material keys).
- src/facade-services: isolated arithmetic for attached service units, connected pipe and duct graphs, wall supports, clotheslines, hanging garments and sparse pane damage. See [CONTRACT.md](../src/facade-services/CONTRACT.md). Depends on nothing; the caller supplies its geometry, reservations and material keys.
- src/ui: preview app with orbit and street-eye cameras. See [CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root generator entry, Three.js, browser DOM and WebGL, and the read-only materials route.

## Root modules

- src/layout/structuralProfile.ts and src/mesh/structuralPier.ts: shared fitted pier dimensions and closed bevelled concrete geometry.
- src/mesh/doorPanels.ts and src/mesh/doorSurround.ts: mapped solid leaf panels and closed bevelled entrance surrounds.
- src/mesh/utilityBox.ts: fitted service cabinet lids, hardware and ventilation details.

- src/mesh/lightFixture.ts: fitted metal housings with recessed diffusers and projecting protective caps.

- src/mesh/coveringHousing.ts: closed side, head and sill returns between glazing and recessed coverings.

- src/layout/commercialFacade.ts: entrance-led shop displays and sparse upper commercial glazing, fitted around reserved openings.

- src/layout/groundFacade.ts: sparse paired street-level windows fitted around reserved access.
- src/mesh/windowTreatments.ts: separate shell-only ground privacy and permanent external metal louvres.
- src/mesh/windowWeathering.ts: exact sill and jamb stains clipped to solid facade receivers.

- src/layout/roundedOutline.ts: circular corner returns shared by floor rings and every facade consumer.
- src/layout/materialPlan.ts: family-specific named concrete finishes and office slat coating, shared by blueprint and GLB.
- src/layout/exteriorStyle.ts: nine coordinated geometry policies and seeded selection, paired with Materials bindings/exterior-styles.json.

- schemas/proportions.json: entrance, upper-window, shopfront and solid ground-podium sizing; shared by layout and validation.

- src/core: seeded rng, random seeds for standalone runs, polygon math, request validation, error set.
- src/rules: template families, the researched numeric tables (docs/RESEARCH.md), the published proportion table and its fit arithmetic, and the signage glyph cells.
- src/layout: style freeze, massing and the shared core placement every plate keeps (src/layout/core.ts, using the browser-safe static view of Interior's published constants in src/layout/coreFeasibility.ts), floor stack, facade bays, shared balcony bands, exact panel seams and partition anchors, glazing pane grids, facade relief, the per-face obstacle map and its clear-rectangle scan, condenser unit clusters, stable roof artifact IDs, fitted mast assemblies and external cable attachments, features. Depends on core and rules.
- src/mesh: winding-safe primitives, shared tube sections, fitted facade relief, recognizable facade and roof equipment, mast geometry, trapezoid wall cutting, caps, mesher, the wall depth measure. Depends on layout.
- src/materials: the materials box seen from here: canonical keys, authored GLB variant slots, theme index types, glTF material and sidedness building, and the sources that read the database from disk or over HTTP.
- src/glb + src/blueprint: output writers. Depend on mesh, layout and materials.
- schemas/, fixtures/, tests/: the contract surface and its proof, including the linked external antenna attachment schema.
- reference coverage and cross-layer ownership: docs/REFERENCE-COVERAGE.md.
- src/mesh/doorHardware.ts: fitted leaf-owned pull handles and levers; shares the door frame material.
- src/mesh/spandrel.ts: closed opaque infill fitted from frame front to glass back, with matte column material.
- src/mesh/venetianBlind.ts: fitted office slats and supports at the published closure percentage.
