import { describe, it, expect } from 'vitest';
import { setLoadout } from '../../src/scenes/loadout';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';

const content = loadGameContent().content;

describe('setLoadout', () => {
  it('accepts a valid loadout of unlocked skills, ≤5, no dupes', () => {
    const save = SaveManager.newGame('pyron', content);
    save.unlockedSkillIds = ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize'];
    const r = setLoadout(save, ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize'], content);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.equipped.length).toBe(4);
  });

  it('rejects more than 5', () => {
    const save = SaveManager.newGame('pyron', content);
    save.unlockedSkillIds = ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize', 'neutralize', 'decompose'];
    expect(setLoadout(save, ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize', 'neutralize', 'decompose'], content).ok).toBe(false);
  });

  it('rejects an id the player has not unlocked', () => {
    const save = SaveManager.newGame('pyron', content);
    save.unlockedSkillIds = ['proton-jab'];
    expect(setLoadout(save, ['proton-jab', 'decompose'], content).ok).toBe(false);
  });

  it('rejects duplicates and empty loadouts', () => {
    const save = SaveManager.newGame('pyron', content);
    save.unlockedSkillIds = ['proton-jab', 'spark-flare'];
    expect(setLoadout(save, ['proton-jab', 'proton-jab'], content).ok).toBe(false);
    expect(setLoadout(save, [], content).ok).toBe(false);
  });
});
