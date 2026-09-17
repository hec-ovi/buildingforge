import type { Assembly, FloorAssembly, Section } from '../sections/types.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder } from '../mesh/primitives.ts';

export type { Point, Section, Assembly } from '../sections/types.ts';
export type { Layout, FloorLayout } from '../layout/model.ts';
export { MeshBuilder, PartSink } from '../mesh/primitives.ts';
export type { V3 } from '../mesh/primitives.ts';
export { FacadeField } from '../mesh/facadeField.ts';
export { Rng } from '../core/rng.ts';
export { tubeSegment } from '../mesh/tube.ts';
export { capUp, capDown, capFrame } from '../mesh/caps.ts';
export { cutWall, rectHole } from '../mesh/wallcut.ts';
export { meshPanelField } from '../mesh/panelField.ts';
export { ProfiledBlind } from '../mesh/profiledBlind.ts';
export type { BlindFrame } from '../mesh/profiledBlind.ts';

export type { WindowField } from '../sections/types.ts';
import type { WindowField } from '../sections/types.ts';
export interface FamilySection extends Section { windows?: WindowField[]; panes?: { cols: number; rows: number } }
export interface FamilyFloor extends Omit<FloorAssembly, 'sections'> { sections: FamilySection[] }
export interface FamilyPlan extends Omit<Assembly, 'architecture' | 'floors'> { floors: FamilyFloor[] }
export interface FamilyInput {
  rectangle: [[number, number], [number, number], [number, number], [number, number]];
  floorHeights: number[];
  seed: string;
  /** Keep the exact supplied rectangle when infrastructure fixes its faces. */
  fixedFaces?: boolean;
}
export interface DecorationContext {
  builder: MeshBuilder;
  layout: Layout;
  material: (role: string) => string;
}
export interface ModelInstance {
  kind: 'ornamental-tree' | 'palm' | 'shrub';
  position: [number, number, number];
  /** Metres: width, height, depth. Assets keep their native proportions inside this box. */
  size: [number, number, number];
  rotation?: number;
}
export interface FamilyDecoration { instances?: ModelInstance[] }
export interface BuildingFamily {
  id: string;
  /** Preferred total ground-storey height; fixed connection bases remain authoritative. */
  groundFloorHeight?: number;
  /** Extra roof-edge height; zero uses the authored flush roof cap. */
  parapetHeight?: number;
  /** Inward depth of the structural backing behind family-owned facade layers. */
  wallBackingDepth?: number;
  plan(input: FamilyInput): FamilyPlan;
  decorate?(context: DecorationContext): FamilyDecoration | void;
  /** Final catalog slots, including #variant when one is required. */
  materials?: Record<string, string>;
}
