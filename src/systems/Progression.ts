import type { ClassDef, Stats, EvolutionDef, RegionProgress } from '../content/types';

// ---------- XP / level curves ----------

export function xpToNextLevel(level: number): number { return 100 * level; }
export function totalXpForLevel(level: number): number { return 50 * level * (level - 1); }
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

// ---------- stat helpers ----------

const addStats = (a: Stats, b: Stats): Stats => ({ hp: a.hp + b.hp, atk: a.atk + b.atk, def: a.def + b.def, spd: a.spd + b.spd });
const scaleStats = (a: Stats, k: number): Stats => ({ hp: a.hp * k, atk: a.atk * k, def: a.def * k, spd: a.spd * k });
const floorStats = (a: Stats): Stats => ({ hp: Math.floor(a.hp), atk: Math.floor(a.atk), def: Math.floor(a.def), spd: Math.floor(a.spd) });

export function statsForLevel(classDef: ClassDef, level: number, evolutionStage: number): Stats {
  let s = addStats(classDef.baseStats, scaleStats(classDef.growth, Math.max(0, level - 1)));
  for (const evo of classDef.evolutions) if (evo.stage <= evolutionStage) s = addStats(s, evo.statBonus);
  return floorStats(s);
}

// ---------- progression state ----------

export interface ProgressState { level: number; xp: number; unlockedSkillIds: string[]; }
export interface AddXpResult extends ProgressState { leveledTo: number[]; newlyUnlockedSkillIds: string[]; }

export function addXp(state: ProgressState, amount: number, classDef: ClassDef): AddXpResult {
  const xp = state.xp + Math.max(0, Math.floor(amount));
  const newLevel = levelForXp(xp);
  const leveledTo: number[] = [];
  for (let l = state.level + 1; l <= newLevel; l++) leveledTo.push(l);
  const unlocked = new Set(state.unlockedSkillIds);
  const newlyUnlockedSkillIds: string[] = [];
  for (const u of classDef.skillUnlocks) {
    if (u.level > state.level && u.level <= newLevel && !unlocked.has(u.skillId)) {
      unlocked.add(u.skillId);
      newlyUnlockedSkillIds.push(u.skillId);
    }
  }
  return { level: newLevel, xp, unlockedSkillIds: [...unlocked], leveledTo, newlyUnlockedSkillIds };
}
