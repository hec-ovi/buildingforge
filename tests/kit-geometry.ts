import type { AssemblyPlan, P3, Placement } from '../src/kit/types.ts';
import type { KitFamily } from '../src/kit/catalog.ts';
import { boundaries, openEdges, Weld, type Mesh, type Face } from './kit-mesh.ts';

const TOL = 0.001;
const distance = (a: P3, b: P3) => Math.hypot(...a.map((v, i) => v - b[i]!));
const snap = (v: number) => Math.abs(v) < 1e-9 ? 0 : Math.abs(v - 1) < 1e-9 ? 1 : Math.abs(v + 1) < 1e-9 ? -1 : v;
function transform(p: P3, placement: Placement): P3 {
  const c = snap(Math.cos(placement.rotationY)), s = snap(Math.sin(placement.rotationY));
  const [x, y, z] = placement.position;
  return [x + c * p[0] + s * p[2], y + p[1], z - s * p[0] + c * p[2]];
}

/** Measure the decoded piece instances using the supplied seam script's method. */
export function measureAssembly(plan: AssemblyPlan, family: KitFamily, pieces: Map<string, Mesh>) {
  const instances = plan.placements.map(placement => {
    const mesh = pieces.get(placement.piece)!, world = mesh.points.map(p => transform(p, placement));
    return { placement, mesh, world,
      min: [0, 1, 2].map(axis => Math.min(...world.map(p => p[axis]!))),
      max: [0, 1, 2].map(axis => Math.max(...world.map(p => p[axis]!))),
    };
  });
  type Plane = [axis: number, value: number];
  type Seam = { a: number; b: number; pa: Plane; pb: Plane };
  const index = new Map(instances.map((it, i) => [`${it.placement.floor}/${it.placement.face}/${it.placement.bayIndex}`, i]));
  const at = (floor: number, face: number, bay: number | null) => index.get(`${floor}/${face}/${bay}`)!;
  const seams: Seam[] = [];
  for (const band of plan.bands) {
    for (let face = 0; face < 4; face++) {
      const count = [40, 56, 40, 56][face]! / 8 - 1;
      seams.push({ a: at(band.floor, face, null), b: at(band.floor, face, 0), pa: [0, 4], pb: [0, 0] });
      for (let bay = 0; bay + 1 < count; bay++) seams.push({ a: at(band.floor, face, bay), b: at(band.floor, face, bay + 1), pa: [0, 8], pb: [0, 0] });
      seams.push({ a: at(band.floor, face, count - 1), b: at(band.floor, (face + 1) % 4, null), pa: [0, 8], pb: [2, 4] });
    }
    if (band.floor + 1 < plan.bands.length) instances.forEach((it, i) => {
      if (it.placement.floor === band.floor) seams.push({ a: i,
        b: at(band.floor + 1, it.placement.face, it.placement.bayIndex), pa: [1, band.height], pb: [1, 0] });
    });
  }
  let seamMetres = 0, seamHoleMetres = 0;
  for (const seam of seams) {
    const a = instances[seam.a]!, b = instances[seam.b]!;
    const select = (it: typeof a, [axis, value]: Plane) => new Set(it.mesh.points
      .flatMap((p, i) => Math.abs(p[axis]! - value) <= TOL ? [i] : []));
    const ia = select(a, seam.pa), ib = select(b, seam.pb);
    const pa = [...ia].map(i => a.world[i]!), pb = [...ib].map(i => b.world[i]!);
    const nearest = (ps: P3[], qs: P3[]) => ps.reduce((max, p) => Math.max(max,
      qs.reduce((min, q) => Math.min(min, distance(p, q)), Infinity)), 0);
    seamMetres = Math.max(seamMetres, pa.length && pb.length ? Math.max(nearest(pa, pb), nearest(pb, pa)) : Infinity);
    const weld = new Weld();
    const edges = [[a, ia], [b, ib]].flatMap(([it, ids]) => {
      const instance = it as typeof a, selected = ids as Set<number>;
      return openEdges(instance.mesh.faces).filter(e => selected.has(e.a) && selected.has(e.b))
        .map(e => ({ ...e, a: weld.add(instance.world[e.a]!), b: weld.add(instance.world[e.b]!) }));
    });
    seamHoleMetres += boundaries(edges, weld.points).reduce((sum, edge) => sum + edge.length, 0);
  }
  const overlaps: { a: number; b: number; depth: number }[] = [];
  for (let a = 0; a < instances.length; a++) for (let b = a + 1; b < instances.length; b++) {
    const i = instances[a]!, j = instances[b]!;
    const depth = Math.min(...[0, 1, 2].map(axis => Math.min(i.max[axis]!, j.max[axis]!) - Math.max(i.min[axis]!, j.min[axis]!)));
    if (depth > TOL) overlaps.push({ a, b, depth });
  }
  const weld = new Weld(), faces: Face[] = [];
  for (const instance of instances) {
    const ids = instance.world.map(p => weld.add(p));
    for (const face of instance.mesh.faces) faces.push({ vertices: face.vertices.map(i => ids[i]!), source: `${instance.placement.piece}/${face.source}` });
  }
  const holes = boundaries(openEdges(faces), weld.points).filter(edge =>
    Math.abs(edge.midpoint[1]) > TOL && Math.abs(edge.midpoint[1] - plan.blueprint.roof.elevation) > TOL);
  const inner = holes.filter(({ midpoint: [x, , z] }) => Math.min(x, 40 - x, z, 56 - z) >= 0.1);
  const records = instances.flatMap(it => family.pieces.find(p => p.id === it.placement.piece)!.openings);
  const blueprint = plan.blueprint.floors.flatMap(f => f.openings);
  const counts = (openings: { kind: string }[]) => ({ windows: openings.filter(o => o.kind === 'window').length, doors: openings.filter(o => o.kind === 'door').length });
  return { family: family.id, floors: plan.bands.length, seamMillimetres: seamMetres * 1000,
    overlaps, seamHoleMetres, innerHoleMetres: inner.reduce((sum, e) => sum + e.length, 0),
    holeMetres: holes.reduce((sum, e) => sum + e.length, 0), holes: holes.slice(0, 5),
    openings: counts(records), blueprintOpenings: counts(blueprint) };
}

/** Area of the actual inner plane, excluding every authored window and passage. */
export function backingArea(mesh: Mesh, axis: number, depth: number): number {
  let area = 0;
  for (const face of mesh.faces) {
    if (!face.source.startsWith('backing/')) continue;
    const points = face.vertices.map(i => mesh.points[i]!);
    if (points.some(p => Math.abs(p[axis]! - depth) > 1e-4)) continue;
    const [a, b, c] = points as [P3, P3, P3];
    const u = b.map((v, i) => v - a[i]!), v = c.map((n, i) => n - a[i]!);
    area += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
  }
  return area;
}
