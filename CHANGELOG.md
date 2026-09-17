# Changelog

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
