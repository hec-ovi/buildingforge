export const BODY_MARGIN = 3.5;
export const CANOPY_DEPTH = 3.25;
export const RIM_DEPTH = 2;
export const END = 0.5;
export const WINDOW_CELL = 2;
export const PANEL_WING = 4;
export const CASSETTE = 9;
export const CHANNEL_BORDER = 0.5;
export const FIXED_FRONT = 2 * END + PANEL_WING + CASSETTE + 2 * CHANNEL_BORDER;

export function fittedLength(available: number): number {
  return FIXED_FRONT + WINDOW_CELL * Math.floor((available - FIXED_FRONT + 1e-8) / WINDOW_CELL);
}
