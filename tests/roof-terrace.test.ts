import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { roofTerracePlan, type RoofTerracePlan } from '../src/layout/roofTerrace.ts';
import { ringInsidePolygon } from '../src/core/polygon.ts';
import { meshRoofTerrace } from '../src/mesh/roofTerrace.ts';
import { MeshBuilder } from '../src/mesh/primitives.ts';
import type { Layout } from '../src/layout/model.ts';
import { materials } from '../src/families/balcony-grid/materials.ts';
import { keys, glbIO, sibling } from './support.ts';
import { TERRACE } from '../src/mesh/terraceKit.ts';

const request: BuildingRequest = { seed: 'luxury-reference-review', buildingId: 'terrace-proof', theme: 'cyberpunk',
  parcel: { footprint: [[0, 0], [40, 0], [40, 40], [0, 40]], accessPoint: [20, 0], maxHeight: 32 },
  building: { type: 'residential', tier: 'high_rich', floors: 6 }, options: { architecture: 'balcony-grid', glb: 'named' } };

it('fits generous ordered terrace bays outside the door spine on rotated and scaled roofs', async () => {
  for (const [size, angle] of [[40, 0], [60, .37], [40, Math.PI / 2]]) {
    const point = (x: number, z: number): [number, number] => [x * Math.cos(angle!) - z * Math.sin(angle!), x * Math.sin(angle!) + z * Math.cos(angle!)];
    const input = structuredClone(request);
    input.parcel.footprint = [[0, 0], [size!, 0], [size!, size!], [0, size!]].map(([x, z]) => point(x!, z!));
    input.parcel.accessPoint = point(size! / 2, 0);
    const { blueprint } = await generate(input, keys);
    const plan = roofTerracePlan(blueprint.roof.outline, blueprint.roof.bulkhead)!;
    expect(plan.lounge.length).toBe(2);
    expect(ringInsidePolygon(plan.outline, [[plan.route.u, plan.route.v], [plan.route.u + plan.route.width, plan.route.v],
      [plan.route.u + plan.route.width, plan.route.v + plan.route.depth], [plan.route.u, plan.route.v + plan.route.depth]])).toBe(true);
    expect(Math.min(plan.route.width, plan.route.depth)).toBeCloseTo(2);
    expect(plan.equipment).toHaveLength(3);
    for (const bay of [...plan.lounge, plan.service!, ...(plan.garden ? [plan.garden] : [])]) {
      expect(ringInsidePolygon(plan.outline, [[bay.u, bay.v], [bay.u + bay.width, bay.v],
        [bay.u + bay.width, bay.v + bay.depth], [bay.u, bay.v + bay.depth]])).toBe(true);
      const route = plan.route;
      expect(bay.u + bay.width <= route.u || bay.u >= route.u + route.width
        || bay.v + bay.depth <= route.v || bay.v >= route.v + route.depth).toBe(true);
    }
    expect(blueprint.roof.artifacts).toEqual(plan.equipment);
    // Consumer palm/shrub aliases are trees, so the roof publishes its own leaves.
    const foliage = new MeshBuilder();
    meshRoofTerrace(foliage, { request: input, roof: blueprint.roof } as Layout);
    const leaves = foliage.parts.flatMap(p => [...p.prims.entries()].filter(([k]) => k.includes('/hiromi-fern/')).map(([,v]) => v));
    expect(leaves.reduce((n,p) => n + p.indices.length / 3, 0)).toBeGreaterThan(1000);
    for (const leaf of leaves) for (let i = 0; i < leaf.indices.length; i += 3) {
      const [a,b,c] = leaf.indices.slice(i,i+3).map(j => leaf.positions.slice(j*3,j*3+3));
      const ab = b!.map((n,j) => n-a![j]!), ac = c!.map((n,j) => n-a![j]!);
      expect(Math.hypot(ab[1]!*ac[2]!-ab[2]!*ac[1]!, ab[2]!*ac[0]!-ab[0]!*ac[2]!, ab[0]!*ac[1]!-ab[1]!*ac[0]!)).toBeGreaterThan(1e-8);
    }
    expect(blueprint.floors.flatMap(f => f.openings).filter(o => o.kind === 'window').every(o =>
      o.material?.includes('/paired-window-glass/'))).toBe(true);
  }
}, 120_000);

const engine = (file: string) => new URL(`../../engine/src/game/city/${file}`, import.meta.url).href;
const withEngine = it.skipIf(!sibling('engine/src/game/city/BuildingsLoader.js'));
const outsideRoute = (plan: RoofTerracePlan, x: number, z: number) => {
  const dx = x - plan.origin[0], dz = z - plan.origin[1];
  const u = dx * plan.axis[0] + dz * plan.axis[1], v = -dx * plan.axis[1] + dz * plan.axis[0];
  return u <= plan.route.u || u >= plan.route.u + plan.route.width || v <= plan.route.v || v >= plan.route.v + plan.route.depth;
};

