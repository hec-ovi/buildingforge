import type { Architecture, CornerTechnique, SectionTechnique } from './types.ts';

export const CONSTRUCTION_GRID = 0.5;
export const CORNER_EXTENT = 3;
export const BAY_WIDTH = 4;
export const ARCHITECTURES: Architecture[] = ['rounded-corner', 'chamfered-corners', 'terrace-blocks', 'paired-rounded', 'paired-rectangular'];
export const COMPOSITIONS: Record<Architecture, { corners: CornerTechnique[]; bay: SectionTechnique }> = {
  'rounded-corner': { corners: ['square', 'square', 'rounded', 'square'], bay: 'deep-bay' },
  'chamfered-corners': { corners: ['square', 'chamfered', 'chamfered', 'square'], bay: 'ribbon-bay' },
  'terrace-blocks': { corners: ['square', 'square', 'square', 'square'], bay: 'deep-bay' },
  'paired-rounded': { corners: ['square', 'square', 'rounded', 'square'], bay: 'paired-glass' },
  'paired-rectangular': { corners: ['square', 'square', 'square', 'square'], bay: 'paired-glass' },
};

export const BORDERS: Record<SectionTechnique, { side: number; bottom: number; top: number; depth: number }> = {
  'deep-bay': { side: 0.5, bottom: 0.5, top: 0.5, depth: 0.25 },
  'ribbon-bay': { side: 0.06, bottom: 0.5, top: 0.5, depth: 0.35 },
  'corner-leg': { side: 0.5, bottom: 0.5, top: 0.5, depth: 0.25 },
  'rounded-glass': { side: 0.08, bottom: 0.5, top: 0.5, depth: 0.12 },
  'chamfered-glass': { side: 0.2, bottom: 0.5, top: 0.5, depth: 0.35 },
  'frame-pier': { side: 0.5, bottom: 0.5, top: 0.5, depth: 0.85 },
  'paired-glass': { side: 0.04, bottom: 0.22, top: 0.28, depth: 0.12 },
  'paired-solid': { side: 0.03, bottom: 0.22, top: 0.28, depth: 0.12 },
  'paired-pier': { side: 0.03, bottom: 0.22, top: 0.28, depth: 0.12 },
};
