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
  it('accepts a well-formed orderSteps question', () => {
    const r = validateQuestion({ id: 'q5', topic: 'energy-changes', difficulty: 2, format: 'orderSteps',
      prompt: 'Put these in order:', steps: ['Break old bonds', 'Make new bonds', 'Release energy'], explanation: 'Bond changes drive the energy transfer.' });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it('flags malformed orderSteps questions as warnings', () => {
    const tooFew = validateQuestion({ id: 'q6', topic: 'energy-changes', difficulty: 2, format: 'orderSteps',
      prompt: 'Put these in order:', steps: ['Break old bonds', 'Make new bonds'], explanation: 'e' });
    const nonString = validateQuestion({ id: 'q7', topic: 'energy-changes', difficulty: 2, format: 'orderSteps',
      prompt: 'Put these in order:', steps: ['Break old bonds', 4, 'Release energy'], explanation: 'e' });
    expect(tooFew.warnings[0]).toMatch(/orderSteps/);
    expect(nonString.warnings[0]).toMatch(/orderSteps/);
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

import { ContentLoader, ContentError } from '../../src/content/ContentLoader';

const minimalRaw = () => ({
  classes: [{ id: 'pyron', name: 'Pyron', theme: 't', baseStats: { hp: 30, atk: 12, def: 6, spd: 9 }, growth: { hp: 6, atk: 3, def: 1, spd: 2 },
    signatureAffinity: 'Combustion', startingSkillIds: ['ember-test'], startingItemIds: [], skillUnlocks: [], evolutions: [] }],
  skills: { 'ember-test': { id: 'ember-test', name: 'Ember', affinity: 'Combustion', power: 30, energyCost: 20, topic: 'atomic-structure', questionDifficulty: 1, accuracy: 100, isSignature: true, isCatalystBurst: false, description: 'd' } },
  enemies: { protium: { id: 'protium', name: 'Protium', affinity: 'Atomic', baseStats: { hp: 20, atk: 8, def: 4, spd: 6 }, level: 3, attackPower: 20, skillIds: [], xpYield: 12, role: 'wild', spriteKey: 'enemy_protium' } },
  regions: [{ id: 'elemental-reaches', index: 1, name: 'The Elemental Reaches', topic: 'atomic-structure', tilemapKey: 'tiles_elemental_reaches', tilesetKey: 'tiles_elemental_reaches', battleBackgroundKey: 'bg_battle_elemental_reaches',
    wildEnemyIds: ['protium'], encounterRatePerStep: 0.12, miniBossId: 'protium', regionBossId: 'protium', npcIds: [],
    shrine: { questionTopic: 'atomic-structure', questionCount: 5, passRatio: 0.8, rewardXp: 200, rewardItemIds: [] }, unlocksRegionId: null, bossReward: { xp: 300, itemIds: [] } }],
  items: { buffer: { id: 'buffer', name: 'Buffer', kind: 'buffer', usableInBattle: true, effect: { healHp: 20 }, description: 'd' } },
  typeChart: { Base: { Acid: 2 } },
  questions: { 'atomic-structure': [
    { id: 'q1', topic: 'atomic-structure', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a','b','c','d'], answerIndex: 0, explanation: 'e' },
    { id: 'BAD', topic: 'atomic-structure', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a','b'], answerIndex: 0, explanation: 'e' } // malformed -> dropped
  ] },
  npcs: {},
  assets: { images: {}, tilemaps: {}, audio: {}, placeholders: [] }
});

describe('ContentLoader.fromRaw', () => {
  it('indexes valid content and drops malformed questions with a warning', () => {
    const { content, warnings } = ContentLoader.fromRaw(minimalRaw());
    expect(content.questions['atomic-structure']!.map(q => q.id)).toEqual(['q1']);
    expect(warnings.some(w => /BAD/.test(w))).toBe(true);
    expect(content.regions[0]!.id).toBe('elemental-reaches');
    expect(content.skills['ember-test']!.power).toBe(30);
  });
  it('throws ContentError when a required collection is empty', () => {
    const raw = minimalRaw(); (raw as any).classes = [];
    expect(() => ContentLoader.fromRaw(raw)).toThrowError(ContentError);
  });
  it('throws ContentError listing the offending fields when a skill is malformed', () => {
    const raw = minimalRaw(); (raw.skills as any)['ember-test'] = { id: 'ember-test' };
    expect(() => ContentLoader.fromRaw(raw)).toThrowError(/ember-test/);
  });
});
