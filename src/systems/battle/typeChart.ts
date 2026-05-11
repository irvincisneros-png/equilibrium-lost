import type { Affinity, TypeChart } from '../../content/types';

/** Returns the damage multiplier for an attacker affinity vs a defender affinity. Missing entries are neutral (1). */
export function effectiveness(chart: TypeChart, attacker: Affinity, defender: Affinity): number {
  const m = chart[attacker]?.[defender];
  return typeof m === 'number' ? m : 1;
}
