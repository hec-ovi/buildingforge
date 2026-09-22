# Residential courtyard

`index.ts` exports `family: BuildingFamily` through [the public API](../api.ts).

The enclosed residential frontage uses 4–5 m apartment sections with three-column, two-row physical windows. Weathered concrete panels, broad floor bands, exterior louver shutters, fitted window grilles, supported shallow steel canopies and attached drain risers follow those modules. The restrained materials intentionally omit the reference's vivid turquoise and advertising.

`plan` requires a CCW rectangle and at least two storeys, all at least 2.6 m high. The ground storey prefers 3.6 m. The actual building is at least 16 × 16 m. Free fitting reserves 4 m along edge zero for circulation and 0.65 m on the other sides, requiring a parcel at least 17.3 × 20.65 m in the supplied orientation. Fixed faces preserve the exact four corners and edge numbering.

Every edge is completely partitioned into repeated sections `rc:<edge>:<bay>`, stable between floors. The host may replace `rc:0:0` with a floor-connected stair door; its centre is half the first bay width. The family never creates independent stair or bridge geometry. Edge zero has no projecting ornaments so the host can use its full circulation reserve. Actual openings, including stair doors, door cassettes and supplied apertures, cut the permanent skin.

Each upper window starts 0.92 m above its walking floor and ends 0.62 m below the next floor. Ground modules expose no authored windows and remain eligible for the host entrance. The host builds permanent frames and the real pane grid from the authored opening fields. Decorations follow the resulting actual windows, and ornament-free openings remain geometrically unchanged. Fixed faces omit projecting shutters, grilles and canopies when there is no parcel clearance.

The shell uses `cyberpunk/concrete-monolith/mid#weathered`, with `#cast` on inner faces. Graphite concrete/coating and galvanized steel are resolved native catalogue slots. Family skin extends back 0.22 m, leaving finished lining to the host. Canopies have fitted diagonal brackets and ribs; drainpipes enter the wall at the top and bottom. `decorate` restores `builder.floor`.

The host's detail ladder removes small louver edge boxes, canopy ribs and closely spaced grille bars at `fittings`. At `coverings` it retains a representative shutter/grille bay while dropping their repetitions, and places the remaining repeated canopies on alternate upper floors. Permanent window frames, pane grid, wall panels and floor bands remain; every retained canopy keeps its roof and fitted diagonal supports.

One back-face bay also carries a five-segment sagged clothesline, two wall brackets and two folded fabric pieces on fitted clips. It occupies the opaque wall below the window sill, avoids all traversal reservations, and survives simplification at under 250 triangles. Its subdued cloth binds `cyberpunk/fabric/poor#flat`; host stairs bind `cyberpunk/service-alloy/poor#brushed`.

The public tests cover deterministic plans, complete section partitioning, minimum/invalid input, exact fixed and rotated faces, floor alignment, fitted ornament geometry, stair-door cuts and supplied bridge reservations. References: the residential courtyard/stairs and procedural services images in the 2026-09-02 building handoff, read alongside the interior/exterior alignment requirements.
