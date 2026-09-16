import type { FamilyArchitecture } from '../families/registry.ts';
export type Point = [number, number];
export type Architecture = 'rounded-corner' | 'chamfered-corners' | 'terrace-blocks' | 'paired-rounded' | 'paired-rectangular' | 'garden-taper' | FamilyArchitecture;
export type CornerTechnique = 'square' | 'rounded' | 'chamfered';
export type SectionTechnique = 'deep-bay' | 'ribbon-bay' | 'corner-leg' | 'rounded-glass' | 'chamfered-glass' | 'frame-pier' | 'paired-glass' | 'paired-solid' | 'paired-pier' | 'garden-bay' | 'podium-panel';
export type Role = 'top-left' | 'top-middle' | 'top-right' | 'middle-left' | 'middle' | 'middle-right' | 'bottom-left' | 'bottom-middle' | 'bottom-right';
export interface AssemblyInput {
  architecture: Architecture;
  /** Four CCW corners of the available construction-grid rectangle. */
  rectangle: [Point, Point, Point, Point];
  floorHeights: number[];
  seed?: string;
  fixedFaces?: boolean;
}
export interface SectionSpan { edge: number; offset: number; width: number; sectionOffset: number }
export interface WindowField { offset: number; width: number; sill: number; height: number; panes?: { cols: number; rows: number } }
export interface Section {
  windows?: WindowField[];
  panes?: { cols: number; rows: number };
  spans?: SectionSpan[];
  id: string;
  technique: SectionTechnique;
  edge: number;
  offset: number;
  width: number;
  /** Fixed horizontal and vertical end dimensions; the middle is the opening. */
  border: { left?: number; right?: number; side: number; bottom: number; top: number; depth: number; surfaceDepth?: number; surfaceProfile?: { offset: number; depth: number }[] };
  corner?: number;
}
export interface RoleField { role: Role; offset: number; sill: number; width: number; height: number }
export interface FloorAssembly {
  floor: number;
  group: number;
  outline: Point[];
  topOutline?: Point[];
  sections: Section[];
  balconySections: string[];
}
export interface Assembly {
  architecture: Architecture;
  grid: 0.5;
  extent: { width: number; depth: number };
  corners: CornerTechnique[];
  groups: { id: number; fromFloor: number; toFloor: number; width: number; depth: number }[];
  floors: FloorAssembly[];
}
