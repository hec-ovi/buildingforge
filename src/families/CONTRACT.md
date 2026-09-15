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

Each child folder exports `family: BuildingFamily` from `index.ts`. Its contract links its inputs and outputs to [api.ts](api.ts), and documents the reference dimensions and error cases. No family imports a sibling family's implementation.

## In

`plan(FamilyInput)` receives four CCW XZ rectangle corners, actual floor heights (ground first), a seed and optional `fixedFaces`. Metres, +Y up. With fixed faces, preserve the exact rectangle and edge numbering. Otherwise fit inside it.

## Out

`FamilyPlan` follows the shared Assembly shape without its architecture ID. Every floor has an outline, sections, group and balcony section IDs. Groups cover consecutive floors. Use existing section techniques: paired-glass, paired-solid, paired-pier, deep-bay, ribbon-bay, frame-pier. Sections partition each outline edge. Optional section `windows` give explicit opening fields relative to that section's start; this supports a low light strip plus an upper window. Frame dimensions remain in `border`. Floor zero supports a main entrance and has no windows by default. `balconySections` means a usable balcony door; ornamental bands belong to decoration.

`decorate({builder, layout, material})` adds only family-owned parts. Set `builder.floor` to the owning floor while building floor details and restore it afterwards. Keep clear of actual openings, door motion and supplied apertures. Respect the parcel. A referenced material must resolve before the family is delivered. `materials` maps standard roles (ground, wall, inner-wall, column, wall-trim, window-frame, roof) to final catalog slots. Shared formed coverings, room scenery, seeded dark windows and lighting belong to the host.

Windows and sections may specify `panes: {cols, rows}`. Window sill/height are relative to the walking floor; offset is relative to the section start. `windows: []` keeps a section opaque while permitting host entrance placement on paired-glass ground fields. Custom families own their visible skin; the host keeps a structural backing 0.12 m inward and omits generic section finish. Decoration runs after scenic rooms and before the final light-mesh pass. It may append fully specified `layout.lights`.

Decoration may return `{instances:[{kind,position,size,rotation?}]}`. Kinds are ornamental-tree, palm and shrub; position is the root position in world metres, size is the allowed width/height/depth, rotation is radians. The host serializes these in `Blueprint.modelInstances`; the consuming engine instantiates existing models while preserving their proportions. Instances and canopies must fit the parcel and avoid reservations. No dummy anchor meshes.

## Geometry helpers

The API re-exports `MeshBuilder.part(name, {keepNode?, parent?, pivot?})`, yielding a `PartSink` with `box(material, centre, halfX, halfY, halfZ, uvMode?)`, `quadFacing(material, a,b,c,d, normal, uvs)` and `triFacing`.

`FacadeField(outline, edge)` exposes `length`, `dir`, `normal`, `point(u,y,depth)` and `solid(sink, material,u0,u1,y0,y1,front,back,mapU?,ends?,worldUv?)`; positive depth is outward. `tubeSegment(sink,material,start,end,radius)` emits a tube. `capFrame(outline)` supplies the frame for `capUp` and `capDown`. `Rng(seed,path)` provides `range`, `int` and `chance`. Public types are linked above.

`parapetHeight` optionally sets the extra roof edge height; zero retains a flush authored cap. Registered families own screen and mechanical decoration; the host retains explicit signage and entrance fixtures.

`groundFloorHeight` optionally selects a preferred total ground height; fixed connection bases retain priority. Host generation uses the registered family ID as `options.architecture`. Apertures reaching above ground fix the upper faces and require a rectangular parcel; other fixed shapes report `E_SCHEMA`. Basement-only cuts retain their original parcel faces while upper floors use the free family shape. Supplied cuts remain exact and ordinary openings that intersect their reservations are omitted. Multiple authored windows may share a horizontal span when their vertical intervals do not overlap.


Impossible fits raise `RangeError`. Each family is checked through its public `plan` and `decorate` exports.
