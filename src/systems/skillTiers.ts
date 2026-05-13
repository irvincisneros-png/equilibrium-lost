import type { SkillDef } from '../content/types';

/**
 * Skill-progression tuning + the two pure transforms used by the battle math.
 *
 * Pillar A — `scaleSkillPower`: a skill's *effective* power grows ~SCALE_PER_LEVEL per wielder
 * level so old moves stay viable. Applied inside `computeDamage` for non-burst skills only.
 *
 * Pillar B — `effectiveSkill`: applies a bought tier (0..MAX_TIER) to a SkillDef — per tier,
 * +power, +status chance (cap 100), −energy cost (floor 0). Used by the engine when a skill
 * fires, by the Refine screen for previews, and by the battle skill menu for display.
 */
export const SCALE_PER_LEVEL = 0.04;
export const MAX_TIER = 3;
/** RP cost to buy tier 1, then 2, then 3 (index 0 = 0→1). */
export const REFINE_TIER_COSTS: readonly number[] = [20, 40, 70];
/** Uniform per-tier stat deltas. */
export const TIER_DELTA = { power: 4, statusChance: 5, energyCost: 2 } as const;

export function scaleSkillPower(power: number, wielderLevel: number): number {
  if (power <= 0) return power;
  return Math.round(power * (1 + SCALE_PER_LEVEL * Math.max(0, wielderLevel - 1)));
}

export function effectiveSkill(skill: SkillDef, tier: number): SkillDef {
  const t = Math.max(0, Math.min(MAX_TIER, Math.floor(tier)));
  if (t === 0) return skill;
  const next: SkillDef = {
    ...skill,
    power: skill.power + TIER_DELTA.power * t,
    energyCost: Math.max(0, skill.energyCost - TIER_DELTA.energyCost * t),
  };
  if (skill.behavior?.applyStatus) {
    next.behavior = {
      ...skill.behavior,
      applyStatus: { ...skill.behavior.applyStatus, chance: Math.min(100, skill.behavior.applyStatus.chance + TIER_DELTA.statusChance * t) },
    };
  }
  return next;
}
