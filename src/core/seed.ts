// Seeds for standalone runs. Generation itself never calls this: the seed is an
// input, so a run with no seed gets one rolled at the edge and printed, and the
// same seed reproduces the building exactly.

/** 12 hex characters: short enough to retype, wide enough not to collide. */
export function randomSeed(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
