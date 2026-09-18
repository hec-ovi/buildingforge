# Changelog

0.58.0: kit assemblies accept parcel requests and publish the shared blueprint from authored piece openings.

0.57.0: the kit CLI publishes deterministic pieces and a manifest for six families, with JSON schemas for catalog metadata and world space placements.

0.56.0: each family is authored once as nine pieces instead of a whole building per parcel. `corner`, `bay` and `entrance-bay` in a `ground`, `middle` and `crown` band, on the 8 m module every Atlas lot is a whole number of. A run boundary falls in the middle of a joint pier and a band boundary in the middle of the floor ribbon, each half leaving off the face its neighbour supplies, so bays fuse horizontally and bands fuse vertically; `PieceManifest.sections` publishes the outline each boundary presents and all six families mate on every one. Signage is published as anchors, never baked. Measured keys-only: a complete set is 66.8 KiB for mirror-frame to 145.3 KiB for mirror-shutters against the 3.53 MB mean shell it replaces, 25 to 54 times smaller, and all six sets together are 631 KiB. A 56 x 40 m, 20 floor building is 480 instances of 9 pieces: mirror-frame 698 unique triangles and 0.12 MB against 98,688 triangles and 6.53 MB from the per-parcel path, balcony-grid 1,310 and 0.16 MB against 185,462 and 14.97 MB, corporate-sectors 880 and 0.14 MB against 353,348 and 21.86 MB. No coincident face pair anywhere in those assemblies, and scanning a 56 m facade at every 0.05 m of height finds no uncovered interval under 0.12 m, so no joint leaves a sliver. `generate` is untouched.

0.55.1: records what a welded shell costs per triangle. Measured on the 500-parcel city: 1.82 vertices per triangle against 0.76 distinct positions, so 98 percent of the split is the flat-shaded normal a hard edge needs and 2 percent is a UV seam. Coincident faces are 0.1 percent and are the two-sided floor slabs.

0.55.0: the budget takes repeat detail, never form, and never a parcel's architecture. The allowance is published per shell in [the policy](schemas/geometry-budget.json): the ordinary figure, three times that for a tower, never below the shell's own facade area at 13 triangles per square metre, and multiplied by the selected architecture's own factor, so an authored family is allowed what it costs. Over budget a shell sheds fittings, weathering, covering housings, scenic fixtures and coverings in that order and records them in `blueprint.geometry.simplified`. Rebuilt on the 500-parcel city of `engine/out/games/corporate-streets-500`: 77 of 77 shells export, none loses its selected family, none sheds detail; ordinary 32, mirror-frame 11, faceted-bays 10, balcony-grid 8, mirror-shutters 5, white-grid 4, rounded-corner 3, paired-rectangular 2, corporate-sectors 2. Mean 3.37 MB and 58,060 triangles, largest 17.28 MB and 308,760 triangles.

0.54.0: a door costs what an opening of its size costs. The casing is the welded extruded ring with a zero-height bottom member, leaf panes are their two visible faces, and handle backplates and roses are plates. Measured keys-only on `engine/out/games/corporate-streets-500` p18 (hotel, 208 windows, 120 two-leaf balcony doors): 132,519 -> 106,511 vertices, 73,166 -> 60,642 triangles; a balcony door 458 -> 292 vertices.

0.53.1: door handle backplates are drawn as their visible face, so hardware costs 80 vertices a leaf instead of 120. Measured keys-only on `engine/out/games/corporate-streets-500` p18 (hotel, 120 two-leaf balcony doors): 132,519 -> 122,859 vertices, 73,166 -> 68,336 triangles; leaf hardware 28,560 -> 19,040 vertices.

0.53.0: a machine-checked geometry budget, reported per shell in `blueprint.geometry` and enforced with `E_GEOMETRY_BUDGET`: 50,000 triangles and 3 MiB for an ordinary shell, three times both for a tower of nine floors or more, measured on the runtime packing. Normals export as normalized shorts under `KHR_mesh_quantization`. Coverings, louvres, head baffles, garden fronds, scenic and soffit luminaires and facade fixing heads carry their repeat in the material map; panels seated on a closed wall field drop their buried rear face. Measured keys-only over the 77 parcels of `engine/out/games/corporate-streets-500`: 326.5 -> 189.7 MB and 4,982,110 -> 3,298,976 triangles, median 1.72 MB and 31,544 triangles, largest 8.40 MB and 143,014 triangles. One parcel (p18, an eight-floor hotel with 328 openings) measures 73,166 triangles and is refused.

0.52.0: every exported primitive is welded and indexed, with attributes snapped to a 1e-5 grid and 16-bit indices below 65,536 vertices. Measured keys-only on `engine/out/games/corporate-streets-500`: p0 118,774 -> 90,688 vertices, 4.39 -> 3.20 MB; p21 71,882 -> 61,543 vertices, 2.64 -> 2.12 MB. Twelve-parcel sweep: 45.9 -> 38.4 MB at the same 590,302 triangles.

0.51.0: opening frames are one welded extruded ring, mitred at the corners, with openings of the same size sharing one built profile. One ring drops from 128 to 48 vertices. Measured keys-only on `engine/out/games/corporate-streets-500`: p21 (residential, 260 windows) 114,282 -> 71,882 vertices, 53,286 -> 36,326 triangles, 4.13 -> 2.64 MB; p13 (commerce) 14,198 -> 11,398 vertices, 0.53 -> 0.43 MB; p0 (offices) 124,534 -> 118,774 vertices. Twelve-parcel sweep: 51.6 -> 45.9 MB, 656,286 -> 590,302 triangles.

0.50.0: window coverings are one fitted panel between head and bottom rail, with the blade pitch in the blind map. Measured keys-only on `engine/out/games/corporate-streets-500`: p0 (offices, 13 floors) 833,874 -> 124,534 vertices, 415,656 -> 60,986 triangles, 31,775,428 -> 4,820,100 bytes; p21 (residential, 8 floors) 287,258 -> 114,282 vertices, 139,774 -> 53,286 triangles, 10.40 -> 4.13 MB. Twelve-parcel sweep: 435.0 -> 51.6 MB, 5,945,106 -> 656,286 triangles, 5.9 -> 2.0 s.

0.49.0: corporate candidates require three complete facade blocks; deep shell walls and opening returns meet at shared corner miters.

0.49.0: enclosed central garden balconies, base-relative wing tapers, layered corporate sectors, closed facade transitions and one-metre scenic window rooms.

0.49.0: six modular facade families with shared room detail, source-model planting requests and fixed bridge elevations.

0.49.0: tapered garden towers with planted facade bands, pale podiums and reflective dark windows.

0.49.0: formed perforated louvers, cyan room lighting records, clear upper glazing and graphite metal finishes.

0.49.0: paired rounded and rectangular facades with authored scenic rooms, ceiling fixtures and coverings.

0.49.0: seeded automatic luxury-family and rounded-section selection with fitted plans and portable native finishes; configurable 4 m clear floors, generous ordinary glazing, reference-authored cut-face ribbons and closed inward shells with per-floor room envelopes.
