import type { Style } from './model.ts';

/** Major facade members follow the structural bay scale, independently of texture seams. */
export function structuralProfile(style: Style): { width: number; depth: number } {
  const width = Math.round(Math.max(1.2, Math.min(2.4,
    style.columnWidth + style.columnSpacing * 0.2 + style.facade.ribWidth)) * 20) / 20;
  return { width, depth: Math.round(Math.max(0.2, Math.min(0.4, width * 0.12 + style.facade.ribDepth)) * 20) / 20 };
}
