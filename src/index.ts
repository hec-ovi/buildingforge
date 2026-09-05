export { generate } from './generator.ts';
export { ExteriorError, type ErrorCode } from './core/errors.ts';
export { PROPORTIONS } from './rules/proportions.ts';
export type { TextureMode, TextureOptions } from './materials/apply.ts';
export type { MaterialSource, ThemeIndex } from './materials/theme.ts';
export type {
  BuildingRequest, BuildingGrid, Blueprint, GenerateOptions, GenerateResult, Aperture, Floor, Opening, FacadeArtifact,
  ExternalAttachment, MastAssembly, RoofArtifact,
  CoreAdjacency, CoreAdjacencyRule,
  DoorAssembly, DoorEnvelope, PocketMotion,
} from './types.ts';
export type { FacadeServicesOutput } from './facade-services/index.ts';
