// Pane grid for a glazed opening: a sheet wider or taller than the tier's
// structural pane limit is split by mullions until every pane fits.

import { MODULE } from '../rules/tables.ts';
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

/**
 * Panes on the module: the largest supported columns and
 * whole half-metre rows, sized within the selected pane limits. Opening reservations remain authoritative
 * for every interior partition.
 */
export function modulePanes(width: number, height: number, glazing: Style['glazing']): PaneGrid {
  // Largest half-metre pane permitted by the selected glazing profile.
  const paneW = Math.max(MODULE, Math.floor(glazing.maxPaneWidth / MODULE + 1e-9) * MODULE);
  const paneH = Math.max(MODULE, Math.floor(glazing.maxPaneHeight / MODULE + 1e-9) * MODULE);
  // never a pane past the limit: counts round up, so a 2 m sheet under a 1.5 m limit takes two rows
  return {
    cols: Math.max(1, Math.ceil(width / paneW - 1e-6)),
    rows: Math.max(1, Math.ceil(height / paneH - 1e-6)),
  };
}
