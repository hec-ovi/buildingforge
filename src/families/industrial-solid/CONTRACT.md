# Industrial solid towers

`family` implements [BuildingFamily](../api.ts). The reference is the enclosed variant in `factory-towers.md` and `factory-tower-stacked-solid-sections.png` in the building handoff. Broad weathered concrete sections, projecting stepped belts and angular graphite supports surround small horizontal glazed slots.

Input: a finite CCW rectangle at least 16 × 16 m and at least three storeys, each at least 3 m. Impossible dimensions raise `RangeError`. Free fits reserve 1 m for the exterior relief; fixed faces preserve the exact supplied rectangle and constrain all ornament to its inside.

The ground floor exposes clear `paired-glass` main entrance candidates with no authored windows. Each upper occupied floor receives distinct real horizontal window openings with explicit sill and height. The slots are glazing, not vents or painted recesses. Complete slots share section boundaries with the solid support fields; actual floor heights determine every slab and band. Exterior sections group three upper floors with a shorter final group when required.

Decoration adds closed panel skins, broad two-step section belts, narrow slab joints and convex angular support strips within the solid fields. Every panel, support and belt subtracts window, door, cassette, pocket motion and connection reservations. `builder.floor` is restored. All texture coordinates are world metres and all materials resolve to existing concrete or frame metal variants.

`family.test.ts` checks complete sections and real slot fields, floor-height variation, minima, invalid/fixed/rotated fits, finite parcel-contained geometry and triangle-level clearance of occupied openings and infrastructure cuts.
