/** glTF map slots shared by catalog loading and material attachment. */
export const MAP_SLOTS = ['basecolor', 'normal', 'ao', 'emission', 'metallicRoughness'] as const;
export type MapSlot = typeof MAP_SLOTS[number];
