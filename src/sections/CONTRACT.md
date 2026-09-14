# Facade sections

Fits dimensioned corner and facade sections into a maximum rectangle.

`new SectionAssembler().assemble(input)` returns an assembly; `sectionRoles(section, height)` returns its nine fields. Inputs: [assembly](schemas/input.schema.json), [section and height](types.ts). Outputs: [assembly and role fields](schemas/output.schema.json), [types](types.ts). No external dependencies.

Metres, CCW XZ, floor zero first. The construction grid is 0.5 m. The catalog has fixed 3 m corner extents and repeatable 4 m bays; square corners retain two fixed legs. Rounded corners use four broad glazed bays, each spanning three curve segments; chamfers use one planar horizontal ribbon face. Ribbon sections have fixed 1.5 m opaque sills, 1 m heads and 0.35 m glazing recesses. Solid 3 m end piers enclose that facade. Each section specifies fixed side, sill, head and depth dimensions. The middle is a complete opening field. Fields preserve full local maps.

Compositions: one rounded corner, two chamfered corners, or straight floor groups with exact 4 m cutbacks and one selected balcony floor. Output section spans partition each actual outline edge exactly. Curve tessellation does not introduce window jambs. Actual footprints can be smaller than the allowance. Group and floor identities remain explicit.

`RangeError` reports unknown composition, invalid rectangle/heights or a plate too small for complete sections. The caller checks parcel, circulation core and connection feasibility, places openings only in section fields and builds both wall faces, returns and glazing. Roof design is outside this box.
