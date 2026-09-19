import { glbIO } from './support.ts';
import { buildResolver, type ThemeIndex } from '../src/materials/theme.ts';

interface Measurement {
  alignment: 'tile' | 'exact';
  primitives: number;
  triangles: number;
  min: number;
  max: number;
}

/** Measure both principal metre scales, including shear, on every exported triangle. */
export async function auditMaterialUvs(glb: Uint8Array, catalog: ThemeIndex) {
  const document = await glbIO().readBinary(glb);
  const resolve = buildResolver(catalog);
  const materials: Record<string, Measurement> = {};
  const failures = new Map<string, string>();
  let primitives = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    primitives++;
    const material = primitive.getMaterial()!;
    const key = material.getName(), variant = material.getExtras().materialVariant;
    const slot = `${key}#${variant}`;
    const fail = (reason: string) => { if (!failures.has(slot)) failures.set(slot, `${mesh.getName()}: ${reason}`); };
    const entry = resolve(key);
    if (!entry) { fail('missing catalog key'); continue; }
    if (typeof variant !== 'string' || !entry.variants.some(candidate => candidate.id === variant)) fail('missing named variant');
    const result = materials[slot] ??= { alignment: entry.alignment, primitives: 0, triangles: 0, min: Infinity, max: -Infinity };
    result.primitives++;
    const position = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!, indices = primitive.getIndices()!;
    if (!position || !uv || !indices) { fail('missing geometry accessor'); continue; }
    if (![...position.getArray()!, ...uv.getArray()!].every(Number.isFinite)) fail('nonfinite vertex data');
    if (entry.alignment === 'exact') {
      for (const value of uv.getArray()!) { result.min = Math.min(result.min, value); result.max = Math.max(result.max, value); }
      if (result.min < 0 || result.max > 1) fail(`exact UV range ${result.min}..${result.max}`);
      result.triangles += indices.getCount() / 3;
      continue;
    }
    for (let i = 0; i < indices.getCount(); i += 3) {
      const [a, b, c] = [0, 1, 2].map(offset => indices.getScalar(i + offset));
      const origin = position.getElement(a!, []), start = uv.getElement(a!, []);
      const p = position.getElement(b!, []).map((value, axis) => value - origin[axis]!);
      const q = position.getElement(c!, []).map((value, axis) => value - origin[axis]!);
      const s = uv.getElement(b!, []).map((value, axis) => value - start[axis]!);
      const t = uv.getElement(c!, []).map((value, axis) => value - start[axis]!);
      const area = Math.hypot(p[1]! * q[2]! - p[2]! * q[1]!, p[2]! * q[0]! - p[0]! * q[2]!, p[0]! * q[1]! - p[1]! * q[0]!);
      if (area < 1e-12) continue;
      result.triangles++;
      const determinant = s[0]! * t[1]! - s[1]! * t[0]!;
      if (Math.abs(determinant) < 1e-12) { fail(`degenerate tiled UVs at triangle ${i / 3}`); continue; }
      const u = p.map((value, axis) => (value * t[1]! - q[axis]! * s[1]!) / determinant);
      const v = q.map((value, axis) => (value * s[0]! - p[axis]! * t[0]!) / determinant);
      const uu = u.reduce((sum, value) => sum + value * value, 0);
      const vv = v.reduce((sum, value) => sum + value * value, 0);
      const uvDot = u.reduce((sum, value, axis) => sum + value * v[axis]!, 0);
      const discriminant = Math.hypot(uu - vv, 2 * uvDot);
      const low = Math.sqrt(Math.max(0, (uu + vv - discriminant) / 2)), high = Math.sqrt((uu + vv + discriminant) / 2);
      result.min = Math.min(result.min, low); result.max = Math.max(result.max, high);
      if (low < 0.98 || high > 1.02) fail(`metres per UV unit ${low}..${high} at triangle ${i / 3}`);
    }
  }
  return { primitives, materials, failures: Object.fromEntries(failures) };
}
