# Changelog

0.58.4: the suite is one case per contract promise through the public entries, 77 cases in about six seconds.

0.58.3: every kit band measures 4.5 m including crown parapets and roof caps, with matching assembly heights, blueprints and parcel fits.

0.58.2: balcony ground bands carry the loggia section, white grid middle pieces measure 4.5 m, and every kit family has backing with clear openings and watertight seams.

0.58.1: every kit family accepts two floors with the crown directly on the ground band and matching blueprint heights and openings.

0.58.0: kit assemblies accept parcel requests and publish the shared blueprint from authored piece openings.

0.57.0: the kit CLI publishes deterministic pieces and a manifest for six families, with JSON schemas for catalog metadata and world space placements.

0.56.0: each family is nine pieces (`corner`, `bay`, `entrance-bay` in `ground`, `middle`, `crown` bands) on the 8 m module every Atlas lot is a whole number of. A run boundary falls in the middle of a joint pier and a band boundary in the middle of the floor ribbon, so bays fuse horizontally and bands fuse vertically. `PieceManifest.sections` publishes the outline each boundary presents. Signage is published as anchors. A complete set is 66.8 KiB (mirror-frame) to 145.3 KiB (mirror-shutters); all six together are 631 KiB. `generate` remains the landmark path.

0.55.1: a welded shell costs about 1.82 vertices per triangle on the 500-parcel city, against 0.76 distinct positions. Coincident faces are 0.1 percent and are the two-sided floor slabs.

0.55.0: the budget takes repeat detail, never form, and never a parcel's architecture. The allowance is published per shell in [the policy](schemas/geometry-budget.json). Over budget a shell sheds fittings, weathering, covering housings, scenic fixtures and coverings in that order and records them in `blueprint.geometry.simplified`.

0.54.0: a door costs what an opening of its size costs. The casing is the welded extruded ring with a zero-height bottom member; leaf panes are their two visible faces; handle backplates and roses are plates.

0.53.1: door handle backplates are drawn as their visible face (80 vertices a leaf).

0.53.0: a machine-checked geometry budget in `blueprint.geometry`, enforced with `E_GEOMETRY_BUDGET`: 50,000 triangles and 3 MiB for an ordinary shell, three times both for a tower of nine floors or more. Normals export as normalized shorts under `KHR_mesh_quantization`. Coverings, louvres, head baffles, garden fronds, scenic and soffit luminaires and facade fixing heads carry their repeat in the material map.

0.52.0: every exported primitive is welded and indexed, with attributes snapped to a 1e-5 grid and 16-bit indices below 65,536 vertices.

0.51.0: opening frames are one welded extruded ring, mitred at the corners, with openings of the same size sharing one built profile.

0.50.0: window coverings are one fitted panel between head and bottom rail, with the blade pitch in the blind map.

0.49.0: six modular facade families, paired rounded and rectangular facades, tapered garden towers, enclosed garden balconies, layered corporate sectors, formed louvers, scenic window rooms, seeded automatic family selection, 4 m clear floors, generous ordinary glazing, native finishes, closed inward shells and per-floor room envelopes.
