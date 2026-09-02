// Geometry sinks and winding-safe primitive helpers.
// Convention: glTF counter-clockwise front faces; every helper takes vertices
// already ordered CCW as seen from the side the face must show, or verifies
// against an explicit outward direction.

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: V3): V3 => {
  const l = Math.sqrt(dot(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface Prim {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface Part {
  name: string;
  prims: Map<string, Prim>;
  /** node this part hangs under; the root when absent */
  parent?: string;
  /**
   * Origin of a part the game addresses by node: a door leaf hinge, a wire
   * anchor's attach point. Its geometry is written relative to this point and
   * the node carries it as a translation, so turning a leaf node about its own Y
   * swings the whole subtree. A part with a pivot is never merged away: the game
   * needs the node.
   */
  pivot?: V3;
  /**
   * Kept as its own node in merged output too, the way a pivoted part is: a
   * floor slab the interior replaces under the same name.
   */
  keepNode?: boolean;
}

/**
 * Face normal from the winding the caller already fixed. Every vertex belongs to
 * exactly one face, so these are flat shading normals with no averaging; a
 * degenerate sliver falls back to +Y rather than emitting NaN.
 */
function faceNormal(a: V3, b: V3, c: V3): V3 {
  const n = cross(sub(b, a), sub(c, a));
  const len = Math.sqrt(dot(n, n));
  return len > 0 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 1, 0];
}

function pushNormal(g: Prim, n: V3, vertices: number): void {
  for (let i = 0; i < vertices; i++) g.normals.push(n[0], n[1], n[2]);
}

export class MeshBuilder {
  readonly parts: Part[] = [];

  part(name: string, options: { parent?: string; pivot?: V3; keepNode?: boolean } = {}): PartSink {
    const p: Part = { name, prims: new Map(), ...options };
    this.parts.push(p);
    return new PartSink(p);
  }

  materialKeys(): string[] {
    const keys = new Set<string>();
    for (const p of this.parts) for (const k of p.prims.keys()) keys.add(k);
    return [...keys].sort();
  }
}

export class PartSink {
  private readonly p: Part;

  constructor(p: Part) { this.p = p; }

  private prim(material: string): Prim {
    let g = this.p.prims.get(material);
    if (!g) { g = { positions: [], normals: [], uvs: [], indices: [] }; this.p.prims.set(material, g); }
    return g;
  }

  /** World point in the part's own frame: identity unless the part turns on a pivot. */
  private local(p: V3): V3 {
    const o = this.p.pivot;
    return o ? [p[0] - o[0], p[1] - o[1], p[2] - o[2]] : p;
  }

  /** Raw triangle, vertices CCW from the visible side. uv per vertex. */
  tri(material: string, a: V3, b: V3, c: V3, uv: [number, number][]): void {
    const g = this.prim(material);
    const base = g.positions.length / 3;
    g.positions.push(...this.local(a), ...this.local(b), ...this.local(c));
    pushNormal(g, faceNormal(a, b, c), 3);
    g.uvs.push(...(uv[0] as [number, number]), ...(uv[1] as [number, number]), ...(uv[2] as [number, number]));
    g.indices.push(base, base + 1, base + 2);
  }

  /** Quad bl, br, tr, tl ordered CCW from the visible side. */
  quad(material: string, bl: V3, br: V3, tr: V3, tl: V3, uv: [number, number][]): void {
    const g = this.prim(material);
    const base = g.positions.length / 3;
    g.positions.push(...this.local(bl), ...this.local(br), ...this.local(tr), ...this.local(tl));
    pushNormal(g, faceNormal(bl, br, tr), 4);
    for (const t of uv) g.uvs.push(...t);
    g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Quad whose front must face `outward`: vertices are flipped when the
   * computed normal disagrees. UVs follow the given order either way.
   */
  quadFacing(material: string, bl: V3, br: V3, tr: V3, tl: V3, outward: V3, uv: [number, number][]): void {
    const n = cross(sub(br, bl), sub(tl, bl));
    if (dot(n, outward) >= 0) this.quad(material, bl, br, tr, tl, uv);
    else this.quad(material, br, bl, tl, tr, [uv[1]!, uv[0]!, uv[3]!, uv[2]!]);
  }

  /**
   * Box from center, three orthogonal half-axis vectors (each = direction * halfExtent).
   * All six faces wound outward. `face` gives tiled world-scale UVs; `along`
   * turns each face's map a quarter where the face is taller than it is wide, so
   * a rolled section (a frame member, a bracket) carries its map down its
   * length; `exact` puts one whole picture on every face, for a material placed
   * rather than tiled.
   */
  box(material: string, center: V3, hx: V3, hy: V3, hz: V3, uvMode: 'face' | 'along' | 'exact' = 'face'): void {
    const faces: [V3, V3, V3][] = [
      [hx, hy, hz], [scale(hx, -1), hy, scale(hz, -1)],
      [hz, hy, scale(hx, -1)], [scale(hz, -1), hy, hx],
      [hy, scale(hz, -1), hx], [scale(hy, -1), hz, hx],
    ];
    for (const [n, up, right] of faces) {
      const c = add(center, n);
      const bl = add(add(c, scale(right, -1)), scale(up, -1));
      const br = add(add(c, right), scale(up, -1));
      const tr = add(add(c, right), up);
      const tl = add(add(c, scale(right, -1)), up);
      const w = uvMode === 'exact' ? 1 : 2 * Math.sqrt(dot(right, right));
      const h = uvMode === 'exact' ? 1 : 2 * Math.sqrt(dot(up, up));
      const uv: [number, number][] = uvMode === 'along' && h > w
        ? [[0, 0], [0, w], [h, w], [h, 0]]
        : [[0, h], [w, h], [w, 0], [0, 0]];
      this.quadFacing(material, bl, br, tr, tl, n, uv);
    }
  }

  /** World-axis-aligned box: center + size [w, d, h] (h along +Y, base at center minus h/2 handled by caller). */
  aabox(material: string, center: V3, w: number, d: number, h: number): void {
    this.box(material, center, [w / 2, 0, 0], [0, h / 2, 0], [0, 0, d / 2]);
  }

  /**
   * Box along an arbitrary axis (stairs, slanted runs): from start to end,
   * `widthDir` horizontal, given width and thickness.
   */
  slantedBox(material: string, start: V3, end: V3, widthDir: V3, width: number, thickness: number): void {
    const axis = sub(end, start);
    const side = scale(norm(widthDir), width / 2);
    const thick = scale(norm(cross(axis, side)), thickness / 2);
    const c = add(start, scale(axis, 0.5));
    this.box(material, c, scale(axis, 0.5), thick, side, 'along');
  }
}
