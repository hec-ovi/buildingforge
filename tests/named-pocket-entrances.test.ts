import { expect, it } from 'vitest';
import type { Node as GltfNode } from '@gltf-transform/core';
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest, type GenerateResult, type Opening } from '../src/index.ts';
import type { FloorAssembly } from '../src/sections/types.ts';
import { architectureSelections } from '../src/layout/architectureSelection.ts';
import { sectionOpenings } from '../src/layout/sectionOpenings.ts';
import { checkPocketDoor } from '../src/layout/pocketInvariants.ts';
import { pocketInsidePlate } from '../src/layout/pocketDoor.ts';
import { edgeDir, edgeNormal } from '../src/core/polygon.ts';
import { glbIO, glbJson, keys, sibling } from './support.ts';

type Family = 'residential-courtyard' | 'residential-megablock';
function input(architecture: Family, width: number): BuildingRequest {
  const floors = width === 60 ? 8 : 6;
  return {seed:`worn-homes-${architecture}-${width}-v2`,buildingId:`${architecture}-poor-${width}`,theme:'cyberpunk',
    parcel:{footprint:[[0,0],[width,0],[width,width],[0,width]],accessPoint:[width/2,-1],maxHeight:42},
    building:{type:'residential',tier:'poor',floors,floorKinds:Array.from({length:floors},(_,i)=>i?'apartment':'lobby')},
    options:{architecture,minimumClearHeight:3,glb:'named',balconies:'off',doorMotion:'pocket',facadeServices:'off',roofArtifacts:'off',adScreens:'off',signage:null}};
}

const plans = [['residential-courtyard',40],['residential-courtyard',60],['residential-megablock',40],['residential-megablock',60]] as const;
const built = new Map<string, Promise<GenerateResult>>();
const build = (family: Family, width: number) => {
  const key = `${family}:${width}`;
  if (!built.has(key)) built.set(key, generate(input(family, width), keys));
  return built.get(key)!;
};
const mainEntrance = (result: GenerateResult) => {
  const ground = result.blueprint.floors[0]!, opening = ground.openings.find(o => o.doorRole === 'main')!;
  return { ground, opening, assembly: opening.door! };
};

/** Every exported surface except the moving leaves, in world space. */
function fixedSurfaces(glb: Uint8Array, material: MeshBasicMaterial): Promise<Mesh[]> {
  const moving = (node: GltfNode | null): boolean => !!node
    && (/^door:[^/]+\/leaf:\d+$/.test(node.getName()) || moving(node.getParentNode()));
  return glbIO().readBinary(glb).then(document => document.getRoot().listNodes().filter(node => !moving(node))
    .flatMap(node => node.getMesh()?.listPrimitives().map(primitive => {
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!), 3));
      geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
      geometry.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(); return mesh;
    }) ?? []));
}

it('retains reference-family candidates when automatic selection explicitly requests a pocket', () => {
  const request=input('residential-courtyard',40);request.options!.architecture='auto';
  expect(architectureSelections(request).some(choice=>choice.selected==='residential-courtyard')).toBe(true);
});

it('rejects an explicit named pocket when a complete cassette cannot fit, without changing it to a hinge', () => {
  const request=input('residential-megablock',40);
  const plan: FloorAssembly={floor:0,group:0,outline:[[0,0],[4,0],[4,5],[0,5]],balconySections:[],sections:[
    {id:'entry-bay',technique:'paired-glass',edge:0,offset:0,width:4,border:{side:.5,bottom:0,top:.5,depth:.16},windows:[]}]};
  const opening: Opening={id:'entrance',kind:'door',doorRole:'main',edge:0,offset:.5,width:3,height:3,sill:0,leaves:2,
    door:{set:'layered',frameWidth:.11,frameDepth:.07,recessDepth:.16,thresholdHeight:0,motion:{kind:'swing',maxTravel:90,clearDepth:1.5}}};
  expect(()=>sectionOpenings(request,plan,4.5,[opening])).toThrow(expect.objectContaining({code:'E_DOOR_FIT'}));
});

