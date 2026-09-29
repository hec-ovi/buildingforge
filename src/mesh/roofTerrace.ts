import type { Layout } from '../layout/model.ts';
import type { Blueprint } from '../types.ts';
import { hasRoofTerrace, roofTerracePlan, type RoofBay, type RoofTerracePlan } from '../layout/roofTerrace.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';
import { TERRACE, TerraceKit } from './terraceKit.ts';
import { terraceBar, terraceSalon, terraceGarden } from './terraceRooms.ts';

const METAL = TERRACE.metal, STONE = TERRACE.stone, GLASS = TERRACE.glass;

/** Furnished outdoor rooms, generated against the actual roof and protected stair
 * approach. Lamps append through the existing family-decoration contract: every
 * authored source is meshed by the final lightFixture pass and exported verbatim.
 * The outdoors remain outdoors; no room/weather or renderer workaround is used. */
export function meshRoofTerrace(builder: MeshBuilder, layout: Layout): void {
  if (!hasRoofTerrace(layout.request)) return;
  const plan = roofTerracePlan(layout.roof.outline, layout.roof.bulkhead);
  if (!plan) return;
  const top = layout.roof.elevation;
  const lights = layout.lights ??= [];
  guard(builder.part('roof-terrace:guard'), layout.roof.outline, top, layout.roof.parapetHeight);
  for (const [i, bay] of plan.lounge.entries()) {
    const kind = i === 0 ? 'bar' : 'salon';
    const kit = new TerraceKit(builder.part(`roof-terrace:lounge:${kind}`), plan, top, lights);
    if (i === 0) terraceBar(kit, bay); else terraceSalon(kit, bay);
    drain(kit, bay.u + .5, bay.v + .14, bay.width - 1, .08);
  }
  if (plan.service) services(builder.part('roof-terrace:services'), plan, plan.service, top, lights);
  if (plan.garden) terraceGarden(new TerraceKit(builder.part('roof-terrace:garden'), plan, top, lights), plan.garden);
}

function services(sink: PartSink, plan: RoofTerracePlan, bay: RoofBay, top: number, lights: Blueprint['lights']): void {
  const t = new TerraceKit(sink, plan, top, lights), { u, v, width: w, depth: d } = bay;
  // Folded louvre enclosure with a two-metre front entrance, not a solid box.
  for (const x of [u + .15, u + w - .15]) {
    for (const z of [v + .15, v + d - .15]) t.box(METAL, x, 0, z, .08, 1.9, .08);
    for (let y = .15; y < 1.8; y += .18) t.box(METAL, x, y, v + d / 2, .07, .09, d - .3);
  }
  for (let y = .15; y < 1.8; y += .18) {
    t.box(METAL, u + w / 2, y, v + d - .15, w - .3, .09, .07);
    for (const side of [-1, 1]) t.box(METAL, u + w / 2 + side * (w / 4 + .5), y, v + .15, w / 2 - 1.3, .09, .07);
  }
  // A connected trunk with branches into each fan bank; clamped to regular supports.
  for (const side of [-1, 1]) {
    const z = v + d - .7 + side * .13;
    t.rod(METAL, [u + .6, .32, z], [u + w - .6, .32, z], .075);
    for (const artifact of plan.equipment) {
      const dx = artifact.center[0] - plan.origin[0], dz = artifact.center[1] - plan.origin[1];
      const x = dx * plan.axis[0] + dz * plan.axis[1];
      t.rod(METAL, [x, .32, z], [x, .32, v + 3.85], .045);
    }
  }
  for (let x = u + .7; x < u + w - .5; x += 1.4) t.box(STONE, x, 0, v + d - .7, .18, .25, .65);
  // These are actual supported service lights, published to the existing light pool.
  t.lamp(u + .2, 1.62, v + .18, 0, -1, 750, 7);
  t.lamp(u + w - .2, 1.62, v + .18, 0, -1, 750, 7);
  drain(t, u + .5, v + .65, w - 1);
}

function drain(t: TerraceKit, u: number, v: number, length: number, base = 0): void {
  t.box(METAL, u + length / 2, base, v, length, .012, .15);
  for (let x = u + .04; x < u + length; x += .09) t.box(STONE, x, base + .012, v, .018, .005, .13);
}

function guard(sink: PartSink, outline: [number, number][], top: number, parapet: number): void {
  const high = Math.max(1.2, parapet + .06), bottom = Math.max(.32, parapet);
  for (let e = 0; e < outline.length; e++) {
    const a = outline[e]!, b = outline[(e + 1) % outline.length]!, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .05) continue;
    const u: V3 = [dx / length, 0, dz / length], inward: V3 = [-u[2], 0, u[0]];
    const at = (t: number, y: number): V3 => [a[0] + u[0] * t + inward[0] * .04, top + y, a[1] + u[2] * t + inward[2] * .04];
    const box = (key: string, start: number, end: number, y0: number, y1: number, depth: number) => sink.box(key,
      at((start + end) / 2, (y0 + y1) / 2), [u[0] * (end - start) / 2, 0, u[2] * (end - start) / 2],
      [0, (y1 - y0) / 2, 0], [inward[0] * depth / 2, 0, inward[2] * depth / 2]);
    box(METAL, 0, length, high - .045, high, .06);
    const count = Math.max(1, Math.ceil(length / 1.5)), pitch = length / count;
    for (let i = 0; i < count; i++) {
      box(METAL, i * pitch, i * pitch + .035, bottom, high, .05);
      if (pitch > .08) box(GLASS, i * pitch + .035, (i + 1) * pitch, bottom + .035, high - .06, .018);
    }
  }
}
