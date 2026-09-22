import { tubeSegment, type FacadeField, type MeshBuilder, type PartSink } from '../api.ts';
import { overlaps, type Box } from './geometry.ts';

interface Fixture { builder: MeshBuilder; field: FacadeField; name: string; material: (role: string) => string; skin: number; reduced?: boolean }

function casing(f: Fixture, u: number, y: number): void {
  const { field, skin, material } = f, sink = f.builder.part(`${f.name}:casing`);
  field.solid(sink, material('service'), u - 0.54, u + 0.54, y + 0.4, y + 0.91, skin + 0.5, skin + 0.035);
  field.plate(sink, material('service-dark'), u - 0.48, u + 0.14, y + 0.44, y + 0.87, skin + 0.508);
  field.solid(sink, material('service'), u - 0.57, u + 0.57, y + 0.9, y + 0.94, skin + 0.53, skin + 0.03);
  for (let row = 0; row < (f.reduced ? 3 : 6); row++) field.plate(sink, material('service-dark'), u + 0.27, u + 0.46,
    y + 0.48 + row * (f.reduced ? 0.11 : 0.055), y + 0.496 + row * (f.reduced ? 0.11 : 0.055), skin + 0.507);
}

function fan(f: Fixture, u: number, y: number): void {
  const { field, skin, material } = f, sink = f.builder.part(`${f.name}:fan`), centre = field.point(u, y, skin + 0.516);
  const normal: [number, number, number] = [field.normal[0], 0, field.normal[1]];
  const count = f.reduced ? 8 : 16;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count, b = (i + 1) * Math.PI * 2 / count;
    const point = (angle: number, r: number) => field.point(u + Math.cos(angle) * r, y + Math.sin(angle) * r, skin + 0.525);
    sink.triFacing(material('service-dark'), centre, point(a, 0.195), point(b, 0.195), normal, [[0.5, 0.5], [0, 0], [1, 0]]);
    sink.quadFacing(material('service'), point(a, 0.195), point(a, 0.22), point(b, 0.22), point(b, 0.195), normal,
      [[0, 0], [0, 0.025], [0.08, 0.025], [0.08, 0]]);
  }
  field.solid(sink, material('service'), u - 0.035, u + 0.035, y - 0.035, y + 0.035, skin + 0.536, skin + 0.516);
}

function grille(f: Fixture, u: number, y: number): void {
  const { field, material, skin } = f, sink = f.builder.part(`${f.name}:grille`);
  for (let line = f.reduced ? -2 : -3; line <= 3; line += f.reduced ? 2 : 1) {
    const x = line * 0.048, half = Math.sqrt(0.193 ** 2 - x ** 2);
    field.solid(sink, material('service'), u + x - 0.006, u + x + 0.006, y - half, y + half, skin + 0.55, skin + 0.533);
  }
  field.solid(sink, material('service'), u - 0.19, u + 0.19, y - 0.006, y + 0.006, skin + 0.552, skin + 0.54);
}

function supports(f: Fixture, u: number, y: number): void {
  const { field, material, skin } = f, sink = f.builder.part(`${f.name}:support`);
  for (const x of [u - 0.39, u + 0.39]) {
    field.solid(sink, material('service'), x - 0.035, x + 0.035, y + 0.18, y + 0.46, skin + 0.075, skin);
    field.solid(sink, material('service'), x - 0.035, x + 0.035, y + 0.35, y + 0.4, skin + 0.54, skin + 0.015);
    if (!f.reduced) sink.slantedBox(material('service'), field.point(x, y + 0.2, skin + 0.06), field.point(x, y + 0.365, skin + 0.47),
      [field.dir[0], 0, field.dir[1]], 0.045, 0.035);
  }
}

function route(sink: PartSink, f: Fixture, points: [number, number, number][], radius: number): void {
  for (let i = 1; i < points.length; i++) tubeSegment(sink, f.material('service'),
    f.field.point(...points[i - 1]!), f.field.point(...points[i]!), radius);
}

/** A compact recognizable condenser, its supported return line and a solid-wall riser. */
export function condenser(f: Fixture, u: number, y: number, pier: number, pipeDepth: number, holes: Box[]): boolean {
  const envelope = { u0: Math.min(pier - 0.09, u - 0.6), u1: u + 0.6, y0: y + 0.15, y1: y + 0.98 };
  if (holes.some(h => overlaps(envelope, h))) return false;
  casing(f, u, y); fan(f, u - 0.18, y + 0.665); grille(f, u - 0.18, y + 0.665); supports(f, u, y);
  const sink = f.builder.part(`${f.name}:return-line`);
  route(sink, f, [[u + 0.5, y + 0.48, f.skin + 0.18], [u + 0.5, y + 0.29, f.skin + 0.18],
    [u + 0.5, y + 0.29, pipeDepth], [pier, y + 0.29, pipeDepth]], 0.025);
  return true;
}

export function riser(f: Fixture, u: number, bottom: number, top: number, holes: Box[], first: boolean, last: boolean): boolean {
  if (holes.some(h => overlaps({ u0: u - 0.12, u1: u + 0.12, y0: bottom, y1: top }, h))) return false;
  const sink = f.builder.part(f.name), depth = f.skin + 0.12;
  const low = bottom + (first ? 0.12 : 0), high = top - (last ? 0.12 : 0);
  route(sink, f, [[u, low, depth], [u, high, depth]], 0.044);
  for (const y of [...(first ? [low] : []), ...(last ? [high] : [])]) {
    route(sink, f, [[u, y, depth], [u, y, f.skin - 0.025]], 0.044);
    f.field.solid(sink, f.material('service-dark'), u - 0.09, u + 0.09, y - 0.08, y + 0.08, f.skin + 0.01, f.skin - 0.02);
  }
  for (const y of [bottom + 0.19, top - 0.19]) {
    f.field.solid(sink, f.material('service'), u - 0.1, u + 0.1, y - 0.035, y + 0.035, depth + 0.055, f.skin);
    if (!f.reduced) tubeSegment(sink, f.material('service'), f.field.point(u, y - 0.055, depth), f.field.point(u, y + 0.055, depth), 0.055);
  }
  return true;
}
