# Service storage

Exports `family: BuildingFamily` from [index.ts](index.ts), implementing the public
[family API](../api.ts). `plan` and `decorate` are separately exported by their
local implementation files. This family imports no sibling implementation.

Reference: `storage-and-service-buildings.md` and
`worn-storage-building-and-shutter-bays.png`, with the shared interior/exterior
module alignment and decorative facade/access requirements. The image was
reviewed: broad dark roll shutters, fitted concrete dividers, separate human
entrance, service housings, small lamps and weathered concrete establish the
family. Bright cyan trim, foreground barriers and weeds are optional and omitted.

## Inputs and fit

- Four finite CCW rectangular XZ corners, at least **16 × 16 m**; 1–3 actual floor
  heights, each at least 3 m. Invalid input throws `RangeError`.
- Preferred ground height is 4.5 m. All bands, shutter heads, upper windows and
  fittings derive from supplied heights and resolved floor elevations.
- Free faces receive at least 0.5 m inset on each side and a half-metre fitted
  extent. The minimum 16 m parcel therefore holds a 15 × 15 m shell.
- Fixed faces preserve every input corner and edge index exactly. Their complete
  skin, guides and fixtures sit at or inward of the fixed face. Free faces project
  at most 0.12 m; both modes remain inside the supplied rectangle, including when
  rotated. No random state or seed-dependent topology is required.

## Shared bay and access layout

Every edge partitions completely into 0.6 m concrete piers, repeated broad bays,
and one 3.4 m side entrance field. Bay count targets 4.6 m panels; leftover width
is distributed equally among complete bays. A minimum free edge has two 4.6 m
shutter fields, four 0.6 m piers and one 3.4 m entrance field.

Ground shutter sections are explicitly `paired-solid` with `windows: []` and
`:sealed-shutter` IDs. They are **nonfunctional decorative panels over an opaque
host wall**: no access opening, navigation connection, door leaf, pivot or claimed
storage-room entrance is emitted. The real standard host entrance is eligible
only in a distinct `paired-glass`, `windows: []`, `:entrance` field. Every edge has
one such field so the host can select the actual street edge; unused fields stay
opaque. The host remains responsible for interior allocation and functional door
geometry. Automatic host industrial loading doors must not invent openings in
these sealed decorative bays.

Upper floors reuse the exact horizontal divisions and declare real windows in
the broad and entrance-width fields. Piers remain solid partition endpoints.
Upper windows have 0.22 m side margins, 0.95 m sills, 0.55 m head bands, and actual
height `floorHeight - 1.5`. Shared host interior/window construction supplies the
permanent backing, lining and returns; this family uses 0.12 m backing depth.
There are no balconies and one group covers the full low-rise body.

## Attached facade and reservations

The decoration contains weathered concrete bay panels, piers and floor bands;
ground-only metal shutter faces, horizontal roll seams, side guides, thresholds,
closed head housings and fixed lock covers; and pier conduits with small emissive
lamps. All geometry uses world-metre UVs. Lamps are emissive mesh fixtures, not
additional independent light records. Decoration restores `builder.floor` even
on failure.

Every attached piece is subtracted against the same face-plane reservations.
These include all actual windows and traversable openings; frame and approach
margins; transoms; glazing fields; the union of door clearances, cassettes and every
pocket leaf envelope; and supplied aperture polygons, conservatively enclosed by
their bounding rectangles. Reservations span all matching upper faces, so a
cross-storey cut or tall door/transom also clears the next floor's bands. The
reserved footprint remains empty through **every decoration depth**, keeping
swing motion and exterior approaches unobstructed. There are no ground props.
Published anchor seats, signs, screens, existing lights, balcony access and fire
escape strips are also protected. Lamps are omitted rather than fragmented where
their complete seat is unavailable. Slots/pieces may be clipped around exact
infrastructure cuts; functional aperture dimensions never change.

## Materials and verification

Existing final slots only:

| Roles | Catalog slot |
| --- | --- |
| ground, wall, inner-wall, column, wall-trim, roof | `cyberpunk/concrete-monolith/mid#weathered` |
| shutter | `cyberpunk/exterior-louvre/mid#metal` |
| window-frame, service-metal | `cyberpunk/metal/mid#paint` |
| service-light | `cyberpunk/paired-light-warm/mid#surface` |

[Contract tests](tests/contract.test.ts) call public `plan` and `decorate`. They
cover minimum parcels and floor counts, complete/aligned bays, dedicated host
entrance eligibility, actual upper windows, rejected invalid inputs, fixed rotated
rectangles, finite bounded geometry, floor ownership, dynamic elevations and
triangle-level exclusion of openings, pocket motion/approaches and cross-floor
apertures. Run `npm test -- src/families/service-storage/tests/contract.test.ts`
from `exterior`.
