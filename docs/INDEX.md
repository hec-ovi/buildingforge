# Box map

- root: the exterior generator, see [CONTRACT.md](../CONTRACT.md). Depends on atlas (parcel), connections (apertures), interior (core fit), materials (material keys).
- src/facade-services: isolated arithmetic for attached service units, connected pipe and duct graphs, wall supports, clotheslines, hanging garments and sparse pane damage. See [CONTRACT.md](../src/facade-services/CONTRACT.md). Depends on nothing; the caller supplies its geometry, reservations and material keys.
- src/ui: preview app with orbit and street-eye cameras. See [CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root generator entry, Three.js, browser DOM and WebGL, and the read-only materials route.

  Reflection lighting: `src/ui/views/lighting.ts` supplies a neutral environment and low-angle facade lights for material inspection.

## Root modules

- src/layout/buildingGrid.ts: phase-aligned rectangular plate fitting and setbacks on the supplied construction grid. Facade panels fit their own border remainders inside those plates.
- src/layout/plateCore.ts: shared core fit on rectangular construction axes; aperture-constrained polygons retain their permitted frame search.
- src/layout/massing.ts: complete structural plates with preferred circulation perimeter space; actual opening spans determine final core clearance.
- src/layout/corePreflight.ts: final opening-aware core placement through Interior's browser-safe feasibility surface, using the measured shell depth.
- src/layout/roofAccess.ts: roof cutout and enclosure fitted to the shared solver's actual stair footprint.
- src/layout/roof.ts: roof equipment placed around the final stair enclosure; facade fittings freeze before opening geometry and core placement.
- src/layout/structuralProfile.ts and src/mesh/structuralPier.ts: shared fitted pier dimensions and closed bevelled concrete geometry.
- src/mesh/doorPanels.ts and src/mesh/doorSurround.ts: mapped solid leaf panels and closed bevelled entrance surrounds.
- src/layout/pocketDoor.ts and src/mesh/pocketDoor.ts: fitted ground entrance cassettes, reserved leaf travel and opaque sliding assemblies.
- src/layout/openingEnvelope.ts: complete opening assembly reservations shared by walls, glazing and facade attachments.
- src/layout/obstructions.ts: facade placement scans use each fitting's complete dimensions at every size.
- src/mesh/utilityBox.ts: fitted service cabinet lids, hardware and ventilation details.

- src/mesh/lightFixture.ts: fitted metal housings with recessed diffusers and projecting protective caps.

- src/mesh/coveringHousing.ts: closed side, head and sill returns between glazing and recessed coverings.

- src/layout/commercialFacade.ts: entrance-led shop displays and sparse upper commercial glazing, fitted around reserved openings.

- src/layout/groundFacade.ts: sparse paired street-level windows fitted around reserved access.
- src/layout/floorStack.ts: ground-volume preference fitted before upper storeys; exact connection bases retain their published height limits. Inputs: building request and proportions; output: blueprint floor elevations.
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
- src/mesh/doorHardware.ts: fitted leaf-owned pull handles and levers; shares the door frame material.
- src/mesh/spandrel.ts: closed opaque infill fitted from frame front to glass back, with matte column material.
- src/mesh/venetianBlind.ts: fitted office slats and supports at the published closure percentage.

- src/materials/native: seeded building palettes and bundled image-derived map loading. Depends on Materials from-image contract and [binding schema](../schemas/native-finishes.schema.json); publishes native material metadata in GLB extras. Sources, prompts and CLI requests: [assets/native/INDEX.md](../assets/native/INDEX.md).
- src/mesh/panelField.ts: fitted concrete panel faces, bevels and recessed joints, cut around published openings.
