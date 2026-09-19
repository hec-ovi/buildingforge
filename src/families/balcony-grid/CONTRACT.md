# Balcony grid

Builds paired glazed rooms beside stacked recessed loggias.

## Input and output

`family` in [index.ts](index.ts) implements [BuildingFamily](../api.ts): `plan(FamilyInput): FamilyPlan`, `decorate(DecorationContext): void`, and material role slots.

References: `photomode_14092026_194149`, `194158`, `194233`, `194241`, `194252`, `194450`, `194501`. These show the same tower from different faces.

## Dimensions

Each 17 m repeat has 10 m paired glazing, a 1 m dividing pier, a 5 m loggia and a 1 m shared pier. A terminal loggia keeps a 3 m end pier: its 2 m recess plus a 1 m structural corner strip. The other end keeps a 1 m pier. Adjacent notches remain separate, and every outline is a simple polygon. Free sides fit `17n + 3` metres with 0.25 m exterior reserve; 20.5 m is the minimum available side. Loggias retain a real floor, ceiling and side returns. Their rails are 1.105 m high, with metal posts and glass infill; four housed ceiling strips point into the gallery. The 0.3 m slab fronts use cast concrete.

The far glazed end turns through a 5 m radius quarter circle, with twelve geometric slices grouped into four continuous glass fields. Its two adjacent straight glass fields are 6 m wide. The loggia order on the right face reverses so the rounded corner joins glass on both sides. Ground stays rectangular.

Front rail glass sits 0.025 m behind its metal posts. The roof edge is a 0.3 m concrete parapet.

Ground is rectangular, has no windows and leaves an entrance field on each face. Ground and piers use jointed coated metal; window rims use cast concrete. Skins follow actual window, door and aperture holes. Caller floor heights are retained; normal clear height is 4 m on the shared 4.5 m pitch. Upper floors form one repeatable group. No bridge, tree or advertisement is authored.

`fixedFaces` preserves the supplied rectangle, corner order and edge numbers on every floor. Complete room groups remain 17 m; extra width is absorbed by end piers. Two 5 m glazed end fields wrap its preserved square corner. Gallery rails stay inside those faces, with shallow decks. Decorations are omitted where a door or infrastructure aperture reserves the section. Upper section IDs beginning `bg:gallery:` identify gallery windows. `balconySections` is empty because these loggias are exterior ornament.

RangeError: non-finite or nonrectangular input, clockwise corners, fewer than two floors, a floor under 3 m, or a fitted side under 20 m.

## Dependencies and checks

[Family API](../CONTRACT.md), [Exterior](../../../CONTRACT.md). Shared host rooms supply formed blinds, room imagery, clear or dark glass and ceiling light states. Call decoration after scenic rooms to publish gallery emitters into their existing light records. Materials use existing paired metal, paired glass and cast concrete slots; no new assets.

Run `npm test -- src/families/balcony-grid/balcony-grid.test.ts` from `exterior`.
