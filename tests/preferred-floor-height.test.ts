import { expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest } from '../src/index.ts';
import { validateRequest } from '../src/core/validate.ts';
import { buildFloorStack } from '../src/layout/floorStack.ts';
import { buildStyle } from '../src/layout/style.ts';
import { checkPocketDoor } from '../src/layout/pocketInvariants.ts';
import * as measurements from '../src/glb/measure.ts';
import { geometryBudget } from '../src/rules/geometryBudget.ts';
import { coreFeasibility } from '../../interior/dist/feasibility.js';
import { fixture, glbIO, keys, sibling } from './support.ts';

const families = ['residential-courtyard', 'residential-serviced', 'residential-megablock'] as const;
const plans = families.flatMap(family => [40, 60].map(width => [family, width] as const));
const built = new Map<string, ReturnType<typeof generate>>();
const build = (family: typeof families[number], width: number) => {
  const key = `${family}:${width}`;
  if (!built.has(key)) built.set(key, generate(request(family, width), keys));
  return built.get(key)!;
};
function request(architecture: typeof families[number], width: number): BuildingRequest {
  const floors = width === 60 ? 8 : 6;
  return { seed: `preferred-${architecture}-${width}`, buildingId: `${architecture}-${width}`, theme: 'cyberpunk',
    parcel: { footprint: [[0,0],[width,0],[width,width],[0,width]], accessPoint: [width/2,-1], maxHeight: 60 },
    building: { type: 'residential', tier: 'poor', floors,
      floorKinds: Array.from({length:floors}, (_,i)=>i ? 'apartment' : 'lobby') },
    options: { architecture, minimumClearHeight: 3, preferredFloorHeight: 3.5, glb: 'named',
      balconies: 'off', doorMotion: 'pocket', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', signage: null } };
}

it('validates pitch against the active clear-height policy and family maximum', () => {
  for (const pitch of [0, -1, NaN, Infinity, 3.49, 100]) {
    const input=request(families[0],40); input.options!.preferredFloorHeight=pitch;
    expect(()=>validateRequest(input)).toThrow(expect.objectContaining({code:'E_SCHEMA'}));
  }
  const input=request(families[0],40); delete input.options!.minimumClearHeight;
  expect(()=>validateRequest(input)).toThrow('active minimum 4.5');
  input.options!.preferredFloorHeight=4.5;
  expect(validateRequest(input).options!.preferredFloorHeight).toBe(4.5);
});

it('preserves omitted defaults, ground and basement heights, and exact pinned elevations', () => {
  const input=request(families[0],40); input.building.basements=1;
  const style={...buildStyle(input.seed,'residential','poor',6), floorHeight:4.5,groundFloorHeight:6};
  delete input.options!.preferredFloorHeight;
  const defaults=buildFloorStack(input,'residential','poor',style);
  input.options!.preferredFloorHeight=4.5;
  expect(buildFloorStack(input,'residential','poor',style)).toEqual(defaults);
  input.options!.preferredFloorHeight=3.5;
  const compact=buildFloorStack(input,'residential','poor',style);
  expect(compact.levels[0]).toEqual(defaults.levels[0]);
  expect(compact.levels[1]).toEqual(defaults.levels[1]);
  expect(compact.levels.filter(f=>f.index>0).every(f=>f.height===3.5)).toBe(true);
  input.apertures=[{id:'bridge',buildingId:input.buildingId,floor:2,face:0,kind:'bridge',u:10,base:13,height:3,width:2,
    shape:'rect',cut:{polygon:[[9,13,0],[11,13,0],[11,16,0],[9,16,0]],axisDir:[0,0,1]},linkId:'bridge-link'}];
  const pinned=buildFloorStack(input,'residential','poor',style);
  expect(pinned.levels.some(f=>f.elevation===13)).toBe(true);
  expect(pinned.levels.every(f=>f.height>=3.5)).toBe(true);
  expect(pinned.levels.at(-1)!.height).toBe(3.5);
  input.apertures=[]; input.parcel.maxHeight=21;
  const constrained=buildFloorStack(input,'residential','poor',style);
  expect(constrained.top).toBeLessThanOrEqual(21);
  expect(constrained.levels.every(f=>f.height>=3.5)).toBe(true);
});

it('keeps omitted ordinary requests byte-identical and on their existing measured-area budget', async () => {
  const input=fixture('ordinary-office');
  const original=await generate(input,keys);
  const explicitUndefined=await generate({...input,options:{...input.options,preferredFloorHeight:undefined}},keys);
  expect(explicitUndefined.blueprint).toEqual(original.blueprint);
  expect(explicitUndefined.glb).toEqual(original.glb);
  const floor=original.blueprint.floors.find(f=>f.index===0)!;
  const perimeter=floor.outline.reduce((sum,p,i,ring)=>sum+Math.hypot(ring[(i+1)%ring.length]![0]-p[0],ring[(i+1)%ring.length]![1]-p[1]),0);
  expect(original.blueprint.geometry!.budget).toEqual(geometryBudget(input,perimeter*original.blueprint.roof.elevation));
}, 120_000);

it.each(plans)('%s %im exports 3.5m repeated storeys with intact reveals, cassette and an admitted core', async (family,width) => {
    const input=request(family,width), original=JSON.stringify(input);
    const measured=vi.spyOn(measurements,'measureRuntime');
    const pending=generate(input,keys); built.set(`${family}:${width}`,pending);
    const {blueprint,glb}=await pending;
    const actual=measured.mock.results.at(-1)!.value as measurements.RuntimeGeometry;
    measured.mockRestore();
    expect(actual.triangles).toBe(blueprint.geometry!.triangles);
    expect(actual.triangles).toBeLessThanOrEqual(blueprint.geometry!.budget.triangles);
    expect(actual.bytes).toBeLessThanOrEqual(blueprint.geometry!.budget.bytes);
    const {preferredFloorHeight:unused,...defaultOptions}=input.options!;
    const previous=await generate({...input,options:defaultOptions},keys);
    expect(blueprint.geometry!.budget).toEqual(previous.blueprint.geometry!.budget);
    expect(blueprint.floors[0]!.height).toBe(previous.blueprint.floors[0]!.height);
    // Same authored footprints/setbacks/rounded corner radii; only vertical pitch changes.
    expect(blueprint.floors.map(f=>f.outline)).toEqual(previous.blueprint.floors.map(f=>f.outline));
    console.info(JSON.stringify({family,width,heights:blueprint.floors.map(f=>f.height),...actual,
      budget:blueprint.geometry!.budget,simplified:blueprint.geometry!.simplified??[]}));
    expect(JSON.stringify(input)).toBe(original);
    expect(blueprint.assembly!.architecture).toBe(family);
    expect(blueprint.floors.filter(f=>f.index>0).every(f=>f.height===3.5)).toBe(true);
    expect(blueprint.floors[0]!.height).toBeGreaterThan(3.5);
    expect(blueprint.core!.mode).not.toBe('none');
    expect(blueprint.roof.elevation).toBeLessThan(60);
    for(const floor of blueprint.floors) {
      expect(floor.roomEnvelope!.vertical.max-floor.roomEnvelope!.vertical.min).toBeGreaterThanOrEqual(3);
      for(const opening of floor.openings) expect(opening.sill+opening.height).toBeLessThanOrEqual(floor.height+1e-8);
    }
    const ground=blueprint.floors[0]!, entrance=ground.openings.find(o=>o.doorRole==='main')!;
    expect(entrance.door!.motion.kind).toBe('pocket'); checkPocketDoor(ground,entrance);
    expect(entrance.door!.cassette!.height).toBeLessThanOrEqual(ground.height);
    // Probe the exported permanent jamb/head/sill faces, not just blueprint bounds.
    const doc=await glbIO().readBinary(glb), material=new MeshBasicMaterial({side:DoubleSide});
    const meshes=doc.getRoot().listNodes().flatMap(node=>node.getMesh()?.listPrimitives().map(primitive=>{
      const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!),3));
      geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
      const mesh=new Mesh(geometry,material); mesh.name=node.getName();mesh.position.fromArray(node.getTranslation());mesh.updateMatrixWorld();return mesh;
    })??[]);
    let checks=0;
    try {
      for(const floor of [blueprint.floors[1]!,blueprint.floors.at(-1)!]) {
        const windows=floor.openings.filter(o=>o.kind==='window'&&o.glazing&&o.scenery).slice(0,4);
        for(const opening of windows) {
          const section=blueprint.assembly!.floors.find(f=>f.floor===floor.index)!.sections.find(s=>s.id===opening.sectionId)!;
          if(section.spans)continue;
          const a=floor.outline[opening.edge]!,b=floor.outline[(opening.edge+1)%floor.outline.length]!;
          const along=new Vector3(b[0]-a[0],0,b[1]-a[1]).normalize();
          const inset=opening.glazing!.glassDepth+(blueprint.facade.wallDepth-opening.glazing!.glassDepth)*.61;
          const point=(u:number,y:number)=>new Vector3(a[0]+along.x*u-along.z*inset,floor.elevation+y,a[1]+along.z*u+along.x*inset);
          const walls=meshes.filter(mesh=>mesh.name===`wall:${floor.index}/${opening.edge}`);
          const probes:[Vector3,Vector3][]=[
            [point(opening.offset+opening.width*.413,opening.sill),new Vector3(0,-1,0)],
            [point(opening.offset+opening.width*.413,opening.sill+opening.height),new Vector3(0,1,0)],
            [point(opening.offset,opening.sill+opening.height*.413),along.clone().negate()],
            [point(opening.offset+opening.width,opening.sill+opening.height*.413),along.clone()],
          ];
          for(const [target,direction] of probes){
            const ray=new Raycaster(target.clone().addScaledVector(direction,-.004),direction,0,.008);
            expect(ray.intersectObjects(walls,false),`${opening.id} reveal ${direction.toArray()}`).toHaveLength(1); checks++;
          }
        }
      }
      expect(checks).toBeGreaterThanOrEqual(16);
    } finally {for(const mesh of meshes)mesh.geometry.dispose();material.dispose();}
    // Interior's published preflight admits the core on the shorter stack, read as published JSON.
    expect(coreFeasibility(JSON.parse(JSON.stringify(blueprint))).fits).toBe(true);
  },120000);

