// tests/systems/computeDamage.test.ts
import { describe, it, expect } from 'vitest';
import { computeDamage } from '../../src/systems/battle/damage';
import { CHAIN_MULTIPLIERS } from '../../src/systems/battle/chain';
import { scaleSkillPower } from '../../src/systems/skillTiers';

const atkr = { level: 10, atk: 30, def: 12, spd: 10, signatureAffinity: 'Combustion' as const, buffs: {} as Record<string, number> };

describe('computeDamage', () => {
  it('basic attack: level/atk/def -> base, then ×rand(=1)', () => {
    // levelFactor = floor(2*10/5)+2 = 6 ; base = floor(floor(floor(6*28*30/12)/50)+2) = floor(floor(420/50)+2) = 10
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 28, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: false, rng: () => 1 });
    expect(d).toBe(10);
  });
  it('applies type effectiveness multiplicatively', () => {
    const d2 = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 28, isSkill: false, skillAffinity: 'Neutral', typeMult: 2, chain: 0, quizCorrect: null, crit: false, rng: () => 1 });
    expect(d2).toBe(20);
  });
  it('immune (typeMult 0) -> 0 regardless of everything', () => {
    expect(computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid', typeMult: 0, chain: 5, quizCorrect: true, crit: true, rng: () => 1 })).toBe(0);
  });
  it('successful skill: chain multiplier + 1.25 affinity bonus when affinity matches signature', () => {
    // scaledPower = scaleSkillPower(40,10) = round(40*1.36) = 54
    // base = floor(floor(floor(6*54*30/12)/50)+2) = floor(floor(810/50)+2) = 18
    // chain 2 -> 1.5 ; affinity Combustion == signature -> 1.25 ; => floor(18 * 1.5 * 1.25) = floor(33.75) = 33
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 2, quizCorrect: true, crit: false, rng: () => 1 });
    expect(CHAIN_MULTIPLIERS[2]).toBe(1.5);
    expect(d).toBe(33);
  });
  it('fizzled skill (wrong quiz): 0.3 multiplier, no chain bonus, no affinity bonus', () => {
    // scaledPower = scaleSkillPower(40,10) = round(40*1.36) = 54
    // base = floor(floor(floor(6*54*30/12)/50)+2) = floor(floor(810/50)+2) = 18
    // floor(18 * 0.3) = 5
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 5, quizCorrect: false, crit: false, rng: () => 1 });
    expect(d).toBe(5);
  });
  it('catalyst burst: flat ×3.0, ignores chain, gets affinity bonus', () => {
    // floor(14 * 3.0 * 1.25) = floor(52.5) = 52
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 5, quizCorrect: true, crit: false, rng: () => 1, isCatalystBurst: true });
    expect(d).toBe(52);
  });
  it('crit ×1.5 stacks; rng factor of 0.85 is the floor of variance', () => {
    const dMax = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: true, rng: () => 1 });
    const dMin = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: true, rng: () => 0 });
    expect(dMax).toBe(21); // floor(14 * 1.5)
    expect(dMin).toBe(17); // floor(14 * 1.5 * 0.85)
  });
  it('damage is at least 1 when typeMult > 0', () => {
    const weak = { level: 1, atk: 1, def: 1, spd: 1, signatureAffinity: 'Neutral' as const, buffs: {} };
    expect(computeDamage({ attacker: weak, defenderDef: 999, defenderBuffs: {}, power: 1, isSkill: false, skillAffinity: 'Neutral', typeMult: 0.5, chain: 0, quizCorrect: null, crit: false, rng: () => 0 })).toBeGreaterThanOrEqual(1);
  });
  it('Pillar A: a skill at higher wielder level hits harder than the same skill at level 1', () => {
    const mk = (level: number) => computeDamage({
      attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
      defenderDef: 20, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Acid',
      typeMult: 1, chain: 0, quizCorrect: true, crit: false, rng: () => 0,
    });
    expect(mk(20)).toBeGreaterThan(mk(1));
  });
  it('Pillar A: basic attacks and Catalyst Bursts are NOT level-scaled here', () => {
    // a basic attack at level 20 vs level 1 with the same power differs only via levelFactor,
    // not via skill scaling — so it should equal "power, not scaleSkillPower(power)".
    const burst = (level: number) => computeDamage({
      attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
      defenderDef: 20, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid',
      typeMult: 1, chain: 0, quizCorrect: true, crit: false, isCatalystBurst: true, rng: () => 0,
    });
    const skill = (level: number) => computeDamage({
      attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
      defenderDef: 20, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid',
      typeMult: 1, chain: 0, quizCorrect: true, crit: false, rng: () => 0,
    });
    // the non-burst skill grows proportionally faster across levels because its power is scaled
    // (burst only gains levelFactor; skill gains levelFactor + scaleSkillPower)
    const skillGrowth = skill(20) / skill(1);
    const burstGrowth = burst(20) / burst(1);
    expect(skillGrowth).toBeGreaterThan(burstGrowth);
    expect(scaleSkillPower(50, 20)).toBeGreaterThan(50);
  });
});
