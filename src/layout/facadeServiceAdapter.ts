// Adapter from the exterior's accepted facade layout to the isolated
// facade-services input contract. No service placement arithmetic lives here.

import {
  DEFAULT_FACADE_SERVICE_LIMITS, generateFacadeServices,
  type ArtifactInput, type FacadeServicesInput, type FacadeServicesOutput,
  type FaceInput, type ReservationInput, type WindowInput,
} from '../facade-services/index.ts';
import { edgeDir, edgeLength, edgeNormal } from '../core/polygon.ts';
import { buildFacadeGrids } from './facadeGrid.ts';
import { edgeU } from './obstructions.ts';
import type { AnchorMount } from './anchors.ts';
import type { Family, Tier } from '../rules/families.ts';
import { FACADE } from '../rules/tables.ts';
import type { BuildingRequest, Blueprint } from '../types.ts';
import type { FloorLayout, Style } from './model.ts';
import type { Relief } from './relief.ts';

interface AdapterInput {
  request: BuildingRequest;
  family: Family;
  tier: Tier;
  style: Style;
  floors: FloorLayout[];
  relief: Relief;
  anchors: AnchorMount[];
  balconyBands: Blueprint['balconyBands'];
  facadeArtifacts: Blueprint['facadeArtifacts'];
  signage: Blueprint['signage'];
  screens: Blueprint['screens'];
  lights: Blueprint['lights'];
  fireEscape: Blueprint['fireEscape'];
}

export function buildFacadeServiceDetails(input: AdapterInput): FacadeServicesOutput {
  const { request, floors, style } = input;
  const above = floors.filter((floor) => floor.index >= 0);
  const grids = buildFacadeGrids(above, style.facade.panelWidth, style.facade.panelHeight);
  const faces: FaceInput[] = [];
  for (const floor of above) {
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const [x, z] = floor.outline[edge]!;
      const tangent = edgeDir(floor.outline, edge);
      const normal = edgeNormal(floor.outline, edge);
      const grid = grids.find((candidate) => candidate.floor === floor.index && candidate.edge === edge)!;
      faces.push({
        floor: floor.index,
        edge,
        origin: [x, floor.elevation, z],
        tangent: [tangent[0], 0, tangent[1]],
        normal: [normal[0], 0, normal[1]],
        length: edgeLength(floor.outline, edge),
        height: floor.height,
        panelU: grid.horizontal,
        panelV: grid.vertical,
      });
    }
  }

  const reservations: ReservationInput[] = [];
  const windows: WindowInput[] = [];
  for (const floor of above) {
    for (const opening of floor.openings) {
      const face = { floor: floor.index, edge: opening.edge };
      const access = opening.kind === 'door' || opening.kind === 'balconyDoor' || opening.kind === 'openFront';
      reservations.push({
        id: `opening:${opening.id}`,
        face,
        kind: access ? 'access' : 'opening',
        rect: [opening.offset, opening.sill, opening.offset + opening.width,
          opening.sill + opening.height
            + (opening.transom ? FACADE.curtainWall.transomGap + opening.transom : 0)],
        depth: access ? opening.door?.motion.clearDepth ?? opening.portal?.clearDepth ?? 0 : 0.1,
      });
      if (opening.kind === 'window') {
        windows.push({
          openingId: opening.id,
          face,
          rect: [opening.offset, opening.sill, opening.offset + opening.width, opening.sill + opening.height],
          panes: opening.panes ?? { cols: 1, rows: 1 },
        });
      }
    }
  }
  addReliefReservations(input, above, reservations);
  addPublishedClearances(input, above, reservations);

  const artifacts: ArtifactInput[] = input.facadeArtifacts.map((artifact) => ({
    id: artifact.id,
    face: { floor: artifact.floor, edge: artifact.edge },
    kind: artifact.kind,
    rect: [artifact.offset, artifact.sill, artifact.offset + artifact.size[0],
      artifact.sill + artifact.size[1]],
    depth: artifact.size[2],
    standoff: artifact.standoff ?? 0,
  }));
  const modes = resolveModes(request, input.family, input.tier, style);
  const density = request.options?.facadeServices === 'on' || request.options?.hangingClothes === 'on'
    ? 1 : input.tier === 'poor' ? 0.8 : input.tier === 'mid' ? 0.65 : 0.25;
  const serviceInput: FacadeServicesInput = {
    seed: request.seed,
    profile: input.family === 'residential' ? 'residential'
      : input.family === 'industrial' ? 'industrial' : 'generic',
    density,
    modes,
    parcel: request.parcel.footprint,
    materials: {
      metal: `${request.theme}/metal/${input.tier}`,
      fabric: `${request.theme}/fabric/${input.tier}`,
      glass: `${request.theme}/window-glass/${input.tier}`,
    },
    faces,
    reservations,
    artifacts,
    windows,
    limits: { ...DEFAULT_FACADE_SERVICE_LIMITS },
  };
  const output = generateFacadeServices(serviceInput);
  const damage = new Map(output.damagedWindows.map((item) => [item.openingId, item]));
  for (const floor of above) {
    for (const opening of floor.openings) {
      const selected = damage.get(opening.id);
      if (!selected) continue;
      opening.damage = {
        pane: selected.pane,
        variant: selected.variant,
        collision: selected.collision,
      };
    }
  }
  return output;
}

