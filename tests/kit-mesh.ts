import { glbIO } from './support.ts';
import type { P3 } from '../src/kit/types.ts';

export interface Face { vertices: number[]; source: string }
export interface Edge { a: number; b: number; source: string }
export interface Mesh { points: P3[]; faces: Face[] }

/** Position weld from the seam measuring script, independent of normals and UVs. */
export class Weld {
  readonly points: P3[] = [];
  private readonly grid = new Map<string, number[]>();
  add(p: P3): number {
    const cell = p.map(v => Math.floor(v / 0.001));
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      for (const i of this.grid.get(`${cell[0]! + x},${cell[1]! + y},${cell[2]! + z}`) ?? []) {
        if (p.every((v, axis) => Math.abs(v - this.points[i]![axis]!) <= 0.0001)) return i;
      }
    }
    const id = this.points.length, key = cell.join(',');
    this.points.push(p);
    const bucket = this.grid.get(key) ?? [];
    bucket.push(id); this.grid.set(key, bucket);
    return id;
  }
}

export async function decodePiece(bytes: Uint8Array): Promise<Mesh> {
  const doc = await glbIO().readBinary(bytes), weld = new Weld(), faces: Face[] = [];
  doc.getRoot().listScenes()[0]!.traverse(node => {
    const matrix = node.getWorldMatrix();
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const positions = prim.getAttribute('POSITION')!, indices = prim.getIndices()!;
      const ids = Array.from({ length: positions.getCount() }, (_, i) => {
        const p = positions.getElement(i, []);
        return weld.add([0, 1, 2].map(axis => matrix[axis]! * p[0]! + matrix[axis + 4]! * p[1]!
          + matrix[axis + 8]! * p[2]! + matrix[axis + 12]!) as P3);
      });
      for (let i = 0; i < indices.getCount(); i += 3) faces.push({
        vertices: [0, 1, 2].map(k => ids[indices.getScalar(i + k)]!), source: `${node.getName()}/${prim.getMaterial()!.getName()}`,
      });
    }
  });
  return { points: weld.points, faces };
}

/** Oppositely directed triangle edges cancel after positional welding. */
export function openEdges(faces: Face[]): Edge[] {
  const edges = new Map<string, Edge[]>();
  for (const face of faces) for (let i = 0; i < 3; i++) {
    const a = face.vertices[i]!, b = face.vertices[(i + 1) % 3]!;
    const reverse = `${b}>${a}`, other = edges.get(reverse);
    if (other?.length) { other.pop(); if (!other.length) edges.delete(reverse); continue; }
    const key = `${a}>${b}`, list = edges.get(key) ?? [];
    list.push({ a, b, source: face.source }); edges.set(key, list);
  }
  return [...edges.values()].flat();
}

export interface Boundary { length: number; midpoint: P3; source: string }

/** Signed line intervals cancel T junctions even when adjacent faces split an edge differently. */
export function boundaries(edges: Edge[], points: P3[]): Boundary[] {
  type Event = { t: number; sign: number; source: string };
  const groups = new Map<string, { direction: P3; foot: P3; events: Event[] }>();
  for (const edge of edges) {
    const a = points[edge.a]!, b = points[edge.b]!;
    let direction = b.map((v, i) => v - a[i]!) as P3;
    const length = Math.hypot(...direction);
    if (length < 1e-9) continue;
    direction = direction.map(v => v / length) as P3;
    const dominant = direction.map(Math.abs).indexOf(Math.max(...direction.map(Math.abs)));
    const sign = direction[dominant]! < 0 ? -1 : 1;
    direction = direction.map(v => v * sign) as P3;
    const dot = (p: P3) => p.reduce((sum, v, i) => sum + v * direction[i]!, 0);
    const t0 = dot(a), t1 = dot(b), foot = a.map((v, i) => v - t0 * direction[i]!) as P3;
    const key = `${direction.map(v => v.toFixed(5))}|${foot.map(v => Math.round(v / 0.001))}`;
    const group = groups.get(key) ?? { direction, foot, events: [] };
    group.events.push({ t: Math.min(t0, t1), sign, source: edge.source },
      { t: Math.max(t0, t1), sign: -sign, source: edge.source });
    groups.set(key, group);
  }
  const result: Boundary[] = [];
  for (const { direction, foot, events } of groups.values()) {
    events.sort((a, b) => a.t - b.t);
    let balance = 0, last = 0, source = '';
    for (const event of events) {
      if (balance !== 0 && event.t - last > 1e-6) result.push({ length: event.t - last,
        midpoint: direction.map((v, i) => foot[i]! + v * (last + event.t) / 2) as P3, source });
      if (balance === 0) source = event.source;
      balance += event.sign; last = event.t;
    }
  }
  return result;
}
