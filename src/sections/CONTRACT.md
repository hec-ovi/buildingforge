# Facade sections

Fits dimensioned corner and facade sections into a maximum rectangle.

`new SectionAssembler().assemble(input)` returns an assembly; `sectionRoles(section, height)` returns its nine fields. Inputs: [assembly](schemas/input.schema.json), [section and height](types.ts). Outputs: [assembly and role fields](schemas/output.schema.json), [types](types.ts). No external dependencies.

Metres, CCW XZ, floor zero first. The construction grid is 0.5 m. The catalog has fixed 3 m corner extents and repeatable 4 m bays; square corners retain two fixed legs. Rounded corners use four broad glazed bays, each spanning three curve segments; chamfers use one planar horizontal ribbon face. Ribbon sections have fixed 0.5 m opaque sills and heads and 0.35 m glazing recesses. Ribbon middles meet at 0.12 m shared joints; a cut/flank end keeps its fixed 0.2 m end. Solid 3 m end piers and one opaque top-frame storey enclose that facade. Each section specifies fixed side, sill, head and depth dimensions. The middle is a complete opening field. Fields preserve full local maps.

Compositions: one rounded corner, two chamfered corners, or straight floor groups with exact 4 m cutbacks and one selected balcony floor. Output section spans partition each actual outline edge exactly. Curve tessellation does not introduce window jambs. Actual footprints can be smaller than the allowance. Group and floor identities remain explicit.

Paired compositions (`paired-rounded`, `paired-rectangular`) use 5 m room widths in alternating 10 m glazed and solid sections, 0.5 m end trims and a 10 m rounded corner radius. Their straight extents are `1 + 10n` metres. The rounded form has one broad curved corner and three right-angle corners. Glazed pairs contain four panes; the curved corner contains six broad panes across eighteen geometric slices. Floor rims total 0.5 m of each storey.

`RangeError` reports unknown composition, invalid rectangle/heights or a plate too small for complete sections. The caller checks parcel, circulation core and connection feasibility, places openings only in section fields and builds both wall faces, returns and glazing. Roof design is outside this box.
