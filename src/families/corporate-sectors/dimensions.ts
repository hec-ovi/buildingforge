export const BODY_MARGIN = 3.5;
export const CANOPY_DEPTH = 3.25;
export const RIM_DEPTH = 2;
export const END = 0.5;
export const WINDOW_CELL = 2;
export const PANEL_WING = 4;
export const CASSETTE_UNIT = 6;
export const CASSETTE = CASSETTE_UNIT * 3;
export const CHANNEL_BORDER = 0.75;
export const CHANNEL_SPACER = 1.5;
export const CHANNEL_RECESS = 1;
export const SHIELD_PANEL_WIDTH = 3;
export const SHIELD_PANEL_HEIGHT = 3;
export const FIXED_FRONT = 2 * END + PANEL_WING + CASSETTE + 2 * CHANNEL_BORDER + CHANNEL_SPACER;

export function fittedLength(available: number): number {
  return FIXED_FRONT + WINDOW_CELL * Math.floor((available - FIXED_FRONT + 1e-8) / WINDOW_CELL);
}

export function cassetteProfile(floorHeight: number) {
  const top = floorHeight - 0.55;
  return { bottom: top - 2.4, top, slotBottom: top - 1.45, slotHeight: 1.2, front: 1.25, back: 0.03 };
}
