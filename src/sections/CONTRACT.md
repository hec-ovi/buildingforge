# Facade sections

Fits dimensioned corner and facade sections into a maximum rectangle.

`new SectionAssembler().assemble(input)` returns an assembly; `sectionRoles(section, height)` returns its nine fields. Inputs: [assembly](schemas/input.schema.json), [section and height](types.ts). Outputs: [assembly and role fields](schemas/output.schema.json), [types](types.ts). No external dependencies.

Metres, CCW XZ, floor zero first. The construction grid is 0.5 m. The catalog has fixed 3 m corner extents and repeatable 4 m bays; square corners retain two fixed legs. Rounded corners use twelve glazed chord sections per quarter circle; chamfers use one planar glazed face. Each section specifies fixed side, sill, head and depth dimensions. The middle is a complete opening field. Fields preserve full local maps.

Compositions: one rounded corner, two chamfered corners, or straight floor groups with exact 4 m cutbacks and one selected balcony floor. Output sections partition each actual outline edge exactly. Actual footprints can be smaller than the allowance. Group and floor identities remain explicit.

`RangeError` reports unknown composition, invalid rectangle/heights or a plate too small for complete sections. The caller checks parcel, circulation core and connection feasibility, places openings only in section fields and builds both wall faces, returns and glazing. Roof design is outside this box.
