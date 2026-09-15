import { Rng } from '../core/rng.ts';

export function scenicState(seed: string, floor: number, section: string, curved = false): {
  state: 'lit' | 'dim' | 'dark'; lights: 'strips' | 'spots'; warm: boolean;
} {
  const rng = new Rng(seed, `paired-window:${floor}:${curved ? 'curve' : section}`);
  return { state: rng.chance(0.22) ? 'dark' : rng.chance(0.22) ? 'dim' : 'lit',
    lights: rng.chance(0.55) ? 'strips' : 'spots', warm: rng.chance(0.18) };
}