function resolveModes(
  request: BuildingRequest, family: Family, tier: Tier, style: Style,
): FacadeServicesInput['modes'] {
  const serviceMode = request.options?.facadeServices ?? 'auto';
  const clothesMode = request.options?.hangingClothes ?? 'auto';
  const serviceEligible = (style.facade.kind === 'megablock' || style.facade.kind === 'panel')
    && ['residential', 'industrial', 'commerce'].includes(family);
  const clothesEligible = family === 'residential' && (tier === 'poor' || tier === 'mid');
  return {
    services: serviceMode === 'on' || (serviceMode === 'auto' && serviceEligible) ? 'on' : 'off',
    clothes: clothesMode === 'on' || (clothesMode === 'auto' && clothesEligible) ? 'on' : 'off',
    windowDamage: request.options?.windowDamage ?? 'off',
  };
}

function addReliefReservations(
  input: AdapterInput, floors: FloorLayout[], reservations: ReservationInput[],
): void {
  for (const floor of floors) {
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const face = input.relief.byEdge[edge];
      if (face) {
        for (const u of face.ribs) reservations.push({
          id: `relief:rib:${floor.index}:${edge}:${u}`,
          face: { floor: floor.index, edge }, kind: 'relief',
          rect: [u - input.relief.ribWidth / 2, 0, u + input.relief.ribWidth / 2, floor.height],
          depth: input.relief.ribDepth,
        });
        for (const u of face.columns) reservations.push({
          id: `relief:column:${floor.index}:${edge}:${u}`,
          face: { floor: floor.index, edge }, kind: 'relief',
          rect: [u - input.relief.columnWidth / 2, 0, u + input.relief.columnWidth / 2, floor.height],
          depth: input.relief.columnDepth,
        });
      }
      for (const [y0, y1] of input.relief.bands) {
        const v0 = Math.max(0, y0 - floor.elevation);
        const v1 = Math.min(floor.height, y1 - floor.elevation);
        if (v1 <= v0) continue;
        reservations.push({
          id: `relief:band:${floor.index}:${edge}:${y0}`,
          face: { floor: floor.index, edge }, kind: 'relief',
          rect: [0, v0, edgeLength(floor.outline, edge), v1], depth: input.relief.bandDepth,
        });
      }
    }
  }
}

function addPublishedClearances(
  input: AdapterInput, floors: FloorLayout[], reservations: ReservationInput[],
): void {
  for (const band of input.balconyBands) {
    const floor = floors.find((candidate) => candidate.index === band.floor);
    if (!floor) continue;
    reservations.push({
      id: `access:balcony:${band.id}`, face: { floor: band.floor, edge: band.edge }, kind: 'access',
      rect: [band.offset, 0, band.offset + band.width, Math.min(floor.height, band.railHeight + 1)],
      depth: band.depth,
    });
  }
  if (input.fireEscape) {
    for (let index = input.fireEscape.fromFloor; index <= input.fireEscape.toFloor; index++) {
      const floor = floors.find((candidate) => candidate.index === index);
      if (!floor) continue;
      reservations.push({
        id: `access:fire-escape:${index}`,
        face: { floor: index, edge: input.fireEscape.edge }, kind: 'access',
        rect: [input.fireEscape.offset, 0, input.fireEscape.offset + input.fireEscape.width, floor.height],
        depth: 1,
      });
    }
  }
  for (const anchor of input.anchors) {
    for (const floor of floors) {
      if (anchor.edge >= floor.outline.length || anchor.position[1] < floor.elevation
        || anchor.position[1] > floor.elevation + floor.height) continue;
      const u = edgeU(floor.outline, anchor.edge, anchor.position[0], anchor.position[2]);
      reservations.push({
        id: `fixture:anchor:${anchor.id}`, face: { floor: floor.index, edge: anchor.edge }, kind: 'fixture',
        rect: [u - anchor.size / 2, anchor.position[1] - floor.elevation - anchor.size / 2,
          u + anchor.size / 2, anchor.position[1] - floor.elevation + anchor.size / 2],
        depth: anchor.standoff + 0.09,
      });
    }
  }
  for (const item of [...input.signage, ...input.screens]) {
    const itemDepth = 'depth' in item && typeof item.depth === 'number' ? item.depth : 0.12;
    reserveWorldRect(floors, reservations, `fixture:overlay:${item.edge}:${item.center.join(':')}`,
      item.edge, item.center, item.width, item.height, item.standoff + itemDepth);
  }
  for (const light of input.lights) {
    reserveWorldRect(floors, reservations, `fixture:light:${light.edge}:${light.position.join(':')}`,
      light.edge, light.position, light.size[0], light.size[1], light.standoff + light.size[2]);
  }
}

function reserveWorldRect(
  floors: FloorLayout[], reservations: ReservationInput[], id: string, edge: number,
  center: [number, number, number], width: number, height: number, depth: number,
): void {
  for (const floor of floors) {
    const y0 = center[1] - height / 2, y1 = center[1] + height / 2;
    if (edge >= floor.outline.length || y1 <= floor.elevation || y0 >= floor.elevation + floor.height) continue;
    const u = edgeU(floor.outline, edge, center[0], center[2]);
    reservations.push({
      id, face: { floor: floor.index, edge }, kind: 'fixture',
      rect: [u - width / 2, Math.max(0, y0 - floor.elevation),
        u + width / 2, Math.min(floor.height, y1 - floor.elevation)],
      depth,
    });
  }
}
