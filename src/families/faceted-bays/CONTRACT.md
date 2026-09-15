# Faceted bays

Fits repeated three-plane glass bays, solid panel piers and concrete floor-group caps.

- Entry: `family` from [index.ts](index.ts), implementing [BuildingFamily](../api.ts). Input and output types: [FamilyInput, FamilyPlan and DecorationContext](../api.ts). Example: [fixture.json](fixture.json).
- Dimensions: 12 m cells, two 1.5 m cheeks at 45 degrees, a 5 m front, a 3 m panel and a 1 m pier with a 0.4 m vertical window. Unbound extents are `3.5 + 12n` m with a 0.5 m parcel margin. Minimum available rectangle: 16.5 m each side; fixed faces require 15.5 m each side.
- Ground: supplied height, opaque panels, main-entry fields, corner ledges and a wrapping cap. The host places doors. Groups above ground contain up to four floors; the first floor is an opaque bay plinth when the group has multiple floors. Every group preserves the supplied floor grid. The roof ends flat under a 0.32 m cap within the final floor; `parapetHeight: 0` matches reference `193250`.
- Fixed faces preserve every input corner and edge number. Bays use three flat fields on those reserved receiving faces. Unbound faces have real angled cheeks. Host structural backing is 0.12 m inside the face. Panel decoration, caps and screens stay within the parcel and clear actual openings and bridge cuts.
- Decoration adds 1.5 m panel divisions, fasteners, vertical pier ribs, concrete caps and framed 1:2 portrait screens stacked inside a solid panel field. `adScreens: off` omits screens. The builder's prior floor owner is restored.
- Host owns formed blinds, scenic rooms, clear and black glass, room lighting, entrance motion, apertures and bridges. Material roles are the final catalog slots in [index.ts](index.ts). No trees are added.
- Errors: `RangeError` for malformed/non-CCW rectangles, fewer than two floors, a floor below 3 m or a rectangle unable to fit one complete cell per face.
- References: `photomode_14092026_193212`, `193225`, `193240`, `193250`. These use pale metal sheets, narrow vertical slots, faceted glazing and grey separators.

Check: `npm test -- src/families/faceted-bays/family.test.ts` from Exterior. Dependencies: [family API](../CONTRACT.md), [Materials](../../../../materials/CONTRACT.md).
