# Portal-pier tower

Purpose: builds broad graphite piers around deep vertical slots and pale illuminated entrance portals.

- Entry: `family` from [index.ts](index.ts), ID `mirror-frame`.
- In/out: [FamilyInput, FamilyPlan and DecorationContext](../api.ts). [Fixture](fixtures/reference.json).
- References: `photomode_15092026_132025`, `132033`, `132039`, `132044`.
- Geometry: 8 m repeats contain a 5 m slot and 3 m pier. Balanced end piers absorb the remainder. Three-storey groups begin with an opaque slot floor and finish with stepped pier heads. Glazing is recessed 0.65 m. All supplied floor heights are retained; ground slots contain no windows. The pale entrance portal spans two storeys when the first upper slot is opaque; its doors stay on the ground floor.
- Unbound plates reserve a 2 m forecourt around the shell for 0.46 m piers, 0.73 m heads and vegetation. Fixed faces retain the exact input rectangle and edge numbering, using recessed windows and the shared wall finish without outward ornaments.
- Free glazing slots place casing faces 0.41 m inward and panel returns reach the 0.65 m recess. The stepped heads finish the roof with no extra parapet.
- `decorate` adds jointed pier panels, pale entrance surrounds and planters. Openings and connection cuts remain clear. It appends strip fixtures with 14 m light ranges to `layout.lights` for the host to mesh and serialize, restores `builder.floor` and is deterministic.
- RangeError: non-rectangle/clockwise/non-finite input, insufficient room for one 8 m repeat, empty heights or a storey below 3 m total.
- Materials: graphite panels use `paired-cladding-metal/mid#obsidian`; entrance trim fits the complete `portal-limestone/mid#native` image to each stone face. All roles and complete keys are in [index.ts](index.ts).
- Dependencies: [family host](../CONTRACT.md), [Exterior](../../../CONTRACT.md), [Materials](../../../../materials/CONTRACT.md). The host owns glazing, formed coverings, room scenery and floor elevations.
- Vegetation: returns paired palm and shrub instances beside the entrance, with planters and all canopy bounds inside the forecourt. Reservations suppress any plant that cannot fit. The host imports its existing models and preserves their proportions inside the supplied bounds.
- Check: `npm test -- src/families/mirror-frame/contract.test.ts` from `exterior/`.
