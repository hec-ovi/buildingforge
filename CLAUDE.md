# exterior: deterministic building exterior generator

You own this box. You build only what lives in this repo.

## Context (general, do not expand it)
This repo is one isolated layer of a larger build: a seeded, deterministic city world that ends as a playable 3D game (map, buildings, transit, NPCs, quests). Nine layers are built in parallel by separate sessions, each locked to its own repo, coupled only through CONTRACT.md files. Never read another layer's code or tests, only its CONTRACT.md. Your raw requirements are in docs/REQUIREMENTS.md, in the user's own words: they win over any summary here.

## Scope
- In: parcel footprint and envelope, building type and quality tier, floor count, theme material set id, required apertures (bridges, AC tubes, tunnels, from the connections layer), options (balconies, external fire escape stairs on/off, signage, ad screens, roof artifacts, curtain state distribution).
- Out: a GLB shell, empty inside except one separator plane per floor, low polygon, correct outward normals, plus a JSON blueprint listing every floor with its exterior openings (doors, windows, balcony doors, apertures) at exact positions.
- Architecture logic, template based with seeded variation: column placement (concrete or steel by height and type), window sizing rules per type (a factory has few windows, an office tower is mostly glass with thin columns), door heights within human-sense limits (taller is fine, person-small is not), doors in material or glass by place kind.
- Shapes beyond boxes: octagonal, circular, pyramid, triangular, setbacks, sections thinner than others. The structure does not have to fill the whole parcel.
- Balconies for residential and hotel: real, varied dimensions between buildings, consistent style within one building.
- Windows: vertical open/close states (open, half closed, 80% closed) distributed by zone and tier for variety.
- Signage: marquee text with a max character limit, centered, or a logo plate with fixed aspect ratios (1:1, 3:2, 16:9). Screens, neon, pulsating lights, video projections and holographic ad placeholders where type and zone justify them. Exterior lights follow a density rule: not too many, not too few, researched.
- Faces that carry tiled materials are sized in exact tile units so textures tile perfectly, never stretch, never cut wrong.
- Preview: load one building standalone, orbit it, inspect every floor and opening.

## Out of scope
No interiors (not even stairs or elevators), no city layout, no path logic, no material image generation (you consume material sets by schema).

## Depends on
../atlas/CONTRACT.md (parcel spec), ../connections/CONTRACT.md (apertures), ../materials/CONTRACT.md (material set schema)

## Consumers
../interior, ../engine

## Working order
1. Deep research first: 2026 state of the art on procedural building generation (wave function collapse, shape grammars, facade layout solvers), real architecture rules for columns, windows, balconies. Compact conclusions to docs/RESEARCH.md.
2. Draft CONTRACT.md with schemas before code (interior is blocked on your blueprint format).
3. Implement with tests and the preview.
4. Keep CONTRACT.md and docs/INDEX.md current.

## Hard requirements
- Deterministic: same seed and inputs give identical GLB and blueprint. No LLM calls.
- Standalone: runs from parameter fixtures with no other layer present.
- Known failure modes to design against (they repeat in every generator the user has seen): inverted normals showing see-through walls, stretched or misaligned tiles, empty gaps between elements, overlapping windows and doors, walls at wrong angles.
- Preview UI follows src/ui/ with views/, widgets/, components/.

## Coordination
- Read docs/FEEDBACK.md at the start of every session.
- Write blockers and cross-layer questions to docs/ISSUES.md.

## Master requirements (background only)
docs/FULL-REQUIREMENTS.md holds the user's complete raw requirements for the whole project, so you see your surroundings. Read it once for awareness. It never widens your scope: what you build is defined by this file and docs/REQUIREMENTS.md only.
