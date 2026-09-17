import { architectureSelections } from './layout/architectureSelection.ts';
import { isPaired } from './sections/index.ts';
import { buildingFamily } from './families/registry.ts';
import { GENERATION_POLICY } from './rules/generationPolicy.ts';
import { CanonicalNativeMaterials } from './materials/canonicalNative.ts';
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
import type { BuildingRequest, GenerateOptions, GenerateResult } from './types.ts';

import { checkInvariants } from './layout/validateLayout.ts';
import { geometryBudget, overBudget } from './rules/geometryBudget.ts';
import { FULL_DETAIL, SIMPLIFICATION, simplifiedTo } from './rules/simplification.ts';
import { countTriangles, measureRuntime } from './glb/measure.ts';

export async function generate(raw: unknown, options: GenerateOptions = {}): Promise<GenerateResult> {
  try {
    const request = validateRequest(raw);
    return request.options?.architecture === 'auto' ? await generateAutomatic(request, options) : await generateBuilding(request, options);
  } catch (error) {
    if (error instanceof ExteriorError) throw error;
    throw new ExteriorError('E_INVARIANT', 'generation failed to produce a valid shell', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function generateBuilding(raw: unknown, options: GenerateOptions, canonicalNative = false, simplify = true): Promise<GenerateResult> {
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
    if (isPaired(req.options.architecture)) style.parapetHeight = 0.28;
    if (req.options.architecture === 'terrace-blocks') style.balconyDepth = 1.5;
  }
  const referenceFamily = buildingFamily(req.options?.architecture);
  if (isPaired(req.options?.architecture ?? '') || referenceFamily) {
    style.groundFloorHeight = referenceFamily?.groundFloorHeight ?? GENERATION_POLICY.defaultFloorHeight;
    style.floorHeight = GENERATION_POLICY.defaultFloorHeight;
  }
  if (referenceFamily?.parapetHeight !== undefined) style.parapetHeight = referenceFamily.parapetHeight;
  if (req.options?.architecture === 'garden-taper') style.parapetHeight = 0.3;
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
    request: req, theme: req.theme, tier, style, floors: facades.floors, carved: facades.carved, detail: FULL_DETAIL,
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
    ? buildOpeningMesh({ request: req, theme: req.theme, tier, style, floors: facades.floors, carved: facades.carved, detail: FULL_DETAIL })
    : measuredOpenings;
  const roof = buildRoof(req, family, style, facades.floors, coreStair);

  const layout: Layout = {
    ...(coreFrame ? { coreFrame } : {}),
    ...(massing.assembly ? { assembly: massing.assembly } : {}),
    request: req, family, tier, theme: req.theme, style, relief, detail: FULL_DETAIL,
    floors: facades.floors, balconyBands, carved: facades.carved, anchors,
    facadeServices, roof,
    ...features,
  };
  checkInvariants(layout, obstacles);

  // Build at full detail, measure, and shed one step of detail at a time until
  // the shell fits its budget. Openings, frames and glazing are rebuilt with the
  // shell every pass, so the blueprint always describes what was exported.
  const perimeter = massing.groundOutline.reduce((sum, point, index, ring) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
  }, 0);
  const budget = geometryBudget(req, perimeter * stack.top);
  let mb = buildMesh(layout, openingMesh);
  let step = 0;
  const shed = () => { layout.detail = simplifiedTo(++step); mb = buildMesh(layout); };
  // Faces are free to count, so the descent runs on them first and only welds
  // once the face count fits, then keeps going if the packed size still does not.
  while (simplify && step < SIMPLIFICATION.length && countTriangles(mb) > budget.triangles) shed();
  let measured = { ...measureRuntime(mb), budget };
  while (simplify && step < SIMPLIFICATION.length && overBudget(measured)) {
    shed();
    measured = { ...measureRuntime(mb), budget };
  }
  const identity = canonicalNative ? new CanonicalNativeMaterials(req) : undefined;
  identity?.apply(mb);
  const blueprint = buildBlueprint(layout, mb);
  identity?.blueprint(blueprint);
  fitBuildingCore(blueprint);
  // The blueprint publishes the face count, which both GLB modes share; the
  // packed size belongs to the export the caller asked for.
  blueprint.geometry = { triangles: measured.triangles, budget, ...(layout.detail.size ? { simplified: [...layout.detail] } : {}) };
  if (overBudget(measured)) {
    throw new ExteriorError('E_GEOMETRY_BUDGET',
      `shell geometry is over budget at the simplest detail: ${measured.triangles} triangles and ${measured.bytes} bytes against ${budget.triangles} and ${budget.bytes}`,
      measured);
  }
  const { glb, textures } = await writeGlb(layout, mb, options.textures ?? {});
  return { glb, blueprint, textures };
}

async function generateAutomatic(request: BuildingRequest, options: GenerateOptions): Promise<GenerateResult> {
  const choices = architectureSelections(request);
  let candidateError: { code: string; message: string } | undefined;
  for (const selection of choices.filter(choice => choice.selected !== 'ordinary')) {
    try {
      const candidate: BuildingRequest = { ...request, options: { ...request.options, architecture: selection.selected as Exclude<typeof selection.selected, 'ordinary'>, balconies: 'off', facadeServices: 'off' } };
      const result = await generateBuilding(candidate, options, true);
      result.blueprint.architectureSelection = selection;
      return result;
    } catch (error) {
      if (!(error instanceof ExteriorError) || !['E_SCHEMA', 'E_CORE_PLATE', 'E_DOOR_FIT', 'E_SIGNAGE_TEXT_TOO_LONG', 'E_ENVELOPE_TOO_LOW', 'E_APERTURE_UNREACHABLE', 'E_APERTURE_INVALID'].includes(error.code)) throw error;
      candidateError = { code: error.code, message: error.message };
    }
  }
  const ordinary: BuildingRequest = { ...request, options: { ...request.options } };
  delete ordinary.options!.architecture;
  const result = await generateBuilding(ordinary, options);
  result.blueprint.architectureSelection = candidateError
    ? { requested: 'auto', selected: 'ordinary', reason: 'section-fit', candidateError }
    : choices.at(-1)!;
  return result;
}
