// Request validation mirroring schemas/building-request.schema.json.
// Shape violations throw E_SCHEMA naming the path; semantic checks throw their own codes.

import { ExteriorError } from './errors.ts';
import { FAMILY, type AtlasType, type Tier } from '../rules/families.ts';
import { RULES, SIGNAGE } from '../rules/tables.ts';
import { area, selfIntersects, edgeDir, edgeNormal } from './polygon.ts';
import type { Aperture, BuildingRequest, P2 } from '../types.ts';

const TYPES: AtlasType[] = ['residential', 'hotel', 'offices', 'corpo', 'hospital', 'clinic', 'police', 'military', 'factory', 'commerce', 'mall', 'restaurant', 'coffee_shop'];
const TIERS: Tier[] = ['poor', 'mid', 'rich', 'high_rich'];
const APERTURE_KINDS = ['bridge', 'ac-tube', 'wire-anchor', 'tunnel'];

function fail(path: string, why: string): never {
  throw new ExteriorError('E_SCHEMA', `${path}: ${why}`);
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'expected finite number');
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(path, 'expected non-empty string');
  return v;
}

function p2(v: unknown, path: string): P2 {
  if (!Array.isArray(v) || v.length !== 2) fail(path, 'expected [x, z]');
  return [num(v[0], `${path}[0]`), num(v[1], `${path}[1]`)];
}

function ring(v: unknown, path: string): P2[] {
  if (!Array.isArray(v) || v.length < 3) fail(path, 'expected polygon with at least 3 points');
  return v.map((p, i) => p2(p, `${path}[${i}]`));
}

export function validateRequest(raw: unknown): BuildingRequest {
  if (typeof raw !== 'object' || raw === null) fail('request', 'expected object');
  const r = raw as Record<string, unknown>;

  const seed = str(r.seed, 'seed');
  const buildingId = str(r.buildingId, 'buildingId');

  const parcelRaw = (r.parcel ?? fail('parcel', 'required')) as Record<string, unknown>;
  const footprint = ring(parcelRaw.footprint, 'parcel.footprint');
  const accessPoint = p2(parcelRaw.accessPoint, 'parcel.accessPoint');
  const maxHeight = num(parcelRaw.maxHeight, 'parcel.maxHeight');
  if (maxHeight <= 0) fail('parcel.maxHeight', 'must be positive');

  const bRaw = (r.building ?? fail('building', 'required')) as Record<string, unknown>;
  const type = str(bRaw.type, 'building.type') as AtlasType;
  if (!TYPES.includes(type)) fail('building.type', `unknown type ${type}`);
  const tier = str(bRaw.tier, 'building.tier') as Tier;
  if (!TIERS.includes(tier)) fail('building.tier', `unknown tier ${tier}`);
  const floors = num(bRaw.floors, 'building.floors');
  if (!Number.isInteger(floors) || floors < 1) fail('building.floors', 'expected integer >= 1');
  const basements = bRaw.basements === undefined ? 0 : num(bRaw.basements, 'building.basements');
  if (!Number.isInteger(basements) || basements < 0) fail('building.basements', 'expected integer >= 0');
  const floorKinds = bRaw.floorKinds === undefined ? undefined
    : (Array.isArray(bRaw.floorKinds) ? bRaw.floorKinds.map((k, i) => str(k, `building.floorKinds[${i}]`)) : fail('building.floorKinds', 'expected array'));

  const theme = str(r.theme, 'theme');

  const apertures: Aperture[] = [];
  if (r.apertures !== undefined) {
    if (!Array.isArray(r.apertures)) fail('apertures', 'expected array');
    r.apertures.forEach((a, i) => apertures.push(validateAperture(a, `apertures[${i}]`)));
  }

  const options = validateOptions(r.options);

  // Semantic checks beyond shape.
  if (footprint.length < 3 || area(footprint) < 1e-6) {
    throw new ExteriorError('E_FOOTPRINT_INVALID', 'footprint has no area');
  }
  if (selfIntersects(footprint)) {
    throw new ExteriorError('E_FOOTPRINT_INVALID', 'footprint self-intersects');
  }
  const family = FAMILY[type];
  if (area(footprint) < RULES[family].minFootprintArea) {
    throw new ExteriorError('E_FOOTPRINT_TOO_SMALL', `${type} needs at least ${RULES[family].minFootprintArea} m2, footprint has ${area(footprint).toFixed(1)}`);
  }
  if (floors * RULES[family].minFloorHeight > maxHeight) {
    throw new ExteriorError('E_ENVELOPE_TOO_LOW', `${floors} floors at min ${RULES[family].minFloorHeight} m exceed maxHeight ${maxHeight}`);
  }
  if (floorKinds && floorKinds.length !== floors) {
    throw new ExteriorError('E_FLOORKINDS_MISMATCH', `floorKinds has ${floorKinds.length} entries for ${floors} floors`);
  }
  validateAperturesSemantics(apertures, footprint, maxHeight, basements, RULES[family].maxFloorHeight);

  return {
    seed, buildingId,
    parcel: { footprint, accessPoint, maxHeight },
    building: { type, tier, floors, basements, floorKinds },
    theme, apertures, options,
  };
}

