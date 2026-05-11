import { describe, it, expect } from 'vitest';
import { validateQuestion, validateSkill, validateRegion, validateGameContent } from '../../src/content/schema';

describe('validateQuestion', () => {
  it('accepts a well-formed mcq', () => {
    const r = validateQuestion({ id: 'q1', topic: 'atomic-structure', difficulty: 1, format: 'mcq',
      prompt: 'How many protons in hydrogen-1?', options: ['0', '1', '2', '3'], answerIndex: 1, explanation: 'Atomic number 1.' });
    expect(r.errors).toEqual([]);
  });
  it('flags an mcq with a bad answerIndex as a warning (skip, don\'t crash)', () => {
    const r = validateQuestion({ id: 'q2', topic: 'atomic-structure', difficulty: 1, format: 'mcq',
      prompt: 'x', options: ['a', 'b', 'c', 'd'], answerIndex: 9, explanation: 'y' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/q2/);
  });
  it('flags an mcq without exactly 4 options', () => {
    const r = validateQuestion({ id: 'q3', topic: 't', difficulty: 1, format: 'mcq', prompt: 'x', options: ['a', 'b'], answerIndex: 0, explanation: 'y' });
    expect(r.warnings.length).toBe(1);
  });
  it('accepts a well-formed balanceEquation', () => {
    const r = validateQuestion({ id: 'q4', topic: 'atomic-structure', difficulty: 3, format: 'balanceEquation',
      prompt: 'Balance: H2 + O2 -> H2O', equation: { reactants: [{ formula: 'H2', coeff: 2 }, { formula: 'O2', coeff: 1 }], products: [{ formula: 'H2O', coeff: 2 }] }, explanation: '2H2 + O2 -> 2H2O' });
    expect(r.errors).toEqual([]);
  });
});

describe('validateSkill', () => {
  it('rejects a skill missing required fields as an error', () => {
    const r = validateSkill({ id: 's1' });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('accepts a valid skill', () => {
    const r = validateSkill({ id: ' proton-jab '.trim(), name: 'Proton Jab', affinity: 'Atomic', power: 35, energyCost: 20,
      topic: 'atomic-structure', questionDifficulty: 1, accuracy: 100, isSignature: false, isCatalystBurst: false, description: 'd' });
    expect(r.errors).toEqual([]);
  });
});

describe('validateRegion', () => {
  it('rejects a region with no boss as an error', () => {
    const r = validateRegion({ id: 'r1', index: 1, name: 'X', topic: 't', tilemapKey: 'k', tilesetKey: 'k', battleBackgroundKey: 'k',
      wildEnemyIds: [], encounterRatePerStep: 0.1, miniBossId: 'm', regionBossId: '', npcIds: [], shrine: { questionTopic: 't', questionCount: 5, passRatio: 0.8, rewardXp: 100, rewardItemIds: [] }, unlocksRegionId: null, bossReward: { xp: 100, itemIds: [] } });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('validateGameContent', () => {
  it('errors when a required collection is missing or empty', () => {
    const r = validateGameContent({ classes: [], skills: {}, enemies: {}, regions: [], items: {}, typeChart: {}, questions: {}, npcs: {}, assets: { images: {}, tilemaps: {}, audio: {}, placeholders: [] } } as any);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
