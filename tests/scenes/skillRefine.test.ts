import { describe, it, expect, beforeEach } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';
import { previewRefine, applyRefine } from '../../src/scenes/skillRefine';
import { MAX_TIER, REFINE_TIER_COSTS } from '../../src/systems/skillTiers';
import type { GameContent, SaveData } from '../../src/content/types';

let content: GameContent; let save: SaveData; let skillId: string;
beforeEach(() => {
  content = loadGameContent().content;
  save = SaveManager.newGame(content.classes[0]!.id, content);
  skillId = save.unlockedSkillIds[0]!;
});

describe('previewRefine', () => {
  it('reports tier 0 / first cost / cannot afford with 0 RP', () => {
    const p = previewRefine(save, skillId, content);
    expect(p.tier).toBe(0);
    expect(p.cost).toBe(REFINE_TIER_COSTS[0]);
    expect(p.canAfford).toBe(false);
    expect(p.atMax).toBe(false);
  });
  it('does not mutate the save', () => {
    const snap = JSON.stringify(save);
    previewRefine(save, skillId, content);
    expect(JSON.stringify(save)).toBe(snap);
  });
  it('reports atMax and null cost at MAX_TIER', () => {
    save.skillTiers[skillId] = MAX_TIER;
    const p = previewRefine(save, skillId, content);
    expect(p.atMax).toBe(true);
    expect(p.cost).toBeNull();
    expect(p.canAfford).toBe(false);
  });
});

describe('applyRefine', () => {
  it('refuses when not enough RP', () => {
    const r = applyRefine(save, skillId, content);
    expect(r.ok).toBe(false);
  });
  it('refuses an unknown skill', () => {
    expect(applyRefine(save, 'no-such-skill', content).ok).toBe(false);
  });
  it('refuses a not-yet-unlocked skill', () => {
    const locked = Object.keys(content.skills).find(id => !save.unlockedSkillIds.includes(id))!;
    save.reagentPoints = 999;
    expect(applyRefine(save, locked, content).ok).toBe(false);
  });
  it('buys a tier, spends the RP, persists the tier on the save', () => {
    save.reagentPoints = 100;
    const r = applyRefine(save, skillId, content);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.tier).toBe(1); expect(r.reagentPoints).toBe(100 - REFINE_TIER_COSTS[0]!); }
    expect(save.skillTiers[skillId]).toBe(1);
    expect(save.reagentPoints).toBe(100 - REFINE_TIER_COSTS[0]!);
  });
  it('walks 0→1→2→3 then refuses at MAX_TIER, charging the rising costs', () => {
    save.reagentPoints = 1000;
    for (let i = 0; i < MAX_TIER; i++) expect(applyRefine(save, skillId, content).ok).toBe(true);
    expect(save.skillTiers[skillId]).toBe(MAX_TIER);
    expect(save.reagentPoints).toBe(1000 - REFINE_TIER_COSTS.reduce((a, b) => a + b, 0));
    expect(applyRefine(save, skillId, content).ok).toBe(false);
  });
});
