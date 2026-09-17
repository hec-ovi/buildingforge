# Interface proposals

| What | Why | Affected boxes |
| --- | --- | --- |
| Agree a replaceable circulation-feasibility input and one shared dimension authority | Generation imports Interior's published build and constants; a standalone checkout needs that sibling build. | Exterior, Interior, Atlas |
| Agree room minimums, permitted orientations, numerical tolerance and impossible-envelope errors | The geometric rectangle can use the existing construction grid; no minimum room program or 2 m/3 m facade clearance is settled. | Exterior, Interior |
| Publish perimeter usage, combined floor roles/programs, full protected volumes and partition attachments | `kind` is a program label. Irregular perimeter space must stay open, and openings are hard reservations. | Exterior, Interior, Simulation |
| Agree core/landing and separate roof-stair interfaces, including one-floor exceptions | Current roof access follows the shared core solver. Separate roof stairs require a coordinated handoff. | Exterior, Interior, Engine |
| Agree face identity for irregular shapes with planned holes and final connection validation | Aperture-bound parcels retain their exact faces; auto massing uses rectangles. Further shape freedom must preserve connection geometry. | Atlas, Exterior, Connections |
| Agree coordinate-transform ownership, source IDs and rule/catalog version metadata | The output shares the request frame; generator version alone is insufficient provenance. | Atlas, Exterior, Interior, Materials, Engine |
| Agree catalog ownership and missing-source policy | Bundled finishes coexist with Materials. External mode can report keys fallback; embedded mode requires maps. | Exterior, Materials, Engine |
| Agree ground/upper panel sizes, window density, roof programs and effect/performance budgets | The stage leaves these choices open; current geometry and appearance remain the review baseline. | Exterior, Materials, Engine |
| Coordinate stricter request validation and explicit glassless/doorless accessibility options | Existing validation tolerates some undeclared properties; changing accepted inputs needs coordination. Windows can already be disabled. | Atlas, Exterior, Engine |
| Assign outdoor scene ownership | Alleys, rear courts and between-building quest scenes need a separate owner and handoff. | Exterior, Streets, Quests, Engine |

## Verification still required

- Core fit: the residential fixture with seed `other-seed` fails the shared opening-aware fit (`E_CORE_PLATE`, floor 2, `w:2:0:3`, 1.00036 m available for 1.2 m circulation). Seeded feasibility needs joint review without changing openings or consumer rules in this phase.
- Core fit: the 36 x 9 m hotel case with windows disabled fails `compact_depth`. Area alone does not prove circulation fit.
- Human review: material quality, AC sides, door/frame joins, gray glazing, traversable roof/fire-escape routes and final appearance.

## Open requests to other boxes

### Materials: blade-pattern maps for coverings (2026-09-17)

A window covering is now one fitted quad; the blade pitch has to come from the map.
Measured on `engine/out/games/corporate-streets-500` p0 (offices, 13 floors): slat
geometry was 584,832 of 833,874 vertices (70 percent) and the shell was 31.8 MB.

Needed, one pattern variant each, tiling declared in world metres so a quad at
world-metre UVs lands on the real pitch:

- `cyberpunk/paired-blind/mid`: horizontal aluminium blades at a 0.14 m pitch, with
  the punched 0.076 x 0.026 m opening line the geometry used to carry. Today's only
  variant is `surface` (flat brushed aluminium at 0.5 x 0.5 m).
- `cyberpunk/exterior-louvre/mid` (+ its tier aliases): fixed exterior blades at a
  0.13 m pitch. Today's only variant is `metal` (flat, 0.5 x 0.5 m).

Meanwhile geometry uses the closest existing keys: `paired-blind#surface`,
`exterior-louvre#metal`, and `curtain/<tier>#slat` for venetian coverings, which
already carries a blind pattern at 1.5 x 3 m.

Three more repeats moved from geometry into the map in 0.53.0 and need the same
treatment, again as pattern variants with world-metre tiling:

- `cyberpunk/window-frame/<tier>`: a head-baffle comb at a 0.16 m pitch, for the
  recessed band above chamfered-corner ribbon glazing.
- `cyberpunk/ivory-panel/mid`: 22 mm fixing heads inset 45 mm from each corner of
  the 1.5 m faceted-bays panel module.
- `cyberpunk/corporate-panel/mid`: the 1 x 1.5 m panel joint, 32 mm wide, so the
  corporate cladding field reads as panels without a box per panel.

### Interior and Engine: the shell GLB now requires KHR_mesh_quantization (2026-09-17)

Exported normals are normalized signed shorts instead of floats, which is what
brings a shell inside the 3 MiB budget. `extensionsRequired` lists
`KHR_mesh_quantization`. three.js reads it natively; a reader built on glTF
Transform must register `KHRMeshQuantization`, and a strict reader that does not
support the extension will refuse the file. Positions and UVs stay float, so
world coordinates read exactly as before.

### Orchestrator: facade density by family, for the record (2026-09-17)

Measured keys-only on `engine/out/games/corporate-streets-500` at 0.55.0, every
parcel at full detail:

| family | triangles per square metre of facade |
| --- | --- |
| ordinary, paired, balcony-grid | 5 to 9 |
| faceted-bays | 13 |
| corporate-sectors | 20 to 22 |

`schemas/geometry-budget.json` gives an authored family its own allowance from
these figures, so no parcel loses its architecture. The largest shell in the city
is a corporate-sectors tower at 308,760 triangles and 17.28 MB.
