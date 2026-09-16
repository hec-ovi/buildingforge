# Corporate sectors

Builds a dark corporate tower with grouped panel wings, recessed window channels, folded balcony cassettes, a screened rear face and a canopied entrance.

- In: [FamilyInput](../api.ts), four CCW rectangle corners, actual floor pitches, seed and fixed-face flag.
- Out: [FamilyPlan and DecorationContext](../api.ts), exported as `family` from `index.ts`.
- Dependencies: [building families](../CONTRACT.md), host glazing, formed coverings, scenic rooms, door motion and material resolution.

## Dimensions

Ground has a 6 m entry sector and opaque panels. The first three upper floors have 1.5 m slit-window cells. Upper groups contain 3 to 6 floors where possible; the final group accepts the remaining floors.

A nominal 28 m front repeat contains an 8 m projecting panel wing, a 4 m recessed window channel, a 4 m setback spacer and one 12 m enclosed cassette. The cassette has a solid left third and two covered right windows, a continuous lower apron, folded lower edge and common top. At 4.5 m pitch its body is 3.3 m high, leaving 1.2 m between boxes. The repeat scales across complete sections, with 0.5 m end trims. Panel wings have full-depth side returns and three panel courses across a four-floor group. Side shields step across two-storey fields, beside paired narrow windows and a partly covered mechanical strip. The opposite face holds a portrait screen, fitted at 1:2.

Floor pitches are supplied, normally 4.5 m. Low windows start at 0.3 m; the upper slit starts 1.18 m below the next floor. The host retains all floor and bridge elevations. Decorative balconies are closed cassettes and publish no traversable balcony doors.

Unbound shells reserve a 1.5 m perimeter. Panel wings project 1.2 m, cassette fronts 1.43 m and group rims 1.45 m; the channel and spacer skin sits at 0.06 m. Fixed faces keep the exact input corners and shift the whole upper composition and its glazing recesses inward by 1.45 m. The host structural backing is 1.6 m inward. Minimum shell face: 17 m. Minimum floors: five. Minimum pitch: 3.5 m. Invalid, nonrectangular or undersized inputs throw `RangeError`.

## Decoration

Facade parts stop at actual openings, door cassettes and bridge cuts. The screen is omitted if a bridge intersects its frame. Ground lights publish cyan 1,200 lm base emitters and 1,800 lm canopy emitters with a 10 m range. The host supplies the room lights and dark glazing. Decoration returns two `ornamental-tree` instances per entrance where planters fit, using existing assets within 2.1 x 3 x 1.05 m boxes. Fixed-face shells omit planters without an exterior margin.

Materials: `corporate-panel#native` for panels; `paired-frame-metal#surface` for frames; `paired-cladding-metal#surface` for canopy and rims; `paired-light-cool#surface` for cyan lights; `corporate-screen#native` for the screen. All keys use `cyberpunk/<name>/mid`.

References: 191741, 191756, 191921, 191940, 191950, 192017, 192054, 192102, 192116, 192217, 192417, 192427, 192445 and 192455 from the saved 2026-09-14 exterior photographs. The frame, seams and cassettes are geometry; surface grain and screen artwork are material maps.

Check: `npm test -- src/families/corporate-sectors/tests/contract.test.ts` from `exterior`.
