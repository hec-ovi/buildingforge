/** Metres. Shutters are permanently closed facade panels, never entrances. */
export const dimensions = {
  minimumSide: 16,
  minimumFloorHeight: 3,
  inset: 0.5,
  projection: 0.12,
  pier: 0.6,
  entrance: 3.4,
  targetShutter: 4.6,
  windowSide: 0.22,
  windowSill: 0.95,
  windowHead: 0.55,
  shutterSill: 0.12,
  shutterHead: 0.75,
  shutterMaximumHeight: 3.7,
  shutterPitch: 0.23,
  openingMargin: 0.06,
  approachMargin: 0.2,
} as const;