it('raises a 1.2 m guard and keeps every furnished bay off the stair-door route at mesh level', async () => {
  const { blueprint } = await generate(request, keys);
  const mesh = new MeshBuilder();
  meshRoofTerrace(mesh, { request, roof: blueprint.roof } as Layout);
  const guard = mesh.parts.find(p => p.name === 'roof-terrace:guard')!;
  expect(guard).toBeDefined();
  const ys = [...guard.prims.values()].flatMap(p => p.positions.filter((_, i) => i % 3 === 1));
  expect(Math.max(...ys) - blueprint.roof.elevation).toBeCloseTo(1.2);
  // The slatted canopy has columns to its deck, and every occupied bay is wholly
  // separate from the protected stair-door route even at actual mesh level.
  const plan = roofTerracePlan(blueprint.roof.outline, blueprint.roof.bulkhead)!;
  for (const part of mesh.parts.filter(p => /lounge|services|garden/.test(p.name))) {
    for (const prim of part.prims.values()) for (let i = 0; i < prim.positions.length; i += 3) {
      expect(outsideRoute(plan, prim.positions[i]!, prim.positions[i + 2]!)).toBe(true);
    }
  }
}, 60_000);

withEngine('gives the roof, room lining and guard infill materials the Engine collides with', async () => {
  const { isColliderMaterial } = await import(engine('BuildingsLoader.js'));
  for (const role of ['roof', 'inner-wall', 'window-glass']) expect(isColliderMaterial(materials[role])).toBe(true);
  const { blueprint } = await generate(request, keys);
  const mesh = new MeshBuilder();
  meshRoofTerrace(mesh, { request, roof: blueprint.roof } as Layout);
  const guard = mesh.parts.find(p => p.name === 'roof-terrace:guard')!;
  for (const key of guard.prims.keys()) expect(isColliderMaterial(key)).toBe(true);
}, 60_000);

it('publishes sixteen supported warm roof lamps outside the protected walk, once', async () => {
  const { blueprint } = await generate(request, keys);
  const roofLights = blueprint.lights.filter(l => l.position[1] > blueprint.roof.elevation && l.material === TERRACE.lens);
  expect(roofLights).toHaveLength(16);
  const plan = roofTerracePlan(blueprint.roof.outline, blueprint.roof.bulkhead)!;
  for (const lamp of roofLights) {
    expect(lamp.lumens).toBeGreaterThanOrEqual(450);
    expect(lamp.lumens).toBeLessThanOrEqual(800);
    // Modeled lens depth .328 + .10 × .72 equals the consumer's fixed .4 m source offset.
    expect(lamp.standoff + lamp.size[2] * .72).toBeCloseTo(.4);
    expect(outsideRoute(plan, lamp.position[0] + lamp.normal[0] * .4, lamp.position[2] + lamp.normal[1] * .4)).toBe(true);
  }
  const layout = { request, roof: blueprint.roof, lights: [...blueprint.lights] } as Layout;
  meshRoofTerrace(new MeshBuilder(), layout);
  meshRoofTerrace(new MeshBuilder(), layout);
  expect(layout.lights).toHaveLength(blueprint.lights.length);
}, 60_000);

withEngine('lights each roof lamp through the Engine glow at its modeled lens', async () => {
  const { blueprint } = await generate(request, keys);
  const { shellGlows } = await import(engine('ShellFixtures.js'));
  const glows = shellGlows({ parcelId: request.buildingId, blueprint, hasInterior: true });
  const roofLights = blueprint.lights.filter(l => l.position[1] > blueprint.roof.elevation && l.material === TERRACE.lens);
  expect(roofLights).toHaveLength(16);
  for (const lamp of roofLights) {
    const source = [lamp.position[0] + lamp.normal[0] * .4, lamp.position[1], lamp.position[2] + lamp.normal[1] * .4];
    expect(glows.some((g: { position: { toArray(): number[] }; lumens: number }) =>
      g.lumens === lamp.lumens && g.position.toArray().every((n, i) => Math.abs(n - source[i]!) < 1e-6))).toBe(true);
  }
}, 60_000);

it('exports thin fern laminae as actual double-sided materials without duplicated underside triangles', async () => {
  const { glb } = await generate(request, keys);
  const doc = await glbIO().readBinary(glb!);
  const leaves = doc.getRoot().listMaterials().filter(m => m.getName() === 'cyberpunk/hiromi-fern/mid');
  expect(leaves.length).toBeGreaterThan(0);
  expect(leaves.every(m => m.getDoubleSided())).toBe(true);
}, 60_000);