// Interior's own stair geometry climbs every storey of the shorter stack.
it.skipIf(!sibling('interior/src/geometry/stairs.ts')).each(plans)('%s %im gives Interior legal flights and headroom at 3.5 m', async (family,width) => {
    const {blueprint}=await build(family,width);
    const {planFlights,shaftDepthFor}=await import(new URL('../../interior/src/layout/stair-plan.ts',import.meta.url).href);
    const {baseLanding,computeStairSteps,minHeadroom}=await import(new URL('../../interior/src/geometry/stairs.ts',import.meta.url).href);
    const {STAIR}=await import(new URL('../../interior/src/layout/constants.ts',import.meta.url).href);
    const admitted=coreFeasibility(JSON.parse(JSON.stringify(blueprint)));
    expect(admitted.fits).toBe(true);
    const stair=admitted.placement!.stairA;
    expect(Math.max(stair.width,stair.depth)).toBeGreaterThanOrEqual(shaftDepthFor(blueprint.floors.map(f=>f.height)));
    const shaft={u:0,v:0,lu:Math.max(stair.width,stair.depth),lv:Math.min(stair.width,stair.depth)};
    const stacked=[];
    for(const floor of blueprint.floors){
      const flight=planFlights(floor.height);
      expect(flight.flights%2).toBe(0);
      expect(flight.rise).toBeGreaterThanOrEqual(STAIR.riser.min);
      expect(flight.rise).toBeLessThanOrEqual(STAIR.riser.max);
      stacked.push(...[baseLanding(shaft,true,floor.elevation),...computeStairSteps(shaft,true,floor.elevation,floor.height)]
        .map(step=>({...step,slab:.32*flight.rise/.17})));
    }
    expect(minHeadroom(stacked)).toBeGreaterThanOrEqual(STAIR.headroom-1e-7);
  },120000);
