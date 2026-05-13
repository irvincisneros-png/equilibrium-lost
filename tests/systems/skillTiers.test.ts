import { describe, it, expect } from 'vitest';
import { SCALE_PER_LEVEL, MAX_TIER, REFINE_TIER_COSTS, TIER_DELTA, scaleSkillPower, effectiveSkill } from '../../src/systems/skillTiers';
import type { SkillDef } from '../../src/content/types';

const base: SkillDef = {
  id: 'x', name: 'X', affinity: 'Acid', power: 40, energyCost: 25, topic: 'acids-bases',
  questionDifficulty: 1, accuracy: 100, isSignature: false, isCatalystBurst: false,
  behavior: { applyStatus: { id: 'dissolved', chance: 35, turns: 3, magnitude: 5 } }, description: 'd',
};

describe('skillTiers constants', () => {
  it('exposes the agreed tuning numbers', () => {
    expect(SCALE_PER_LEVEL).toBe(0.04);
    expect(MAX_TIER).toBe(3);
    expect(REFINE_TIER_COSTS).toEqual([20, 40, 70]);
    expect(TIER_DELTA).toEqual({ power: 4, statusChance: 5, energyCost: 2 });
  });
});

describe('scaleSkillPower', () => {
  it('is identity at level 1', () => expect(scaleSkillPower(40, 1)).toBe(40));
  it('is identity at level <= 1 (no negative scaling)', () => expect(scaleSkillPower(40, 0)).toBe(40));
  it('rounds power * (1 + 0.04*(lvl-1))', () => {
    expect(scaleSkillPower(40, 10)).toBe(Math.round(40 * 1.36)); // 54
    expect(scaleSkillPower(40, 20)).toBe(Math.round(40 * 1.76)); // 70
  });
  it('keeps power-0 utility skills at 0', () => expect(scaleSkillPower(0, 25)).toBe(0));
});

describe('effectiveSkill', () => {
  it('returns the same object at tier 0', () => expect(effectiveSkill(base, 0)).toBe(base));
  it('clamps tier into [0, MAX_TIER]', () => {
    expect(effectiveSkill(base, 99).power).toBe(base.power + TIER_DELTA.power * MAX_TIER);
    expect(effectiveSkill(base, -5)).toBe(base);
  });
  it('adds power, raises status chance (cap 100), lowers energy cost (floor 0) per tier', () => {
    const t2 = effectiveSkill(base, 2);
    expect(t2.power).toBe(48);                       // 40 + 4*2
    expect(t2.energyCost).toBe(21);                  // 25 - 2*2
    expect(t2.behavior!.applyStatus!.chance).toBe(45); // 35 + 5*2
    // floors / caps
    const hot = effectiveSkill({ ...base, energyCost: 3, behavior: { applyStatus: { id: 'dissolved', chance: 96, turns: 3, magnitude: 5 } } }, 3);
    expect(hot.energyCost).toBe(0);
    expect(hot.behavior!.applyStatus!.chance).toBe(100);
  });
  it('does not mutate the input skill', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    effectiveSkill(base, 3);
    expect(JSON.parse(JSON.stringify(base))).toEqual(snapshot);
  });
  it('leaves a behavior-less skill without a behavior', () => {
    const { behavior, ...noBehavior } = base; void behavior;
    expect(effectiveSkill(noBehavior as SkillDef, 3).behavior).toBeUndefined();
  });
});
