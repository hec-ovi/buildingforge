# Mirror shutters

Builds ribbon glazing and tall mullion banks around a narrow service spine.

- Input: [`FamilyInput`, `DecorationContext`](../api.ts), [example](fixtures/frontage.json). Output: [`FamilyPlan`, `FamilyDecoration`](../api.ts). Export: `family` from `index.ts`.
- Dependencies: [family host](../CONTRACT.md), [Exterior](../../../CONTRACT.md). The host supplies scenery, formed coverings, glazing and room emitters.
- References: `photomode_15092026_131312`, `131319`, `131722`, `131727`, `131734`, `131745`, `131800`.
- Long faces: 5 m ribbon cells, two 5 or 10 m tall glazed banks, a 3 m spine with three 0.55 m windows. Short faces keep ribbons and the spine. Bronze mullions repeat at approximately 0.625 m. Four-floor groups have a continuous top cornice.
- Ground has pale 2.5 by 2 m panels and an entrance field, with no windows. Curved closed metal ribs project 2.1 m and carry warm strips. Free fits reserve 2.5 m around the shell; bound faces keep their exact coordinates and omit these projecting ribs.
- Minimum shell: 24 by 14 m. Free parcel: 29 by 19 m. At least two floors, each at least 3 m. Caller heights remain unchanged; windows leave 0.5 m for slabs. Invalid inputs throw `RangeError`.
- Decorations avoid doors and bridge cuts, stay within the parcel and restore `builder.floor`. `instances` requests existing `ornamental-tree` models in alternate side bays under the entry ribs. Their 2.1 by 6 by 2.1 m boxes retain crown clearance, omit the central entrance bay and remain inside the parcel. Bound faces emit no trees. No traversable balconies are added.
- Materials: the `materials` map in `index.ts` lists final catalog slots. Mirror backing and dark rooms use opaque reflective black glazing.
- Check: `npm test -- src/families/mirror-shutters/tests/contract.test.ts` from `exterior/`.