function validateAperture(raw: unknown, path: string): Aperture {
  if (typeof raw !== 'object' || raw === null) fail(path, 'expected object');
  const a = raw as Record<string, unknown>;
  const kind = str(a.kind, `${path}.kind`);
  if (!APERTURE_KINDS.includes(kind)) fail(`${path}.kind`, `unknown kind ${kind}`);
  const cutRaw = (a.cut ?? fail(`${path}.cut`, 'required')) as Record<string, unknown>;
  if (!Array.isArray(cutRaw.polygon) || cutRaw.polygon.length < 3) fail(`${path}.cut.polygon`, 'expected at least 3 points');
  const polygon = cutRaw.polygon.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 3) fail(`${path}.cut.polygon[${i}]`, 'expected [x, y, z]');
    return [num(p[0], `${path}.cut.polygon[${i}][0]`), num(p[1], `${path}.cut.polygon[${i}][1]`), num(p[2], `${path}.cut.polygon[${i}][2]`)] as [number, number, number];
  });
  const axisRaw = cutRaw.axisDir;
  if (!Array.isArray(axisRaw) || axisRaw.length !== 3) fail(`${path}.cut.axisDir`, 'expected [x, y, z]');
  const face = num(a.face, `${path}.face`);
  if (!Number.isInteger(face) || face < 0) fail(`${path}.face`, 'expected integer >= 0');
  const width = num(a.width, `${path}.width`);
  const height = num(a.height, `${path}.height`);
  if (width <= 0) fail(`${path}.width`, 'must be positive');
  if (height <= 0) fail(`${path}.height`, 'must be positive');
  const shape = str(a.shape, `${path}.shape`);
  if (shape !== 'rect' && shape !== 'circle') fail(`${path}.shape`, `unknown shape ${shape}`);
  return {
    id: str(a.id, `${path}.id`),
    buildingId: str(a.buildingId, `${path}.buildingId`),
    floor: Math.trunc(num(a.floor, `${path}.floor`)),
    face, kind: kind as Aperture['kind'],
    u: num(a.u, `${path}.u`),
    base: num(a.base, `${path}.base`),
    width, height, shape,
    cut: { polygon, axisDir: [num(axisRaw[0], `${path}.cut.axisDir[0]`), num(axisRaw[1], `${path}.cut.axisDir[1]`), num(axisRaw[2], `${path}.cut.axisDir[2]`)] },
    linkId: str(a.linkId, `${path}.linkId`),
  };
}

