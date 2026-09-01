# CONTRACT: exterior

Purpose: deterministically generates one building exterior as a GLB shell (empty inside, one plane per floor) plus a JSON blueprint of every exterior opening per floor.

Status: draft, schemas pending research.

## In (must cover)
- seed
- parcel footprint polygon and height envelope
- building type, quality tier, floor count
- theme material set id
- required apertures (kind, floor, face, position, dimensions)
- options: balconies, fire escape stairs, signage (text or logo), ad screens, roof artifacts, curtain distribution

## Out (must cover)
- GLB shell: empty inside, floor separator planes, low poly, outward normals
- blueprint JSON: per floor, every opening (door, window, balcony door, aperture) with exact position and size, floor heights, floor kind slots

## Errors
Closed set, to be defined.

## Depends on
- ../atlas/CONTRACT.md
- ../connections/CONTRACT.md
- ../materials/CONTRACT.md
