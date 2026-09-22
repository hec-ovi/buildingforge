# Building family modules

Purpose: fit one architectural family and add its attached decoration.

| Family | Shape |
| --- | --- |
| [Corporate sectors](corporate-sectors/CONTRACT.md) | Panel wings, slit windows, cassettes and rear screen |
| [Faceted bays](faceted-bays/CONTRACT.md) | Three-plane bays and grouped concrete caps |
| [White grid](white-grid/CONTRACT.md) | Ivory diagonal braces over reflective ribbons |
| [Balcony grid](balcony-grid/CONTRACT.md) | Recessed loggias and one curved glazed corner |
| [Mirror shutters](mirror-shutters/CONTRACT.md) | Ribbon glazing, bronze banks and narrow service spine |
| [Mirror frame](mirror-frame/CONTRACT.md) | Graphite piers and deep glazed slots |
| [Residential courtyard](residential-courtyard/CONTRACT.md) | Worn apartment bays, shutters, grilles and a reserved street-connected stair frontage |
| [Residential serviced](residential-serviced/CONTRACT.md) | Rounded residential corner, continuous spandrels, supported condensers and fitted risers |
| [Residential megablock](residential-megablock/CONTRACT.md) | Long residential slab with grouped floors, heavy horizontal bands and vertical divisions |
| [Industrial framed](industrial-framed/CONTRACT.md) | Tall outer frames and braces around recessed multi-floor glazing |
| [Industrial solid](industrial-solid/CONTRACT.md) | Broad stacked concrete sections, angular supports and narrow real slot glazing |
| [Service storage](service-storage/CONTRACT.md) | Low concrete body, explicitly sealed broad shutter panels and a separate usable entrance |

Each child folder exports `family: BuildingFamily` from `index.ts`. Its contract links its inputs and outputs to [api.ts](api.ts), and documents the reference dimensions and error cases. No family imports a sibling family's implementation.

## In

`plan(FamilyInput)` receives four CCW XZ rectangle corners, actual floor heights (ground first), a seed and optional `fixedFaces`. Metres, +Y up. With fixed faces, preserve the exact rectangle and edge numbering. Otherwise fit inside it.

## Out

`FamilyPlan` follows the shared Assembly shape without its architecture ID. Every floor has an outline, sections, group and balcony section IDs. Groups cover consecutive floors. Use existing section techniques: paired-glass, paired-solid, paired-pier, deep-bay, ribbon-bay, frame-pier. Sections partition each outline edge. Optional section `windows` give explicit opening fields relative to that section's start; this supports a low light strip plus an upper window. Frame dimensions remain in `border`. Floor zero supports a main entrance and has no windows by default. `balconySections` means a usable balcony door; ornamental bands belong to decoration.

`decorate({builder, layout, material})` adds only family-owned parts. Set `builder.floor` to the owning floor while building floor details and restore it afterwards. Keep clear of actual openings, door motion and supplied apertures. Respect the parcel. A referenced material must resolve before the family is delivered. `materials` maps standard roles (ground, wall, inner-wall, column, wall-trim, window-frame, roof) to final catalog slots. Shared formed coverings, room scenery, seeded dark windows and lighting belong to the host.

Windows and sections may specify `panes: {cols, rows}`. Window sill/height are relative to the walking floor; offset is relative to the section start. `windows: []` keeps a section opaque while permitting host entrance placement on paired-glass ground fields. Every family keeps finished inner wall faces and full-depth window returns in its permanent shell, independently of removable window scenery. Consumers furnishing real interiors retain that facade and use the room envelope only for partitions. Custom families own their visible skin; the host keeps structural backing at `wallBackingDepth` (default 0.12 m inward), reserves at least another 0.12 m for its lining and omits generic section finish. The `parapet` material role supplies an authored roof edge finish. Decoration runs after scenic rooms and before the final light-mesh pass. It may append fully specified `layout.lights`.