function validateOptions(raw: unknown): BuildingRequest['options'] {
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null) fail('options', 'expected object');
  const o = raw as Record<string, unknown>;
  const oneOf = (v: unknown, allowed: string[], path: string) => {
    if (v === undefined) return undefined;
    const s = str(v, path);
    if (!allowed.includes(s)) fail(path, `expected one of ${allowed.join(', ')}`);
    return s;
  };
  const out: NonNullable<BuildingRequest['options']> = {};
  out.shape = oneOf(o.shape, ['auto', 'box', 'octagon', 'cylinder', 'pyramid', 'setback'], 'options.shape') as never;
  out.glb = oneOf(o.glb, ['named', 'merged'], 'options.glb') as never;
  out.balconies = oneOf(o.balconies, ['auto', 'on', 'off'], 'options.balconies') as never;
  out.windows = oneOf(o.windows, ['auto', 'none'], 'options.windows') as never;
  out.adScreens = oneOf(o.adScreens, ['auto', 'on', 'off'], 'options.adScreens') as never;
  out.roofArtifacts = oneOf(o.roofArtifacts, ['auto', 'off'], 'options.roofArtifacts') as never;
  if (o.fireEscape !== undefined) {
    if (typeof o.fireEscape !== 'boolean') fail('options.fireEscape', 'expected boolean');
    out.fireEscape = o.fireEscape;
  }
  if (o.signage !== undefined && o.signage !== null) {
    const s = o.signage as Record<string, unknown>;
    const mode = str(s.mode, 'options.signage.mode');
    if (mode === 'marquee') {
      const text = str(s.text, 'options.signage.text');
      if (text.length > SIGNAGE.maxChars) fail('options.signage.text', `max ${SIGNAGE.maxChars} characters`);
      out.signage = { mode, text };
    } else if (mode === 'logo') {
      const ratio = str(s.ratio, 'options.signage.ratio');
      if (!['1:1', '3:2', '16:9'].includes(ratio)) fail('options.signage.ratio', 'expected 1:1, 3:2 or 16:9');
      out.signage = { mode, ratio: ratio as '1:1' | '3:2' | '16:9' };
    } else fail('options.signage.mode', 'expected marquee or logo');
  } else if (o.signage === null) {
    out.signage = null;
  }
  if (o.curtains !== undefined) {
    const c = o.curtains as Record<string, unknown>;
    const profile = oneOf(c.profile, ['day', 'night'], 'options.curtains.profile') as 'day' | 'night' | undefined;
    let sunAzimuthDeg: number | undefined;
    if (c.sunAzimuthDeg !== undefined) {
      sunAzimuthDeg = num(c.sunAzimuthDeg, 'options.curtains.sunAzimuthDeg');
      if (sunAzimuthDeg < 0 || sunAzimuthDeg >= 360) fail('options.curtains.sunAzimuthDeg', 'expected [0, 360)');
    }
    out.curtains = { profile, sunAzimuthDeg };
  }
  return out;
}

function validateAperturesSemantics(apertures: Aperture[], footprint: P2[], maxHeight: number, basements: number, maxFloorHeight: number): void {
  const lowest = -basements * 3.5 - 1;
  for (const a of apertures) {
    if (a.face >= footprint.length) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture ${a.id} face ${a.face} outside footprint (${footprint.length} segments)`, { id: a.id });
    }
    if (a.base + a.height > maxHeight || a.base < lowest) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture ${a.id} base ${a.base} outside vertical range`, { id: a.id });
    }
    if (a.kind !== 'wire-anchor' && a.height > maxFloorHeight + 1e-9) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture ${a.id} is ${a.height} m tall; no floor of this type can exceed ${maxFloorHeight} m, so no floor can contain it`, { id: a.id });
    }
    // Every cut vertex must lie on the face plane (within float tolerance).
    const [vx, vz] = footprint[a.face] as P2;
    const d = edgeDir(footprint, a.face);
    const n = edgeNormal(footprint, a.face);
    for (const [px, , pz] of a.cut.polygon) {
      const dist = (px - vx) * n[0] + (pz - vz) * n[1];
      if (Math.abs(dist) > 1e-6) {
        throw new ExteriorError('E_APERTURE_INVALID', `aperture ${a.id} cut vertex off its face plane by ${dist.toFixed(4)} m`, { id: a.id });
      }
    }
    // u/width/height consistent with the cut bounds.
    let minU = Infinity, maxU = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py, pz] of a.cut.polygon) {
      const u = (px - vx) * d[0] + (pz - vz) * d[1];
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    if (Math.abs(maxU - minU - a.width) > 0.01 || Math.abs(maxY - minY - a.height) > 0.01 || Math.abs(minY - a.base) > 0.01) {
      throw new ExteriorError('E_APERTURE_INVALID', `aperture ${a.id} cut bounds disagree with u/width/height/base`, { id: a.id });
    }
  }
  // Pairwise overlap on the same face.
  for (let i = 0; i < apertures.length; i++) {
    for (let j = i + 1; j < apertures.length; j++) {
      const a = apertures[i] as Aperture, b = apertures[j] as Aperture;
      if (a.face !== b.face) continue;
      const overlapU = Math.min(a.u + a.width / 2, b.u + b.width / 2) - Math.max(a.u - a.width / 2, b.u - b.width / 2);
      const overlapY = Math.min(a.base + a.height, b.base + b.height) - Math.max(a.base, b.base);
      if (overlapU > 0 && overlapY > 0) {
        throw new ExteriorError('E_APERTURE_OVERLAP', `apertures ${a.id} and ${b.id} overlap on face ${a.face}`, { ids: [a.id, b.id] });
      }
    }
  }
}
