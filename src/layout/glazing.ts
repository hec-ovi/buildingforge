// Pane grid for a glazed opening: a sheet wider or taller than the tier's
// structural pane limit is split by mullions until every pane fits.

import type { Style } from './model.ts';

export interface PaneGrid { cols: number; rows: number }

export function paneGrid(width: number, height: number, glazing: Style['glazing']): PaneGrid {
  const fw = Math.min(glazing.frameWidth, width / 4, height / 4);
  const glassW = Math.max(0.05, width - 2 * fw);
  const glassH = Math.max(0.05, height - 2 * fw);
  return {
    cols: Math.max(1, Math.ceil(glassW / glazing.maxPaneWidth - 1e-9)),
    rows: Math.max(1, Math.ceil(glassH / glazing.maxPaneHeight - 1e-9)),
  };
}