Decoration may return `{instances:[{kind,position,size,rotation?}]}`. Kinds are ornamental-tree, palm and shrub; position is the root position in world metres, size is the allowed width/height/depth, rotation is radians. The host serializes these in `Blueprint.modelInstances`; the consuming engine instantiates existing models while preserving their proportions. Instances and canopies must fit the parcel and avoid reservations. No dummy anchor meshes.

## Geometry helpers

The API re-exports `MeshBuilder.part(name, {keepNode?, parent?, pivot?, sloped?})`, yielding a `PartSink` with `box(material, centre, halfX, halfY, halfZ, uvMode?)`, `quadFacing(material, a,b,c,d, normal, uvs)` and `triFacing`. `sink.mapped(transform)` places vertices during generation and recomputes face normals; `sloped: true` marks already fitted positions so the common taper pass leaves them in place.

`FacadeField(outline, edge)` exposes `length`, `dir`, `normal`, `point(u,y,depth)` and `solid(sink, material,u0,u1,y0,y1,front,back,mapU?,ends?,worldUv?)`; positive depth is outward. `tubeSegment(sink,material,start,end,radius)` emits a tube. `capFrame(outline)` supplies the frame for `capUp` and `capDown`. `Rng(seed,path)` provides `range`, `int` and `chance`. Public types are linked above.

`ProfiledBlind.build(sink, frame, width, bottom, top, front, closure)` builds the shared blind: a head rail, one fitted panel over the covered travel at the 0.14 m blade pitch, the raised stack and a bottom rail. `frame` is [BlindFrame](api.ts), with horizontal direction/normal and `point(u,y,depth)`; dimensions are metres, closure is 0 to 100 percent. Coverings use `cyberpunk/paired-blind/mid#blades`, with a 0.56 x 0.56 m repeat; rails use `cyberpunk/paired-frame-metal/mid#surface`. World metre UVs bind with `variant.tiling ?? entry.tiling`. Families may attach these as permanent exterior ornaments independently of removable room scenery.

`parapetHeight` optionally sets the extra roof edge height; zero retains a flush authored cap. Registered families own screen and mechanical decoration; the host retains explicit signage and entrance fixtures.

The host measures tiled UVs on final receiving faces after placement and fits exact plates within 0..1. Named variants and authored image crops persist in every texture mode. Wire anchors publish empty nodes at their attachment positions.

`groundFloorHeight` optionally selects a preferred total ground height; fixed connection bases retain priority. Host generation uses the registered family ID as `options.architecture`. Apertures reaching above ground fix the upper faces and require a rectangular parcel; other fixed shapes report `E_SCHEMA`. Basement-only cuts retain their original parcel faces while upper floors use the free family shape. Supplied cuts remain exact and ordinary openings that intersect their reservations are omitted. Multiple authored windows may share a horizontal span when their vertical intervals do not overlap.


Impossible fits raise `RangeError`. Each family is checked through its public `plan` and `decorate` exports.

Lower-income families participate in automatic selection for `poor` and `mid` tiers through [architecture-policy.json](../../schemas/architecture-policy.json). Residential programmes select the three residential forms; factories select towers from three floors and storage through three floors; low-rise commerce can select storage. Luxury selection retains the accepted family list. New forms use whole generated plans; the six existing piece recipes remain unchanged.

`residential-courtyard` reserves a four-metre front setback in its free plan. This is space outside its complete rectangular floor outline, so the room envelope never includes it. The host fits a switchback stair and real service doors before the shared Interior core is allocated. `Blueprint.fireEscape.connected` publishes floor-door IDs, exact flight elevations, risers per half-flight, landing depth and stair width. All floor doors open at their own floor elevations, the lowest landing has an open street approach, and each upper landing is guarded. Fixed parcel faces that cannot reserve the stair envelope do not receive an unattached stair; automatic selection uses a different lower-income form there.
