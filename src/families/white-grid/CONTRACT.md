# White grid

Builds an ivory diagonal frame around tall glazing and a reflective metal podium.

- In: [FamilyInput](../api.ts), [example](fixtures/reference.json).
- Out: [FamilyPlan and decoration](../api.ts), exported as `family` from `index.ts`.
- Depends on [family host](../CONTRACT.md) for shell, glass, formed coverings, rooms, lighting and dark-room states, and [Materials](../../../../materials/CONTRACT.md) for catalog slots.

## Dimensions

A 13.5 m glazed bay sits between 1.5 m piers. Bays repeat horizontally. Three upper floors form one diagonal-brace group; later groups reverse direction. A terminal group uses the remaining floors. Each pier has one fitted panel per floor. The diagonal is one third of its group's height in vertical section. Its skin is 0.14 m thick and stands ahead of the reflective floor ribbons. Eight panes fill each reference bay, about 1.69 m each. Upper openings keep 0.22 m sill and 0.28 m head bands.

The family requests a 5 m ground default through `groundFloorHeight`. Ground has no windows and divides into 40 percent lower metal base and 60 percent upper podium, with an ivory top fascia, giving the reference's 2 m plus 3 m composition. The planner consumes the caller's actual floor heights; fixed bridge elevations stay pinned.

Unbound plates fit complete bays on the 0.5 m grid and reserve at least 0.5 m around the shell for 0.28 m relief. They need at least 17.5 m on both axes. Fixed faces retain exact corners and edge numbers, expand bay widths to consume the edge, and put panel fronts on the face plane. Wider fixed bays increase their brace group to `round(3 * widestBay / 13.5)` floors, keeping at least three. Door envelopes and supplied aperture bounds cut through decoration with 0.12 m clearance. Diagonal braces intentionally cover part of glazing.

`RangeError`: nonrectangular or nonfinite coordinates, clockwise corners, less than 16.5 m on an axis, insufficient room for one complete bay with relief, fewer than four floors, or any floor height below 3 m. Seed is accepted for the shared room system; structural geometry is deterministic.

## References and surfaces

`photomode_14092026_193550`, `193600`, `193615`: three-floor ivory braces, single-panel columns, slim glazing divisions, reflective floor ribbons and dark podium. Bridge spans are caller-owned.

Ivory uses `cyberpunk/ivory-panel/mid#native` with metre UVs; reflective ribbons and podium use `cyberpunk/facade-chrome/mid#native` with one exact map per receiving face, retained across cuts. Narrow frames use `cyberpunk/paired-frame-metal/mid#surface`. Geometry supplies panel joints and depth.

Check: `npm test -- src/families/white-grid/white-grid.test.ts` from `exterior/`.
