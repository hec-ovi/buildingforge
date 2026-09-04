// Blueprint JSON from the layout; shapes mirror schemas/blueprint.schema.json.

import type { Blueprint } from '../types.ts';
import type { Layout } from '../layout/model.ts';
import { measureWallDepth } from '../mesh/wallDepth.ts';
import { SLAB_BAND } from '../rules/tables.ts';
import { buildFacadeGrids } from '../layout/facadeGrid.ts';
import { facadeMaterialPlan, buildingMaterialVariants } from '../layout/materialPlan.ts';
import { preferredVariantForKey } from '../materials/apply.ts';
import type { MeshBuilder } from '../mesh/primitives.ts';

export function buildBlueprint(layout: Layout, mb: MeshBuilder): Blueprint {
  const topFloor = layout.floors[layout.floors.length - 1]!;
  const materials = mb.materialKeys();
  const selected = buildingMaterialVariants(layout.theme, layout.tier, layout.request.options!.exteriorStyle!);
  const materialVariants = Object.fromEntries(materials
    .map((key) => [key, selected[key] ?? preferredVariantForKey(key)] as const)
    .filter((entry): entry is [string, string] => entry[1] !== undefined));
  return {
    buildingId: layout.request.buildingId,
    seed: layout.request.seed,
    bounds: {
      footprint: layout.floors.find((f) => f.index === 0)!.outline,
      height: topFloor.elevation + topFloor.height + layout.roof.parapetHeight,
    },
    floors: layout.floors.map((f) => ({
      index: f.index,
      kind: f.kind,
      elevation: f.elevation,
      height: f.height,
      outline: f.outline,
      openings: f.openings,
    })),
    balconyBands: layout.balconyBands,
    anchors: layout.anchors.map(({ id, position, normal }) => ({ id, position, normal })),
    signage: layout.signage,
    screens: layout.screens,
    lights: layout.lights,
    facade: {
      exteriorStyle: layout.request.options!.exteriorStyle!,
      style: layout.style.facade.kind,
      panelModule: layout.style.facade.panelModule,
      panelPattern: {
        width: layout.style.facade.panelWidth,
        height: layout.style.facade.panelHeight,
        jointWidth: layout.style.facade.panelJointWidth,
        origin: layout.style.facade.panelOrigin,
        boundary: layout.style.facade.panelBoundary,
      },
      materialPlan: facadeMaterialPlan(layout.theme, layout.tier, layout.request.options!.exteriorStyle!),
      wallDepth: measureWallDepth(layout, mb),
      slabBand: {
        below: slabBandBelow(layout),
        above: 0,
      },
      grids: buildFacadeGrids(layout.floors, layout.style.facade.panelWidth, layout.style.facade.panelHeight),
    },
    facadeArtifacts: layout.facadeArtifacts,
    facadeServices: layout.facadeServices,
    fireEscape: layout.fireEscape,
    roof: layout.roof,
    materials,
    materialVariants,
  };
}

/**
 * The guaranteed opaque depth below a floor line. Curtain walls publish the
 * smallest head spandrel across their bays; punched windows keep the fixed
 * half-metre head clearance.
 */
function slabBandBelow(layout: Layout): number {
  if (layout.style.facade.kind !== 'curtain-wall') return SLAB_BAND.below;
  let band = Infinity;
  for (const floor of layout.floors) {
    for (const opening of floor.openings) {
      if (opening.kind === 'window') band = Math.min(band,
        opening.head ?? Math.max(0, floor.height - opening.sill - opening.height));
    }
  }
  return Number.isFinite(band) ? band : SLAB_BAND.below;
}
