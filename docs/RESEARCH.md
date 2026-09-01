# Research conclusions

Verified 2026-08-31 against npm and current engine/tooling docs. These choices drive the contract and the code.

## Generation approach
- CGA-style split grammar (CityEngine lineage): facade face -> vertical split (ground floor + proportional repeat of upper floors so a whole number always fits) -> per-floor horizontal split into bays -> each bay gets wall/window/door from the template. This is the production standard; WFC and ML solvers are wrong fits for a deterministic template+seed generator.
- Window placement is 1D interval splitting per floor strip: n = round(usableWidth / targetBayWidth), bayWidth = usableWidth / n, per-bay decision from the seeded stream.

## Determinism
- PRNG: sfc32 (inline, ~10 lines, passes PractRand). seedrandom npm is frozen since 2019; do not use.
- Sub-streams: hash (rootSeed + part path like "floor:3/face:2/windows") with cyrb128 into the sfc32 state. Order-independent: adding a feature never shifts unrelated streams.
- Floats: + - * / sqrt are exactly rounded (safe). Math.sin/cos/pow differ across JS engines; use precomputed constants for fixed angles (octagon etc) where easy.

## Mesh correctness
- glTF winding: counter-clockwise = front, right-handed, +Y up. Footprints normalized CCW from above (shoelace); wall quads (b0,b1,t1,t0) triangulated (0,1,2)(0,2,3) give outward normals automatically. Verify with dot(cross(e1,e2), outward) > 0.
- Windows are NOT boolean-cut (game low-poly consensus): each window is a separate small unit (frame + glass quad) floating 1-3 cm proud of the uncut wall strip. No CSG, no T-junctions, no gaps, no z-fighting.
- Real holes only where something passes through (ground doors, bridge/AC/tunnel apertures): cut by grid subdivision of the wall strip into lintel/opening/sill bands with shared vertices on cut lines. Never a boolean mesh library.
- T-junction rule: every vertex introduced on an edge appears in all faces using that edge; guaranteed when opening bounds are global grid lines of the strip.

## Texture tiling
- Per-face planar world-scale UVs: u = dot(p - faceOrigin, faceRightDir) / tileMeters, v likewise with up. 1 UV unit = 1 tile, wrap REPEAT.
- uDir is the face's own horizontal edge direction (projecting world X/Z stretches angled faces). UV origin at each face's bottom-left so tiling starts on a boundary. Snap bay widths/heights to whole tile multiples during layout; absorb remainders into corner/trim strips.

## Libraries (npm versions checked 2026-08-31)
- GLB writing: @gltf-transform/core 4.5.0 (Document API, validator-clean binary GLB, multiple materials, named nodes). three's GLTFExporter needs polyfills in Node; three stays preview-only.
- Polygon offset/clipping: clipper2-js 1.2.4 (Clipper2 port incl. offsetting). Integer coordinates: scale meters to millimeters before every polygon op -> fully deterministic. Straight skeleton unnecessary (miter offset covers setbacks; pyramid roofs computed from apex directly).
- Preview: three 0.185.1 (addons at three/addons/...), vite 8.2.2. Tests: vitest 4.1.11 (geometry and blueprint logic headless; viewer smoke-level only, jsdom has no WebGL).

## Architecture rules (sourced real-world numbers)

### Structure by height (CTBUH, Designing Buildings)
- 1-7 floors: reinforced concrete frame. 8-40 residential: concrete flat plate + shear walls (worldwide default). Tall offices: concrete core + steel/concrete perimeter. 200 m+ towers: ~63% concrete, ~35% composite; all-steel is extinct in new builds and reads as an older US office tower.
- Column grids: residential 3-4.5 m bays, office 6-9 m (9 m classic open plan), retail 7.5-9 m, warehouse 8-12 m, manufacturing 6-9 m.
- Column sizes: low-rise 0.3-0.45 m square, commercial 0.3-0.6 m, high-rise ground floors 0.6-0.9 m; taper with height. Steel exterior columns thinner: 0.3-0.5 m.
- Facade expression: exposed perimeter columns = concrete frames and pre-1960; curtain wall = post-1950s offices, module 1.2-1.8 m (1.5 m canonical), mullion 50-150 mm visible width.
- Setbacks (1916 NYC model): base block fills parcel 4-12 floors, steps back, slender tower on <= 25% of lot; wedding-cake = multiple 2-4 m setbacks.

### Floor-to-floor heights (m)
- Residential poor/mid 2.75-3.05; luxury residential 3.0-3.66; hotel guest 3.0-3.3; office 3.9-4.0 typical (3.66-4.27 range); hospital 4.2-4.5 modern; retail/lobby ground 4.5-6.0; industrial 6-12 clear single volume. Ground floor of any tower: 1.3-2x its upper floors.

