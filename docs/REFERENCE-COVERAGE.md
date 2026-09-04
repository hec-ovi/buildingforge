# Exterior reference coverage

This map records which layer owns each requirement from the September 2026 visual reference set.

## Owned by exterior

| Requirement | Published geometry or rule |
| --- | --- |
| Floor and panel alignment | `floors`, `slabBands`, `facade.grids`, and `facadeWindows` share the same metre-based floor and bay arithmetic. Panels stay 2 x 1 m; equal solid borders absorb remainders. |
| Door proportions | `door` assemblies publish the set, frame, reveal, threshold, motion clearance, and access role. Long frontages repeat fitted assemblies without cutting structural piers. |
| Curtain walls and service faces | Window panes follow the facade grid. Opening-free solid spans and safe partition anchors are published per face. |
| Facade service routes and clothes | `facadeServices` publishes connected pipe and rectangular duct graphs with fitted endpoint units and wall supports. Clothes hang from connected supports on opening-free residential spans. |
| Damaged windows | Damage is an explicit sparse request variant on a named pane. Fractured panes remain solid; missing panes publish open collision while the remaining unit stays intact. |
| Balconies | `balconyBands` own one shared slab and rail run. Doors reference the band rather than adding overlapping slabs. |
| Exterior lights | Every fixture publishes its facade edge, rear mount, outward normal, size, and standoff. The emissive lens exists on the outward face only. |
| Letter signs | Atlas glyphs are inset inside individual metal cases with deterministic cells, spacing, and depth. |
| Open businesses | Eligible low-rise commercial fronts can publish a wide leafless `openFront` portal with a real wall cut, reveal, surround, threshold, and clear volume. |
| Highway and duct cuts | Required connection apertures pin floor bases, cut exact clear rectangles through the wall, and fail closed when the requested building cannot contain them. |
| Massing and secondary detail | Seeded type and wealth rules control setbacks, wings, towers, structural piers, facade relief, AC clusters, roofs, fire escapes, and other supported features. |

## Cross-layer handoff

| Requirement | Owning layer and boundary |
| --- | --- |
| Interior partitions and service cores | Interior consumes `floors`, `slabBands`, `facade.grids`, door roles, and portal clear volumes. Exterior publishes safe solid anchors but does not place interior walls. |
| Highway supports and under-building structure | Atlas and connections reserve the shared corridor and provide required apertures. Exterior preserves those cuts but does not place supports in street-owned space. |
| Sidewalk approaches and public gardens | Streets owns pedestrian clearances, curb zones, and shared ground. Exterior keeps entrances and portals explicit so those routes can terminate at them. |
| Material appearance | Materials owns every canonical material key and its maps. Exterior requests concrete `panel`, column `plain`, and wall-trim `paint`, publishes the neutral palette contract, and owns world-scale UVs and geometry orientation. |

Any new cross-layer dimension must enter through a schema-validated input or output. Do not infer it from another layer's private code.
