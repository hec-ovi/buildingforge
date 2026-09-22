# Industrial framed towers

`family` implements [BuildingFamily](../api.ts). The reference is `factory-towers.md` and `factory-towers-repeated-framed-bays.png` in the building handoff. Weathered concrete frames, projecting belts, recessed glazing and cross-braced service spines establish the architecture without sign text.

The input is a finite CCW rectangle at least 16 × 16 m, with at least three storeys, each at least 3 m. Invalid dimensions raise `RangeError`. A free fit reserves 1 m around the body for its mitred relief. Fixed faces retain every supplied corner and keep relief inside the parcel.

Floor zero has complete `paired-glass` entrance candidates and no authored windows. Upper windows are real opening fields with sill and head derived from each actual floor height. Exterior groups cover floors 1–3, 4–6, and so on; the last group may be shorter. Their X braces occupy separately identified opaque spines, while the large frame groups never redefine interior floor levels. No balconies or decorative door promises are emitted.

Decoration builds fitted closed panel geometry, three-storey cross braces, vertical supports and broad section belts. Every layer subtracts actual windows, doors, cassette and pocket motion envelopes and supplied connection cuts. `builder.floor` is restored. Surface mappings use world metres. Only the existing weathered/graphite concrete, frame metal and metal louvre material variants are referenced.

`family.test.ts` checks dynamic floor and opening alignment, complete edge partitions, minimum and rotated fixed fits, invalid inputs, bounded finite geometry and triangle-level window/entrance/pocket/connection clearance.
