import { applyWindowPolicy } from './layout/windowPolicy.ts';
// Orchestration: validate -> style -> massing -> floor stack -> facades ->
// features -> mesh -> GLB + blueprint.

import { validateRequest } from './core/validate.ts';
import { FAMILY } from './rules/families.ts';
import { buildStyle } from './layout/style.ts';
import { selectExteriorStyle, EXTERIOR_STYLES } from './layout/exteriorStyle.ts';
import { buildMassing } from './layout/massing.ts';
import { inspectCorePlate } from './layout/plateCore.ts';
import { buildFloorStack } from './layout/floorStack.ts';
import { buildFacades } from './layout/facades.ts';
import { entranceCandidates } from './layout/entrance.ts';
import { balconiesEnabled, buildBalconyBands } from './layout/balconies.ts';
import { buildRelief } from './layout/relief.ts';
import { mountAnchors } from './layout/anchors.ts';
import { faceObstacles } from './layout/obstructions.ts';
import { facadeDepth } from './layout/core.ts';
import { coreAdjacency, corePerimeterClearance, validateAdjacencyOpenings } from './layout/coreAdjacency.ts';
import { constructionCoreFrame, fitBuildingCore } from './layout/corePreflight.ts';
import { planCoreOpenings } from './layout/coreOpeningPlan.ts';
import { buildFacadeFeatures } from './layout/features.ts';
import { buildRoof } from './layout/roof.ts';
import { buildFacadeServiceDetails } from './layout/facadeServiceAdapter.ts';
import { buildMesh, buildOpeningMesh } from './mesh/mesher.ts';
import { writeGlb } from './glb/writer.ts';
import { buildBlueprint } from './blueprint/builder.ts';
import { ExteriorError } from './core/errors.ts';
import type { Layout } from './layout/model.ts';
import type { GenerateOptions, GenerateResult } from './types.ts';

import { checkInvariants } from './layout/validateLayout.ts';

export async function generate(raw: unknown, options: GenerateOptions = {}): Promise<GenerateResult> {
  try {
    return await generateBuilding(raw, options);
  } catch (error) {
    if (error instanceof ExteriorError) throw error;
    throw new ExteriorError('E_INVARIANT', 'generation failed to produce a valid shell', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function generateBuilding(raw: unknown, options: GenerateOptions): Promise<GenerateResult> {
  let req = validateRequest(raw);
  const family = FAMILY[req.building.type];
  const tier = req.building.tier;
  const exteriorStyle = selectExteriorStyle(req, family, tier);
  const policy = EXTERIOR_STYLES[exteriorStyle];
  const shape = !req.options?.shape || req.options.shape === 'auto' ? 'box' : req.options.shape;
  req = { ...req, options: { ...req.options, exteriorStyle, shape } };
  let facade = policy.facade;
  if (facade === 'curtain-wall' && ['commerce', 'mall'].includes(req.building.type)) facade = 'glass';
  if (facade === 'megablock' && tier !== 'poor') facade = 'panel';
  if (facade === 'curtain-wall' && (family === 'residential' || family === 'hotel')
    && req.options?.balconies === 'on' && req.options.balconyStyle === 'full') facade = 'glass';
  if (req.options?.architecture) facade = 'glass';
  const style = buildStyle(req.seed, family, tier, req.building.floors, facade);
  if (!req.options?.architecture) applyWindowPolicy(style);
  if (req.options?.architecture) {
    style.facade.bandHeight = 0; style.facade.bandProud = 0;
    if (req.options.architecture === 'terrace-blocks') style.balconyDepth = 1.5;
  }
  const facadeInset = req.options?.architecture ? Math.max(0.5, facadeDepth(style.facade.kind)) : facadeDepth(style.facade.kind);
  const preferredCoreInset = facadeInset + corePerimeterClearance(req);
  const stack = buildFloorStack(req, family, tier, style);
  const balconyInset = balconiesEnabled(req, family, tier) ? style.balconyDepth : 0;
  const floorHeights = stack.levels.map((floor) => floor.height);
  const planFacades = (inset: number) => {
    const massing = buildMassing(req, inset, facadeInset, preferredCoreInset, floorHeights);
    const streetEdges = entranceCandidates(massing.groundOutline, req.parcel.accessPoint, req.parcel.streetAccess);
    const facades = buildFacades(req, family, tier, style, massing, stack, streetEdges);
    return { massing, streetEdges, facades, balconyBands: buildBalconyBands(req, family, tier, style, facades.floors) };
  };
  let plan = planFacades(balconyInset);
  if (balconyInset > 0 && !plan.balconyBands.some((band) => band.depth > 0) && !req.apertures?.length) plan = planFacades(0);
  const { massing, streetEdges, facades, balconyBands } = plan;
  validateAdjacencyOpenings(coreAdjacency(req), facades.floors);
  const corePlate = inspectCorePlate(
    facades.floors, facadeInset, facades.floors.filter((floor) => floor.index >= 0).length, massing.rectangular);
  if (corePlate.error) throw corePlate.error;
  const coreFrame = constructionCoreFrame(corePlate.axis, massing.rectangular);
  const { floors, mesh: measuredOpenings, stair: coreStair } = planCoreOpenings({
    request: req, theme: req.theme, tier, style, floors: facades.floors, carved: facades.carved,
  }, coreFrame);
  facades.floors = floors;
  const relief = buildRelief(style, facades.floors, facades.carved);
  if (massing.assembly) relief.byEdge = [];
  const obstacles = faceObstacles(facades.floors, facades.carved, facades.anchors, relief, stack.top);
  const anchors = mountAnchors(facades.anchors, massing.groundOutline, obstacles);
  const features = buildFacadeFeatures(
    req, family, tier, style, massing, stack.top, facades.floors, streetEdges, obstacles);
  const facadeServices = buildFacadeServiceDetails({
    request: req, family, tier, style, floors: facades.floors, relief, anchors, balconyBands,
    facadeArtifacts: features.facadeArtifacts, signage: features.signage, screens: features.screens,
    lights: features.lights, fireEscape: features.fireEscape,
  });
  const openingMesh = facadeServices.damagedWindows.length > 0
    ? buildOpeningMesh({ request: req, theme: req.theme, tier, style, floors: facades.floors, carved: facades.carved })
    : measuredOpenings;
  const roof = buildRoof(req, family, style, facades.floors, coreStair);

  const layout: Layout = {
    ...(coreFrame ? { coreFrame } : {}),
    ...(massing.assembly ? { assembly: massing.assembly } : {}),
    request: req, family, tier, theme: req.theme, style, relief,
    floors: facades.floors, balconyBands, carved: facades.carved, anchors,
    facadeServices, roof,
    ...features,
  };
  checkInvariants(layout, obstacles);

  const mb = buildMesh(layout, openingMesh);
  const blueprint = buildBlueprint(layout, mb);
  fitBuildingCore(blueprint);
  const { glb, textures } = await writeGlb(layout, mb, options.textures ?? {});
  return { glb, blueprint, textures };
}
