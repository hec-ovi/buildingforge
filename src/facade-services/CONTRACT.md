# CONTRACT: facade-services

## Purpose

Builds deterministic facade-local pipes, ducts, cable bundles, service units, supported clotheslines, and sparse explicit window damage from dimensioned facade faces.

## Inputs

- `generateFacadeServices(input)` accepts [schema/input.schema.json](schema/input.schema.json).
- Face frames provide a world origin, unit facade tangent, unit outward normal, exact length and height, and panel boundaries in meters.
- Reservations provide every opening, access route, fixture, relief member, artifact, and previously accepted route as a face-local rectangle with outward depth.
- AC artifacts are explicit equipment endpoints. Windows name the pane grid available for an explicit damage state.
- Material values are canonical database keys supplied by the caller. The generator cannot synthesize a key.
- `modes.windowDamage` defaults outside this layer. This layer only accepts the resolved states `off` and `sparse`.

Preconditions: face-local U starts at the face origin and V starts at the floor elevation. Tangent and normal vectors are horizontal, unit length, and perpendicular. Panel boundary arrays start at zero and close on the face dimensions. Density is between zero and one. Limits are non-negative integers.

## Outputs

- `FacadeServicesOutput` follows [schema/output.schema.json](schema/output.schema.json).
- Each network publishes its profile, endpoint and junction nodes, exact segments, bend radius, wall supports, material key, and total fitted length. A cable-bundle profile adds its exact 12 or 15 cable count, three-row spacing, cable diameter and visible slack.
- Each attached unit publishes its kind, face-local rectangle, exact size, standoff, world center, and material key. A cable bundle terminates in a fitted `wall-entry` unit.
- Each clothesline publishes two wall-to-tip supports, a sagged line, attached item corners, its reserved face rectangle, and material keys.
- Each damaged window names one pane, an explicit `fractured-pane` or `missing-pane` variant, and matching collision state.
- `stats` reports the accepted geometry, material, and draw-call counts against the echoed limits.

Postconditions: every world point is derived from its face frame and local dimensions. Network segments form a connected graph between at least two equipment endpoints. Supports touch both the wall and their route. Clothesline ends equal the support tips and every cloth top edge lies on the line. Output uses only the three input material keys.

## Events

None. The entry point is pure and synchronous.

## Errors

- Invalid dimensions, face frames, panel closure, density, material-key syntax, or limits throw `Error` with a `facade-services input:` prefix.
- A generated result that violates endpoint connectivity, coordinate alignment, sparse damage, attachment, or budget rules throws `Error` with a `facade-services invariant:` prefix.
- Geometry that cannot fit is omitted. It is never forced through a reservation or outside the parcel.

## Invariants

- The same input produces byte-identical JSON.
- A route is accepted only when its face-local corridor stays inside its face and clear of openings, access zones, fixtures, artifacts, and accepted routes. Relief may be crossed only at a greater outward standoff.
- Pipe endpoints touch the published condenser and junction-unit surfaces. Duct endpoints touch two published junction units. One sparse cable bundle connects a junction unit to a wall-entry unit through at least three direction changes.
- Route supports occur no farther apart than the requested support-spacing rule permits on facade-parallel runs.
- A clothesline has two wall-connected supports, stays outside reserved access and opening rectangles, remains inside the parcel projection, and carries no unattached cloth.
- Window damage is disabled unless `sparse` is explicit. Sparse mode affects at most one opening per forty candidates, with a minimum of one when candidates exist, and never exceeds `maxDamagedWindows`.
- Counts never exceed the caller's limits. The implementation consolidates metal, fabric, and damaged glass into at most three material draw groups.
- Surface UVs are emitted by the exterior mesher in world meters. Exact-image materials are not used by this layer.

## Procedure

Edit only this folder for facade-service arithmetic. Keep the input and output schemas synchronized with exported types, add contract tests for every changed rule, then run the exterior public integration tests. Root integration may consume `index.ts` and the schemas only.

## Dependencies

None. The caller supplies face frames, reservations, parcel bounds, and material database keys.
