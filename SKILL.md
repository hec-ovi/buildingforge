---
name: exterior
description: Generate one seeded building exterior GLB and its floor/opening blueprint through the Exterior library or CLI.
---

# Exterior 0.48.0

Builds one deterministic building shell, empty inside except replaceable floor slabs, with its exact opening blueprint.

Call `generate(request, options?)` from `src/index.ts` in Node with TypeScript stripping, or use the CLI below. The installed dependencies and Interior's published `dist/feasibility.js` build must be available; see [CONTRACT.md](CONTRACT.md).

[Request fields](schemas/building-request.schema.json), in metres:

| Fields | Defaults |
| --- | --- |
| `seed`, `buildingId`, `theme` | Required nonempty strings. CLI rolls and prints an omitted seed. |
| `parcel.footprint`, `accessPoint`, `maxHeight` | Required CCW `[x,z]` ring, street approach point and height limit. |
| `parcel.streetAccess`, `buildingGrid` | Optional named street/path; grid defaults to 0.5 m aligned to the parcel bounding rectangle. |
| `building.type`, `tier`, `floors` | Required; use schema enums verbatim. |
| `building.basements`, `floorKinds` | Zero basements; program labels synthesized when absent. |
| `apertures` | Empty; supplied faces, cuts and absolute base heights are fixed reservations. |
| `options.architecture` | Optional: `rounded-corner`, `chamfered-corners`, `terrace-blocks`. Complete section fits require unbound faces, a 0.5 m grid and a single swing entrance. |
| `options.shape`, `exteriorStyle`, `glb` | `auto` (rectangular plates), seeded compatible style, `named`. |
| `balconies`, `balconyStyle`, `openFront`, `fireEscape` | `auto`; detail is fitted where eligible. These and the following rows are inside `request.options`. |
| `entranceLayout`, `doorMotion`, `windows` | `single`, `swing`, `auto`. Pocket doors need opaque chambers; `openFront:on` conflicts. |
| `signage`, `adScreens`, `roofArtifacts` | `null`, `auto`, `auto`. |
| `facadeServices`, `hangingClothes`, `windowDamage` | `auto`, `auto`, `off`. |
| `coreAdjacency` | Interior's published glazing circulation default (1.2 m). |
| `curtains.profile`, `sunAzimuthDeg`, `overrides` | `day`, 180, empty. Override `openPercent:30` yields `closurePercent:70`. |
| Second argument `textures` | `mode:external`; `dir` defaults to `URBE_MATERIALS_DIR`, then sibling `materials`; `baseUrl` defaults to empty. A supplied `source` replaces disk access; `null` requests fallback. |
| `textures.nativeFinishes`, `nativeBaseUrl` | Built-in sources enable bundled finishes; custom sources opt in. Browser base defaults to `native-materials/`. |

The promise returns `{glb: Uint8Array, blueprint, textures: {mode, reason?}}`. The [blueprint](schemas/blueprint.schema.json) includes `version`, optional section `assembly`, floor `roomEnvelope` rectangles, all openings, facade reservations/material keys, balconies, services and roof data. Every opening remains a hard reservation; the irregular space outside each room rectangle stays open. Exterior does not build rooms or internal stairs.

Texture modes are `external`, `embed` and `keys`. External mode can return `keys` with a reason if its catalog is unavailable. Embedded mode requires maps. Check the returned mode before presenting a textured result.

Errors are `ExteriorError {code, message, details?}`. The closed set is `E_SCHEMA`, `E_FOOTPRINT_INVALID`, `E_FOOTPRINT_TOO_SMALL`, `E_ENVELOPE_TOO_LOW`, `E_FLOORKINDS_MISMATCH`, `E_APERTURE_UNREACHABLE`, `E_APERTURE_INVALID`, `E_APERTURE_OVERLAP`, `E_SIGNAGE_TEXT_TOO_LONG`, `E_CORE_PLATE`, `E_DOOR_FIT`, `E_MATERIAL_UNRESOLVED`, `E_INVARIANT`; meanings are in the contract. Preserve the failing request for reproduction.

Copy from this repo root:

```sh
npm run generate -- fixtures/residential-mid.request.json out --seed example --keys-only
```

This writes `out/p101.glb` and `out/p101.blueprint.json`, with seed `example` and keys for caller-side material resolution. Omit `--keys-only` for external textures or use `--embed` for a self-contained GLB. Optional CLI flags: `--materials DIR`, `--materials-base URI`.
