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
- Interior blocker label: on a 12 x 28 m mirror-frame plate at twelve floors, `coreFeasibility` returns `blocker: compact_depth` with `compactDepthOk: true`, `crossDepthOk: true` and a band over `minCoreLength`; the real miss is opening and adjacency reservations (`maxElevators: 0`). The label should name the reservation miss so a producer can answer it.
- Human review: material quality, AC sides, door/frame joins, gray glazing, traversable roof/fire-escape routes and final appearance.

## Open requests to other boxes

### Interior and Engine: the shell GLB requires KHR_mesh_quantization

Exported normals are normalized signed shorts. `extensionsRequired` lists `KHR_mesh_quantization`. three.js reads it natively; a reader built on glTF Transform must register `KHRMeshQuantization`. Positions and UVs stay float.

### Engine and Interior: consume the piece catalog

`npm run kit -- --out out/kit` publishes six families and `kit.json` under the [kit schema](../schemas/kit.schema.json). `planAssembly` returns the [placement schema](../schemas/placement.schema.json), including world space signs and doors. Engine instances these files; `generate` serves landmarks.

Lot edges accept 8N metres for integers N from two; floors accept integers from two. Every catalog band is 4.5 m including the crown cap. Floor slabs, roof and wire anchors belong to the building. Ground entrance pieces contain their door nodes. `assembleFromPieces` also supplies building parts and addressable doors.

Open for Interior: one interior per band kind, aligned with the published band heights and piece boundaries.

## garden-taper stays a landmark design

The planted spine keeps a fixed width in complete 10 m pairs while both glazed wings narrow on every upper floor.
Wing slope depends on base width and total upper height, ending in 1.5 m roof tips with at least 0.3 m setback per metre of rise.
Rigid 8 m bays and identical 4 m corner arms cannot preserve the fixed spine and the changing wing widths under translation and Y rotation.
A crown only taper removes the continuous wing slope; a fixed floor count still leaves lot dependent slopes and different middle floor sections.
The design requires separate spine, wing and sloped corner pieces with another placement contract, so it remains a landmark generated per parcel.
