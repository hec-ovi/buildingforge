import type { Blueprint } from '../types.ts';
import type { RoofTerracePlan } from '../layout/roofTerrace.ts';
import type { PartSink, V3 } from './primitives.ts';
import { tubeSegment } from './tube.ts';

export const TERRACE = {
  metal: 'cyberpunk/metal/rich#zinc', wire: 'cyberpunk/metal/rich#paint', frame: 'cyberpunk/meridian-ceiling-metal/rich#field', bronze: 'cyberpunk/interior-bronze/rich#plain',
  stone: 'cyberpunk/exterior-cast-concrete/mid#native', topStone: 'cyberpunk/corpo-plaza-stone/rich#polished', wood: 'cyberpunk/corpo-plaza-veneer/rich#walnut',
  darkWood: 'cyberpunk/corpo-plaza-veneer/rich#smoked', fabric: 'cyberpunk/fabric/mid#linen',
  darkFabric: 'cyberpunk/meridian-upholstery/rich#navy', soil: 'cyberpunk/garden-soil/mid#surface',
  glass: 'cyberpunk/paired-window-glass/mid#clear', lens: 'cyberpunk/paired-light-warm/mid#surface',
} as const;

/** Geometry remains in the roof's own frame; UV distances remain metres. */
export class TerraceKit {
  readonly sink: PartSink;
  readonly plan: RoofTerracePlan;
  readonly top: number;
  readonly lights: Blueprint['lights'];
  constructor(sink: PartSink, plan: RoofTerracePlan, top: number, lights: Blueprint['lights']) {
    this.sink = sink; this.plan = plan; this.top = top; this.lights = lights;
  }

