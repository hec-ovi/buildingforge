// Browser-safe view of the Interior core-feasibility contract. Static JSON
// import keeps Node filesystem APIs out of the preview bundle.

import feasibility from '../../../interior/schemas/core-feasibility.json' with { type: 'json' };

export interface CoreConstants {
  snap: number;
  corridorWidth: number;
  elevatorShaft: number;
  riserShaft: number;
  serviceStub: number;
  margin: number;
  minStripDepth: number;
  singleLoadedBelowDepth: number;
  vFaceScanRange: number;
  frameSweepStepDeg: number;
  stairColumnWidth: number;
  walkupMaxFloors: number;
  stairRiserMin: number;
  stairRiserIdeal: number;
  stairRiserMax: number;
  stairTread: number;
  maxRisersPerFlight: number;
  stairLanding: number;
  wallThickness: number;
  twoStairsAreaOver: number;
  twoStairsFloorsOver: number;
  facadeDepth: Record<string, number>;
}

const raw = feasibility.constants;

export const CORE_CONSTANTS: CoreConstants = {
  snap: raw.snap,
  corridorWidth: raw.corridorWidth,
  elevatorShaft: raw.elevatorShaft,
  riserShaft: raw.riserShaft,
  serviceStub: raw.serviceStub,
  margin: raw.margin,
  minStripDepth: raw.minStripDepth,
  singleLoadedBelowDepth: raw.singleLoadedBelowDepth,
  vFaceScanRange: raw.vFaceScanRange,
  frameSweepStepDeg: raw.frameSweepStepDeg,
  stairColumnWidth: raw.stairColumnWidth,
  walkupMaxFloors: raw.walkupMaxFloors,
  stairRiserMin: raw.stairRiserMin,
  stairRiserIdeal: raw.stairRiserIdeal,
  stairRiserMax: raw.stairRiserMax,
  stairTread: raw.stairTread,
  maxRisersPerFlight: raw.maxRisersPerFlight,
  stairLanding: raw.stairLanding,
  wallThickness: raw.wallThickness,
  twoStairsAreaOver: raw.twoStairsAreaOver,
  twoStairsFloorsOver: raw.twoStairsFloorsOver,
  facadeDepth: raw.facadeDepth,
};

const scalars = Object.entries(CORE_CONSTANTS)
  .filter(([key]) => key !== 'facadeDepth')
  .map(([, value]) => value);
if (!scalars.every((value) => Number.isFinite(value) && (value as number) > 0)
  || !Object.values(CORE_CONSTANTS.facadeDepth).every((value) => Number.isFinite(value) && value > 0)) {
  throw new Error('Interior core-feasibility constants must be positive finite numbers');
}
