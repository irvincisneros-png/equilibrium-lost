// tests/systems/saveManager.test.ts
import { describe, it, expect } from 'vitest';
import { SaveManager, CURRENT_SAVE_VERSION, SAVE_KEY } from '../../src/systems/SaveManager';
import { loadGameContent } from '../../src/content/loadGameContent';

const content = loadGameContent().content;
const memStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
};

describe('SaveManager.newGame', () => {
  it('creates a level-1, stage-0 save in Region 1 with the class\'s starting kit', () => {
    const s = SaveManager.newGame('pyron', content);
    expect(s.version).toBe(CURRENT_SAVE_VERSION);
    expect(s.classId).toBe('pyron');
    expect(s.level).toBe(1); expect(s.xp).toBe(0); expect(s.evolutionStage).toBe(0);
    expect(s.currentHp).toBe(s.stats.hp);
    expect(s.currentEnergy).toBe(100);
    expect(s.unlockedSkillIds).toEqual(content.classes.find(c => c.id === 'pyron')!.startingSkillIds);
    expect(s.equippedSkillIds.length).toBeLessThanOrEqual(5);
    expect(s.currentRegionId).toBe(content.regions[0]!.id);
    expect(s.regionProgress[content.regions[0]!.id]!.entered).toBe(true);
    expect(s.regionProgress[content.regions[0]!.id]!.bossDefeated).toBe(false);
    expect(s.settings).toEqual({ studyMode: false, answerTimer: false });
  });
  it('throws for an unknown class id', () => { expect(() => SaveManager.newGame('nope', content)).toThrow(); });
});
