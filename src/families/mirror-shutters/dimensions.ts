export const DIMENSIONS = {
  room: 5,
  service: 3,
  corner: 0.5,
  minimumWidth: 24,
  minimumDepth: 14,
  frontageReserve: 2.5,
  groupFloors: 4,
  slab: 0.5,
  mullionPitch: 0.625,
} as const;

export function entryRibOffsets(length: number): number[] {
  const count = Math.max(2, Math.floor((length - 1) / 5));
  return Array.from({ length: count + 1 }, (_, i) => 0.6 + (length - 1.2) * i / count);
}
