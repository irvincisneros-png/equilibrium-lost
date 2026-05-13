import { describe, it, expect } from 'vitest';
import { applyVictory, RP_AWARDS } from '../../src/scenes/battleVictory';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';

const content = loadGameContent().content;
const region1 = content.regions[0]!;

describe('applyVictory', () => {
  it('a wild win grants the enemy XP and does not clear the region', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const r = applyVictory(save, protium, region1, 0, content);
    expect(r.save.xp).toBe(protium.xpYield);
    expect(r.save.regionProgress[region1.id]!.bossDefeated).toBe(false);
    expect(r.evolved).toBeNull();
  });

  it('the per-correct bonus is added to the XP gained', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const r = applyVictory(save, protium, region1, 6, content);
    expect(r.save.xp).toBe(protium.xpYield + 6);
  });

  it('a region-boss win marks bossDefeated, grants the boss reward, and (Lv≥10) evolves', () => {
    const save = SaveManager.newGame('pyron', content);
    save.level = 10; save.xp = 4500;
    save.unlockedSkillIds = [...content.classes.find(c => c.id === 'pyron')!.startingSkillIds];
    const boss = content.enemies[region1.regionBossId]!;
    const r = applyVictory(save, boss, region1, 0, content);
    expect(r.save.regionProgress[region1.id]!.bossDefeated).toBe(true);
    expect(r.save.storyFlags['equilibrium_restored_' + region1.id]).toBe(true);
    for (const itemId of region1.bossReward.itemIds) expect(r.save.items.some(i => i.itemId === itemId)).toBe(true);
    expect(r.evolved?.name).toBe('Pyrochemist');
    expect(r.save.evolutionStage).toBe(1);
    expect(r.save.unlockedSkillIds).toContain('combustion-cascade');
    expect(r.banners.some(b => /evolved into Pyrochemist/i.test(b))).toBe(true);
  });

  it('a mini-boss win sets the miniboss flag but does not clear the region', () => {
    const save = SaveManager.newGame('pyron', content);
    const r = applyVictory(save, content.enemies[region1.miniBossId]!, region1, 0, content);
    expect(r.save.regionProgress[region1.id]!.miniBossDefeated).toBe(true);
    expect(r.save.storyFlags['miniboss_' + region1.id + '_done']).toBe(true);
    expect(r.save.regionProgress[region1.id]!.bossDefeated).toBe(false);
  });

  it('TM-style: an enemy with teachesSkillId teaches it once', () => {
    const save = SaveManager.newGame('aqualis', content);
    const drift = content.enemies['ionized-drift']!; // teaches thermal-vent
    const r = applyVictory(save, drift, region1, 0, content);
    expect(r.save.unlockedSkillIds).toContain('thermal-vent');
    const r2 = applyVictory(r.save, drift, region1, 0, content);
    expect(r2.banners.some(b => /thermal/i.test(b))).toBe(false);
  });

  it('a wild win grants RP_AWARDS.wild Reagent Points', () => {
    const save = SaveManager.newGame('pyron', content);
    const before = save.reagentPoints; // newGame => 0
    const protium = content.enemies['protium']!;
    const { save: after } = applyVictory(save, protium, region1, 0, content);
    expect(after.reagentPoints).toBe(before + RP_AWARDS.wild);
  });

  it('a mini-boss win grants RP_AWARDS.miniBoss', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const { save: after } = applyVictory(save, { ...protium, role: 'miniBoss' }, region1, 0, content);
    expect(after.reagentPoints).toBe(RP_AWARDS.miniBoss);
  });

  it('a region-boss win grants RP_AWARDS.regionBoss', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const { save: after } = applyVictory(save, { ...protium, role: 'regionBoss' }, region1, 0, content);
    expect(after.reagentPoints).toBe(RP_AWARDS.regionBoss);
  });

  it('a final-boss win grants RP_AWARDS.finalBoss', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const { save: after } = applyVictory(save, { ...protium, role: 'finalBoss' }, region1, 0, content);
    expect(after.reagentPoints).toBe(RP_AWARDS.finalBoss);
  });

  it('a victory banner mentions the Reagent Points gained', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!;
    const { banners } = applyVictory(save, protium, region1, 0, content);
    expect(banners.some(b => /Reagent Point/i.test(b))).toBe(true);
  });

  it('does not mutate the input save', () => {
    const save = SaveManager.newGame('pyron', content);
    const xpBefore = save.xp;
    applyVictory(save, content.enemies['protium']!, region1, 0, content);
    expect(save.xp).toBe(xpBefore);
  });
});