it.each(plans)('exports %s %im with its named architecture and an empty pocket chamber', async (family,width)=>{
  const request=input(family,width),before=JSON.stringify(request);
  const result=await build(family,width),{blueprint,glb}=result;
  expect(JSON.stringify(request)).toBe(before);
  expect(blueprint.assembly!.architecture).toBe(family);
  const {ground,opening,assembly}=mainEntrance(result);
  expect(assembly.motion.kind).toBe('pocket');
  if(assembly.motion.kind!=='pocket')throw new Error('pocket required');
  checkPocketDoor(ground,opening);
  const cassette=assembly.cassette!;
  expect(pocketInsidePlate(ground.outline,opening.edge,cassette.offset,cassette.offset+cassette.width,cassette.backDepth)).toBe(true);
  expect(cassette.height).toBeLessThanOrEqual(ground.height);
  const names=glbJson(glb).nodes.map((node:{name:string})=>node.name);
  for(const leaf of assembly.motion.leaves)expect(names).toContain(`door:entrance/leaf:${leaf.leaf}`);
  for(const other of ground.openings.filter(o=>o!==opening&&o.edge===opening.edge)) {
    expect(other.offset+other.width<=cassette.offset+1e-6||other.offset>=cassette.offset+cassette.width-1e-6).toBe(true);
  }
  // No exported fixed trim or family skin enters the moving chamber.
  const material=new MeshBasicMaterial({side:DoubleSide}),fixed=await fixedSurfaces(glb,material);
  const [ax,az]=ground.outline[opening.edge]!,[ux,uz]=edgeDir(ground.outline,opening.edge);
  const [nx,nz]=edgeNormal(ground.outline,opening.edge),inward=new Vector3(-nx,0,-nz);
  try {
    for(const leaf of assembly.motion.leaves){
      const pocket=leaf.pocket,depth=(pocket.frontDepth+pocket.backDepth)/2;
      const origin=new Vector3(ax+ux*(pocket.offset+.015),ground.elevation+1.2,az+uz*(pocket.offset+.015)).addScaledVector(inward,depth);
      const hits=new Raycaster(origin,new Vector3(ux,0,uz),0,pocket.width-.03).intersectObjects(fixed,false);
      expect(hits,`${family}: fixed triangles intrude into pocket ${leaf.leaf}`).toHaveLength(0);
    }
  } finally {for(const mesh of fixed)mesh.geometry.dispose();material.dispose();}
},120_000);

// Engine's own loader, physics and player body walk the exported door.
it.skipIf(!sibling('engine/src/game/city/BuildingsLoader.js')).each(plans)(
  'lets the Engine player through %s %im only while its pocket door is open', async (family,width)=>{
    const result=await build(family,width),{blueprint,glb}=result,request=input(family,width);
    const {ground}=mainEntrance(result);
    const engine=(file:string)=>new URL(`../../engine/src/game/${file}`,import.meta.url).href;
    const [{BuildingsLoader},{cityGltfLoader},{Physics},{PlayerBody},{DoorColliders}]=await Promise.all([
      import(engine('city/BuildingsLoader.js')),import(engine('data/CityGltfLoader.js')),import(engine('physics/Physics.js')),
      import(engine('physics/PlayerBody.js')),import(engine('physics/DoorColliders.js'))]);
    const factory={resolver:{resolve:()=>null},build:()=>new MeshBasicMaterial(),variant:()=>new MeshBasicMaterial()};
    const loader={loadAsync:async(url:string)=>{if(url!=='shell')throw new Error('Decorative model has no collision');
      return cityGltfLoader().parseAsync(new Uint8Array(glb).buffer,'');}};
    const city=await new BuildingsLoader(factory,loader).load(new Map([[request.buildingId,{parcelId:request.buildingId,blueprint,shellUrl:'shell',hasInterior:true}]]));
    const physics=await Physics.create();physics.addHalfSpace(-.01);
    physics.addTrimesh(city.shellColliders.get(request.buildingId));
    const colliders=new DoorColliders(physics,city.doors),door=city.doors.find((d:{id:string})=>d.id==='entrance');
    const inward=door.normal.clone().negate(),start=door.center.clone().addScaledVector(inward,-.8).add(new Vector3(0,.02,0));
    const player=new PlayerBody(physics,start);
    const cross=()=>{player.teleport(start);for(let i=0;i<100;i++){physics.step(1/60);player.move(inward.clone().multiplyScalar(1.4/60),1/60);}
      return player.feet.clone().sub(door.center).dot(inward);};
    try {
      expect(cross()).toBeLessThan(.15);
      door.motion.apply(door.pivots,1);colliders.sync(door);physics.step(1/60);
      expect(cross()).toBeGreaterThan(.9);
      expect(Math.abs(player.feet.y-ground.elevation)).toBeLessThan(.1);
      door.motion.apply(door.pivots,0);colliders.sync(door);physics.step(1/60);
      expect(cross()).toBeLessThan(.15);
    } finally {physics.world.free();}
  },120_000);
