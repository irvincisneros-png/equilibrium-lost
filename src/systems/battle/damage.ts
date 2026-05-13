import type { Affinity, StatKey } from '../../content/types';
import { applyStage } from './types';
import { chainMultiplier } from './chain';
import { scaleSkillPower } from '../skillTiers';

export interface DamageParams {
  attacker: { level: number; atk: number; def: number; spd: number; signatureAffinity: Affinity; buffs: Partial<Record<StatKey, number>> };
  defenderDef: number;
  defenderBuffs: Partial<Record<StatKey, number>>;
  power: number;
  isSkill: boolean;
  skillAffinity: Affinity;       // 'Neutral' for a basic attack
  typeMult: number;              // from effectiveness()
  chain: number;
  quizCorrect: boolean | null;   // null = no quiz (basic attack / no-quiz skill)
  crit: boolean;
  isCatalystBurst?: boolean;
  rng?: () => number;            // default Math.random
}

export function computeDamage(p: DamageParams): number {
  if (p.typeMult === 0) return 0;
  const rng = p.rng ?? Math.random;
  // Pokémon-style: the attacker's level lives in `levelFactor` only — adding a separate `* level`
  // (the old bug) made damage scale quadratically with level, which wrecked the difficulty curve.
  const levelFactor = Math.floor(2 * p.attacker.level / 5) + 2;
  const effAtk = applyStage(p.attacker.atk, p.attacker.buffs.atk ?? 0);
  const effDef = Math.max(1, applyStage(p.defenderDef, p.defenderBuffs.def ?? 0));
  // Pillar A: a skill's effective power scales with the *attacker's* level. Basic attacks
  // (isSkill=false) and Catalyst Bursts (already huge + chainMult 3.0) are not scaled.
  const scaledPower = (p.isSkill && !p.isCatalystBurst) ? scaleSkillPower(p.power, p.attacker.level) : p.power;
  const base = Math.floor(Math.floor(Math.floor(levelFactor * scaledPower * effAtk / effDef) / 50) + 2);

  const fizzled = p.isSkill && p.quizCorrect === false;
  const quizMult = fizzled ? 0.3 : 1.0;
  const chainMult = p.isCatalystBurst ? 3.0 : (p.isSkill && p.quizCorrect === true) ? chainMultiplier(p.chain) : 1.0;
  const affinityBonus = (p.isSkill && !fizzled && p.skillAffinity === p.attacker.signatureAffinity) ? 1.25 : 1.0;
  const critMult = p.crit ? 1.5 : 1.0;
  const randFactor = 0.85 + rng() * 0.15;

  const dmg = Math.floor(base * p.typeMult * quizMult * chainMult * affinityBonus * critMult * randFactor);
  return Math.max(1, dmg);
}