  point(u: number, y: number, v: number): V3 {
    const { origin, axis } = this.plan;
    return [origin[0] + axis[0] * u - axis[1] * v, this.top + y, origin[1] + axis[1] * u + axis[0] * v];
  }
  box(key: string, u: number, y: number, v: number, w: number, h: number, d: number): void {
    const a = this.plan.axis;
    this.sink.box(key, this.point(u, y + h / 2, v), [a[0] * w / 2, 0, a[1] * w / 2],
      [0, h / 2, 0], [-a[1] * d / 2, 0, a[0] * d / 2], 'along');
  }
  rod(key: string, a: V3, b: V3, radius: number): void {
    tubeSegment(this.sink, key, this.point(...a), this.point(...b), radius);
  }
  beam(key: string, a: V3, b: V3, width: number, thickness: number): void {
    const x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], length = Math.hypot(x, y, z);
    const side: V3 = Math.abs(z) + Math.abs(x) > 1e-6 ? [z / Math.hypot(x, z), 0, -x / Math.hypot(x, z)] : [1, 0, 0];
    const forward: V3 = [x / length, y / length, z / length];
    const up: V3 = [forward[1] * side[2], forward[2] * side[0] - forward[0] * side[2], -forward[1] * side[0]];
    const world = (v: V3): V3 => [this.plan.axis[0] * v[0] - this.plan.axis[1] * v[2], v[1], this.plan.axis[1] * v[0] + this.plan.axis[0] * v[2]];
    this.sink.box(key, this.point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
      world(side.map(n => n * width / 2) as V3), world(up.map(n => n * thickness / 2) as V3), world([x / 2, y / 2, z / 2]), 'along');
  }
  /** Closed chamfered solid, not a box wearing a rounded-corner texture. */
  bevel(key: string, u: number, y: number, v: number, w: number, h: number, d: number, radius = .025): void {
    const half = [w / 2, h / 2, d / 2], r = Math.min(radius, ...half.map(n => n * .7));
    const sink = this.sink.mapped(p => this.point(u + p[0], y + h / 2 + p[1], v + p[2]));
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const a = (axis + 1) % 3, b = (axis + 2) % 3;
      const point = (sa: number, sb: number): V3 => {
        const p: V3 = [0, 0, 0]; p[axis] = sign * half[axis]!; p[a] = sa * (half[a]! - r); p[b] = sb * (half[b]! - r); return p;
      };
      const normal: V3 = [0, 0, 0]; normal[axis] = sign;
      sink.quadFacing(key, point(-1, -1), point(1, -1), point(1, 1), point(-1, 1), normal,
        [[0, 0], [2 * (half[a]! - r), 0], [2 * (half[a]! - r), 2 * (half[b]! - r)], [0, 2 * (half[b]! - r)]]);
    }
    for (let free = 0; free < 3; free++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const a = (free + 1) % 3, b = (free + 2) % 3;
      const point = (end: number, which: number): V3 => {
        const p: V3 = [0, 0, 0]; p[free] = end * (half[free]! - r);
        p[a] = sa * (half[a]! - (which ? r : 0)); p[b] = sb * (half[b]! - (which ? 0 : r)); return p;
      };
      const n: V3 = [0, 0, 0]; n[a] = sa; n[b] = sb;
      sink.quadFacing(key, point(-1, 0), point(1, 0), point(1, 1), point(-1, 1), n,
        [[0, 0], [2 * half[free]!, 0], [2 * half[free]!, r * Math.SQRT2], [0, r * Math.SQRT2]]);
    }
    for (const x of [-1, 1]) for (const ySign of [-1, 1]) for (const z of [-1, 1]) {
      const a: V3 = [x * half[0]!, ySign * (half[1]! - r), z * (half[2]! - r)];
      const b: V3 = [x * (half[0]! - r), ySign * half[1]!, z * (half[2]! - r)];
      const c: V3 = [x * (half[0]! - r), ySign * (half[1]! - r), z * half[2]!];
      sink.triFacing(key, a, b, c, [x, ySign, z], [[0, 0], [r, 0], [r / 2, r]]);
    }
  }
  /** Smooth padded bolster: silhouette and normals come from the actual surface. */
  pillow(key: string, u: number, y: number, v: number, w: number, h: number, d: number): void {
    const positions: V3[]=[], normals: V3[]=[], uv: [number,number][]=[], indices: number[]=[];
    const rings=6, segments=12, a=this.plan.axis;
    for(let ring=0;ring<=rings;ring++)for(let segment=0;segment<=segments;segment++){
      const phi=ring/rings*Math.PI, theta=segment/segments*Math.PI*2;
      const x=Math.sin(phi)*Math.cos(theta), z=Math.sin(phi)*Math.sin(theta), yy=Math.cos(phi);
      positions.push(this.point(u+x*w/2,y+h/2+yy*h/2,v+z*d/2));
      const len=Math.hypot(x/w,yy/h,z/d);normals.push([(a[0]*x/w-a[1]*z/d)/len,yy/h/len,(a[1]*x/w+a[0]*z/d)/len]);
      uv.push([segment/segments*w,ring/rings*h]);
      if(ring<rings&&segment<segments){const p=ring*(segments+1)+segment,q=p+segments+1;
        if(ring>0)indices.push(p,p+1,q);if(ring<rings-1)indices.push(p+1,q+1,q);
      }
    }
    this.sink.indexed(key,positions,normals,uv,indices);
  }
  cylinder(key: string, u: number, y: number, v: number, radius: number, height: number, segments = 20): void {
    this.lathe(key, u, y, v, [[0, radius], [height, radius]], segments);
  }
  lathe(key: string, u: number, y: number, v: number, profile: [number, number][], segments = 16): void {
    const positions: V3[] = [], normals: V3[] = [], uv: [number, number][] = [], indices: number[] = [];
    const a = this.plan.axis;
    for (let ring = 0; ring < profile.length; ring++) {
      const [height, radius] = profile[ring]!, before = profile[Math.max(0, ring - 1)]!, after = profile[Math.min(profile.length - 1, ring + 1)]!;
      const dy = after[0] - before[0], dr = after[1] - before[1], len = Math.hypot(dy, dr) || 1;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments * Math.PI * 2, x = Math.cos(t), z = Math.sin(t);
        positions.push(this.point(u + x * radius, y + height, v + z * radius));
        normals.push([(a[0] * x - a[1] * z) * dy / len, -dr / len, (a[1] * x + a[0] * z) * dy / len]);
        uv.push([i / segments * 2 * Math.PI * radius, height]);
        if (ring && i < segments) { const b = (ring - 1) * (segments + 1) + i, c = ring * (segments + 1) + i; indices.push(b, c, c + 1, b, c + 1, b + 1); }
      }
    }
    this.sink.indexed(key, positions, normals, uv, indices);
    for (const [end, up] of [[0, -1], [profile.length - 1, 1]] as const) {
      const [height, radius] = profile[end]!;
      for (let i = 0; i < segments; i++) {
        const t = i / segments * Math.PI * 2, q = (i + 1) / segments * Math.PI * 2;
        this.sink.triFacing(key, this.point(u, y + height, v), this.point(u + Math.cos(t) * radius, y + height, v + Math.sin(t) * radius),
          this.point(u + Math.cos(q) * radius, y + height, v + Math.sin(q) * radius), [0, up, 0], [[radius, radius], [radius * (1 + Math.cos(t)), radius * (1 + Math.sin(t))], [radius * (1 + Math.cos(q)), radius * (1 + Math.sin(q))]]);
      }
    }
  }
  /** A supported cantilever lamp. Existing fixture meshing supplies its hood/lens.
   * The lens and existing consumer's point source both stand .4m off the mount. */
  lamp(u: number, y: number, v: number, nx: number, nz: number, lumens = 1400, range = 9): void {
    this.box(TERRACE.metal, u, y - .13, v, .10, .26, .10);
    this.rod(TERRACE.bronze, [u, y, v], [u + nx * .34, y, v + nz * .34], .022);
    const position = this.point(u, y, v), axis = this.plan.axis;
    const normal: [number, number] = [axis[0] * nx - axis[1] * nz, axis[1] * nx + axis[0] * nz];
    if (!this.lights.some(l => l.material === TERRACE.lens && l.position.every((n, i) => Math.abs(n - position[i]!) < 1e-6))) {
      this.lights.push({ kind: 'accent', edge: 0, position, normal, size: [.28, .18, .10], standoff: .328,
        material: TERRACE.lens, color: '#ffc489', lumens, range });
    }
  }
}
