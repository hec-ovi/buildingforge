# Balcony grid

Builds paired glazed rooms beside stacked recessed loggias.

## Input and output

`family` in [index.ts](index.ts) implements [BuildingFamily](../api.ts): `plan(FamilyInput): FamilyPlan`, `decorate(DecorationContext): void`, and material role slots.

References: `photomode_14092026_194149`, `194158`, `194233`, `194241`, `194252`, `194450`, `194501`. These show the same tower from different faces.

## Dimensions

Each 17 m repeat has 10 m paired glazing, a 1 m dividing pier, a 5 m loggia and a 1 m shared pier. A terminal loggia keeps a 3 m end pier: its 2 m recess plus a 1 m structural corner strip. The other end keeps a 1 m pier. Adjacent notches remain separate, and every outline is a simple polygon. Free sides fit `17n + 3` metres with 0.25 m exterior reserve; 20.5 m is the minimum available side. Loggias retain a real floor, ceiling and side returns. Their rails are 1.105 m high, with metal posts and glass infill; four housed ceiling strips point into the gallery. The 0.3 m slab fronts use cast concrete.

The far glazed end turns through a 5 m radius quarter circle, with twelve geometric slices grouped into four continuous glass fields. Its two adjacent straight glass fields are 6 m wide. The loggia order on the right face reverses so the rounded corner joins glass on both sides. The solid ground-floor corner follows the same radius and slices directly below the glazing, continuing the curve down to grade.

Front rail glass sits 0.025 m behind its metal posts. The roof edge is a 0.3 m concrete parapet.

Rich and high-rich roofs with roof artifacts enabled carry a furnished terrace in place of the seeded roof artifacts. A continuous 1.2 m glass and metal guard runs along the parapet. The actual roof polygon and the stair door govern placement: a two-metre clear spine runs from the door toward the far roof edge, and every bay keeps a walking apron before the next is placed. When space permits the roof holds a pergola bar court, a salon court, a quiet garden with timber loungers and a screened bank of three HVAC units, published as the roof's only `roof.artifacts`; courts and equipment drop in count rather than crowding a small roof. The bar has a working aisle, a backbar, bent-wire stools with woven seats and a supported overhanging stone counter; the salon combines sofas and a separate dining pocket. Planting is authored compound fern geometry: irregular root crowns carry 8 to 9 tapered curved fronds with paired narrow pinnae and smooth normals, and the leaf material fits its veins once per leaflet. Walnut and smoked veneer, veined stone, bronze rails and padded textile seating distinguish the finishes; collidable metal and mineral backing carries furniture and decks. Sixteen supported warm luminaires publish ordinary `accent` light records (edge 0, position on the lamp's roof mount), meshed by the shared light-fixture pass. Dimensions are authored proportions.

Window reveals belong to the permanent shell through its complete wall depth.
Removing `scenery:*` for a paired interior leaves jambs, heads and sills closed,
including the curved spans. Scenic receiver surfaces begin behind those reveals,
so furnished and unfurnished windows each draw one surface at the join.

Ground has no windows and leaves an entrance field on each of its four straight faces; its rounded corner is solid cladding. Ground and piers use jointed coated metal; window rims use cast concrete. Skins follow actual window, door and aperture holes. Caller floor heights are retained; normal clear height is 4 m on the shared 4.5 m pitch. Upper floors form one repeatable group. No bridge, tree or advertisement is authored.

`fixedFaces` preserves the supplied rectangle, corner order and edge numbers on every floor. Complete room groups remain 17 m; extra width is absorbed by end piers. Two 5 m glazed end fields wrap its preserved square corner. Gallery rails stay inside those faces, with shallow decks. Decorations are omitted where a door or infrastructure aperture reserves the section. Upper section IDs beginning `bg:gallery:` identify gallery windows. `balconySections` is empty because these loggias are exterior ornament.

RangeError: non-finite or nonrectangular input, clockwise corners, fewer than two floors, a floor under 3 m, or a fitted side under 20 m.

## Dependencies and checks

[Family API](../CONTRACT.md), [Exterior](../../../CONTRACT.md). Shared host rooms supply formed blinds, room imagery and ceiling light states. This family retains clear transmissive panes even for unlit scenic rooms, so removing scenery for a generated interior never leaves opaque black panes. The mineral roof and lining variants keep collidable material kinds. Call decoration after scenic rooms to publish gallery emitters into their existing light records. Facade materials use the paired metal, paired glass and cast concrete slots; room linings use `wall/rich#meridian-mineral` and the roof `roof/mid#meridian-mineral`. The terrace uses the Materials catalog's `corpo-plaza-*`, `meridian-*`, `hiromi-fern`, `hiromi-fern-stem`, `fabric/mid#linen` and shared metal keys.

Run `npm test -- src/families/balcony-grid/balcony-grid.test.ts` from `exterior`.

Terrace checks: `tests/roof-terrace.test.ts` covers rotated 40 and 60 m roofs, the clear door spine at mesh level, the guard height, valid foliage, lamp placement and idempotent decoration; `tests/terrace-foliage.test.ts` covers fern and bent-wire geometry. The Engine collision and glow checks in `tests/roof-terrace.test.ts` run when the Engine checkout sits beside Exterior. The consumer light pool is unshadowed, so these lamps cast no projected beam shadows.

Premium furnished balcony roofs explicitly receive 35,000 additional triangles and 3 MiB of packed geometry allowance for the detailed fern crowns and constructed outdoor furniture. This is an additive roof allowance in `schemas/geometry-budget.json`; it does not multiply facade or tower budgets and never applies when roof artifacts are off or the tier/family is ineligible. Geometric containment, clearance, circulation and export validation remain hard checks.