### Windows
- WWR by type: factory 0.05-0.15 (daylight from roof: sawtooth/clerestory), police 0.10-0.20 (small, high-silled), poor residential 0.15-0.25, mid 0.25-0.35, luxury 0.35-0.60, hotel 0.30-0.50, hospital 0.20-0.35 (calm repetitive punched), office punched 0.30-0.45, office curtain wall 0.50-0.80, corpo HQ 0.70-0.95.
- Dimensions: residential 0.6-1.2 w x 0.9-1.8 h m (classic 0.9x1.5); hotel 1.2-1.8 w per room module or full-height 2.4 in upscale; office punched 1.5-2.5 w x 1.5-2.0 h.
- Sills: residential 0.75-0.9 m, office 0.7-0.9, hospital <= 0.91 (FGI: patients see out from bed), factory/police 1.5-2.0. Window head ~2.1-2.4 m, aligned with door heads (universal rule).
- Rhythm: one window per 3-4.5 m of residential facade, centered in bays; min pier between openings 0.3 m (typical 0.6-1.2). Openings never touch.

### Doors
- Single exterior 0.91 x 2.03 m; commercial height 2.13 m; double 1.83 m wide. Person-door leaf cap ~3.5 m tall; grand lobby = glazed portal frame around normal doors, not a giant door. Revolving: 2.26 m tall, 1.8-3.6 m dia.
- Loading dock 2.4-2.6 w x 2.7-3.0 h; drive-in roller 3.6-7.3 w x 3.6-6.1 h.
- Glass doors: retail, office, hotel, hospital, mid/rich residential lobby. Solid/metal: factory personnel, police secure, service, poor residential.

### Balconies
- Depth 1.2-1.8 m (usable min 1.2), width 2.4-4 m. Tiers: poor none or 0.9 juliet-ish, mid 1.2-1.5, rich/hotel 1.8-2.5 deep at full room width. Juliet: 0.1-0.45 m rail in front of full-height door, no slab.
- Railing 1.07 m (IBC multifamily). Stacked in vertical columns per unit (near-universal); cantilever <= 2 m without visible braces.

### Fire escapes (US exterior metal)
- Only on pre-1968, <= 7 floor, brick residential/mixed character; never modern towers. Stair width 0.56 m, balcony >= 0.91 m, landings 0.91 x 1.37 m, drop ladder ends one floor above street. Street facade on tenements, rear/side otherwise; zigzag serving 1-2 windows per floor.

### Facade lighting
- Wall wash: setback ~ wall height / 3, fixture spacing <= 1.3x setback. Graze: 0.15-0.3 m off wall, 0.6-1.5 m apart.
- Density heuristic: 1 accent fixture per structural bay (4-8 m) on lit facades; entrance zone 2-4 fixtures; most residential carries entrance lights only. Anti-failure: spacing < 2 m or > 12 m both read wrong.

### Signage
- Legibility (USSC): letter height ~ viewing distance / 120. Storefront band 0.6-0.9 m tall, base 3-4.5 m above sidewalk; projecting sign bottom >= 2.4 m. Marquee char limit = bandWidth / (0.7 x letterHeight).
- Billboard formats: bulletin 3.43:1, poster 2.14:1; logo plates 1:1, 3:2, 16:9 are real formats. LED media facades (pitch 40-100 mm, 40-70% transparent) only on corpo/office/hotel in dense zones.

### Roofs
- Parapet 1.07 m accessible (0.9-1.1 visually). Old residential: wooden water tank (4-6 m dia) on 3-6 m dunnage, bulkhead box 3-4 m, vents, antennas. Modern/rich residential: bulkhead, AC condenser rows, terrace, solar (1x2 m tilted modules).
- Office/corpo: cooling towers (3-8 m boxes), RTU clusters, BMU rail, masts; screened mechanical penthouse (louver band) is the realistic tower default. Hospital: helipad ~14x14 m with H, air handlers, generator. Factory: sawtooth glazing, stacks, ventilators, pipe bridges. Police/military: lattice comms masts 5-15 m, dishes, floodlights.

### Curtain states (field data: Rubin 1978, Rea 1984, Foster & Oreszczyn 2001)
- Mean facade occlusion ~40%; sun-facing sides more closed (78% vs 53%). Blinds barely move week to week: state is static texture, not a daily cycle.
- Generator heuristic: sun-facing facades {open 25%, half 35%, closed 40%}; shaded {45/30/25}. Residential evening lit fraction 30-60%, late night 5-15%. Cluster states slightly between neighbors; map onto the open / half / 80%-closed tri-state.
