export { generate } from './generator.ts';
export { ExteriorError, type ErrorCode } from './core/errors.ts';
export { PROPORTIONS } from './rules/proportions.ts';
export type { TextureMode, TextureOptions } from './materials/apply.ts';
export type { MaterialSource, ThemeIndex } from './materials/theme.ts';
export type {
  ArchitectureSelection, BuildingRequest, BuildingGrid, Blueprint, GenerateOptions, GenerateResult, Aperture, Floor, Opening, FacadeArtifact,
  ExternalAttachment, MastAssembly, RoofArtifact,
  CoreAdjacency, CoreAdjacencyRule,
  DoorAssembly, DoorEnvelope, PocketMotion, RoomEnvelope,
} from './types.ts';
export type { FacadeServicesOutput } from './facade-services/index.ts';
export {
  KIT, BANDS, PIECES, KIT_FAMILIES, baysAcross, bandStack, buildPiece, buildPieceMesh, pieceId, pieceSet,
  assembleFromPieces, planAssembly,
} from './kit/index.ts';
export type {
  Band, PieceKind, PieceRequest, PieceResult, PieceManifest, SignAnchor, DoorRecord,
  AssemblyRequest, AssemblyResult, Placement,
} from './kit/index.ts';
