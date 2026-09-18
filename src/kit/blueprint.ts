import { RoomEnvelopes } from '../blueprint/roomEnvelope.ts';
import { ExteriorError } from '../core/errors.ts';
import { edgeNormal } from '../core/polygon.ts';
import { DEFAULT_FACADE_SERVICE_LIMITS } from '../facade-services/index.ts';
import { buildFacadeGrids } from '../layout/facadeGrid.ts';
import { floorKinds } from '../layout/floorStack.ts';
import { splitMaterialSlot } from '../materials/slot.ts';
import { preferredVariantForKey } from '../materials/variant.ts';
import { FAMILY } from '../rules/families.ts';
import type { Blueprint, BuildingRequest, Floor, Opening, P2 } from '../types.ts';
import type { BuiltPiece } from './piece.ts';
import type { KitRecipe } from './recipe.ts';
import { assemblyEdges } from './request.ts';
import { world } from './transform.ts';
import type { AssemblyPlan, AssemblyRequest } from './types.ts';
import release from '../../package.json' with { type: 'json' };

type PlacementTable = Omit<AssemblyPlan, 'blueprint'>;

/** Project authored opening records onto the same face coordinates as generated shells. */
function floorsFor(request: BuildingRequest, plan: PlacementTable, pieces: Map<string, BuiltPiece>): Floor[] {
  const outline = request.parcel.footprint;
  const edges = assemblyEdges(outline);
  const kinds = floorKinds(request, FAMILY[request.building.type], request.building.tier, plan.bands.length);
  const floors: Floor[] = plan.bands.map(band => ({
    index: band.floor, kind: kinds[band.floor]!, elevation: band.base, height: band.height,
    outline: outline.map(p => [...p]), openings: [],
  }));
  for (const [index, placement] of plan.placements.entries()) {
    for (const local of pieces.get(placement.piece)!.manifest.openings) {
      const { position, facing } = world(local, placement);
      const edge = edges.findIndex((_, i) => {
        const n = edgeNormal(outline, i);
        return n[0] * facing[0] + n[1] * facing[2] > 1 - 1e-8;
      });
      if (edge < 0) throw new ExteriorError('E_INVARIANT', 'piece opening has no matching parcel face');
      const face = edges[edge]!;
      const offset = Math.max(0, (position[0] - face.origin[0]) * face.dir[0]
        + (position[2] - face.origin[1]) * face.dir[1] - local.width / 2);
      const sill = position[1] - placement.position[1];
      const { position: _position, facing: _facing, ...record } = local;
      const opening: Opening = {
        ...record, id: local.kind === 'door' ? local.id : `place:${index}/${local.id}`, edge, offset, sill,
        ...(local.glazing ? { glazing: { ...local.glazing, offset, sill } } : {}),
      };
      floors[placement.floor]!.openings.push(opening);
    }
  }
  return floors;
}

