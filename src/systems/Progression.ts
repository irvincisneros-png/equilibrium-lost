import type { ClassDef, Stats, EvolutionDef, RegionProgress } from '../content/types';

// ---------- XP / level curves ----------

export function xpToNextLevel(level: number): number { return 100 * level; }
export function totalXpForLevel(level: number): number { return 50 * level * (level - 1); }
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}
