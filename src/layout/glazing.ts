// Pane grid for a glazed opening: a sheet wider or taller than the tier's
// structural pane limit is split by mullions until every pane fits.

import { MODULE, MODULE_U } from '../rules/tables.ts';
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
 * Panes on the module: as many whole-metre columns as the opening holds and
 * whole half-metre rows, the largest the tier's pane limits allow, so every
 * mullion stands on a grid line the interior can build a wall against.
 */
export function modulePanes(width: number, height: number, glazing: Style['glazing']): PaneGrid {
  // the widest grid pane the tier's limit allows: a metre, else half a metre
  const paneW = glazing.maxPaneWidth + 1e-9 >= MODULE_U ? MODULE_U : MODULE;
  const paneH = Math.max(MODULE, Math.floor(glazing.maxPaneHeight / MODULE + 1e-9) * MODULE);
  // never a pane past the limit: counts round up, so a 2 m sheet under a 1.5 m limit takes two rows
  return {
    cols: Math.max(1, Math.ceil(width / paneW - 1e-6)),
    rows: Math.max(1, Math.ceil(height / paneH - 1e-6)),
  };
}