export function assemblyBlueprint(
  request: BuildingRequest, raw: AssemblyRequest, recipe: KitRecipe, plan: PlacementTable, pieces: Map<string, BuiltPiece>,
): Blueprint {
  const floors = floorsFor(request, plan, pieces);
  const outline = request.parcel.footprint;
  const top = plan.bands.at(-1)!;
  const elevation = top.base + top.height;
  const wallDepth = floors.reduce((depth, floor) => floor.openings.reduce((deepest, opening) => Math.max(deepest,
    opening.glazing?.housingBackDepth ?? (opening.door ? opening.door.recessDepth + opening.door.frameDepth : 0)), depth), recipe.backing);
  const envelopes = new RoomEnvelopes(request);
  for (const floor of floors) floor.roomEnvelope = envelopes.forFloor(floor, wallDepth);
  const slots = [...pieces.values()].flatMap(piece => piece.manifest.materials);
  slots.push(recipe.materials['inner-wall'] ?? recipe.materials.wall!, recipe.materials.roof ?? recipe.materials.wall!);
  if (raw.anchors?.length) slots.push(recipe.materials.column ?? recipe.materials.wall!);
  const materials = [...new Set(slots.map(slot => splitMaterialSlot(slot)[0]))].sort();
  const materialVariants: Record<string, string> = {};
  for (const slot of slots) {
    const [key, explicit] = splitMaterialSlot(slot);
    const variant = explicit ?? preferredVariantForKey(key);
    if (variant) materialVariants[key] = variant;
  }
  const binding = (slot: string) => {
    const [key, variant] = splitMaterialSlot(slot);
    const variantId = variant ?? materialVariants[key];
    if (!variantId) throw new ExteriorError('E_MATERIAL_UNRESOLVED', `kit surface ${key} needs a named variant`);
    return { key, variantId };
  };
  const signage: Blueprint['signage'] = [], screens: Blueprint['screens'] = [];
  const edges = assemblyEdges(outline);
  for (const sign of plan.signAnchors) {
    const edge = plan.placements[sign.placement]!.face;
    const normal: P2 = [sign.facing[0], sign.facing[2]];
    const origin = edges[edge]!.origin;
    const field = { edge, center: sign.position, width: sign.size[0], height: sign.size[1], normal,
      standoff: Math.max(0, (sign.position[0] - origin[0]) * normal[0] + (sign.position[2] - origin[1]) * normal[1]) };
    if (sign.kind === 'screen') screens.push(field);
    else signage.push({ ...field, mode: sign.kind });
  }
  const anchors: Blueprint['anchors'] = (raw.anchors ?? []).map(anchor => {
    const edge = edges[anchor.edge];
    if (!edge || !Number.isInteger(anchor.edge) || !Number.isFinite(anchor.u) || !Number.isFinite(anchor.y)
      || anchor.u < 0 || anchor.u > edge.length || anchor.y < 0 || anchor.y > elevation) {
      throw new ExteriorError('E_SCHEMA', `anchor ${anchor.id} must lie on a building edge`);
    }
    return { id: anchor.id, position: [edge.origin[0] + edge.dir[0] * anchor.u, anchor.y,
      edge.origin[1] + edge.dir[1] * anchor.u], normal: edgeNormal(outline, anchor.edge) };
  });
  const slabBand = { below: Infinity, above: Infinity };
  for (const floor of floors) for (const opening of floor.openings) if (opening.kind === 'window') {
    slabBand.below = Math.min(slabBand.below, floor.height - opening.sill - opening.height);
    slabBand.above = Math.min(slabBand.above, opening.sill);
  }
  return {
    version: release.version, buildingId: request.buildingId, seed: request.seed,
    bounds: { footprint: outline, height: elevation }, floors,
    balconyBands: [], anchors, signage, screens, lights: [],
    facade: {
      surfacePattern: { kind: 'continuous' }, groundMaterial: binding(recipe.materials.ground ?? recipe.materials.wall!),
      exteriorStyle: request.building.type === 'offices' || request.building.type === 'corpo' ? 'premium-office' : 'premium-mineral',
      style: 'glass', panelModule: 2,
      panelPattern: { width: 2, height: 1, jointWidth: 0, origin: 'face-floor', boundary: 'centered-solid-border' },
      materialPlan: { palette: 'neutral-dystopian', field: binding(recipe.materials.wall!),
        border: binding(recipe.materials.column ?? recipe.materials.wall!), trim: binding(recipe.materials['wall-trim']!) },
      wallDepth, slabBand,
      grids: buildFacadeGrids(floors, 2, 1),
    },
    facadeArtifacts: [], fireEscape: null,
    facadeServices: { version: 1, units: [], networks: [], clotheslines: [], damagedWindows: [],
      stats: { networks: 0, segments: 0, supports: 0, units: 0, clotheslines: 0, clothItems: 0,
        damagedWindows: 0, triangles: 0, materialKeys: 0, drawCalls: 0 }, limits: { ...DEFAULT_FACADE_SERVICE_LIMITS } },
    roof: { elevation, outline, parapetHeight: 0, bulkhead: null, artifacts: [],
      material: binding(recipe.materials.roof ?? recipe.materials.wall!) },
    materials, materialVariants,
  };
}
