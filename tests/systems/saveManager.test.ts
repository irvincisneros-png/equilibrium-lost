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

describe('SaveManager.save / load', () => {
  it('round-trips a save through storage', () => {
    const st = memStorage();
    const s = SaveManager.newGame('aqualis', content);
    s.level = 7; s.xp = 1500; s.storyFlags.lesson_atomic_structure_seen = true;
    SaveManager.save(s, st);
    const r = SaveManager.load(content, st);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.classId).toBe('aqualis'); expect(r.data.level).toBe(7); expect(r.data.storyFlags.lesson_atomic_structure_seen).toBe(true); }
  });
  it('load returns {ok:false, reason:"none"} when there is no save', () => {
    const r = SaveManager.load(content, memStorage());
    expect(r).toEqual({ ok: false, reason: 'none' });
  });
  it('clear removes the save', () => {
    const st = memStorage();
    SaveManager.save(SaveManager.newGame('ionix', content), st);
    SaveManager.clear(st);
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'none' });
  });
});

describe('SaveManager — corruption', () => {
  it('non-JSON in storage -> corrupt', () => {
    const st = memStorage();
    st.setItem(SAVE_KEY, '{not json');
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
  it('a JSON value that is not an object -> corrupt', () => {
    const st = memStorage();
    st.setItem(SAVE_KEY, '42');
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
  it('missing version / classId -> corrupt', () => {
    const st = memStorage();
    st.setItem(SAVE_KEY, JSON.stringify({ level: 1 }));
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
  it('a classId that does not exist in content -> corrupt', () => {
    const st = memStorage();
    const s = SaveManager.newGame('pyron', content);
    (s as unknown as Record<string, unknown>).classId = 'phantom';
    st.setItem(SAVE_KEY, JSON.stringify(s));
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
  it('a structurally-broken regionProgress -> corrupt', () => {
    const st = memStorage();
    const s = SaveManager.newGame('pyron', content);
    (s as unknown as Record<string, unknown>).regionProgress = 'nope';
    st.setItem(SAVE_KEY, JSON.stringify(s));
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
});

describe('SaveManager — migration', () => {
  it('upgrades a "version 0" save by filling M1 defaults and bumping the version', () => {
    const st = memStorage();
    const base = SaveManager.newGame('pyron', content);
    const old: Record<string, unknown> = { ...base, version: 0 };
    delete old.evolutionStage; delete old.currentEnergy; delete old.quizStats; delete old.settings; delete old.playerTile;
    st.setItem(SAVE_KEY, JSON.stringify(old));
    const r = SaveManager.load(content, st);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(CURRENT_SAVE_VERSION);
      expect(r.data.evolutionStage).toBe(0);
      expect(r.data.currentEnergy).toBe(100);
      expect(r.data.quizStats).toEqual({});
      expect(r.data.settings).toEqual({ studyMode: false, answerTimer: false });
      expect(r.data.playerTile.regionId).toBe(r.data.currentRegionId);
    }
  });
  it('a current-version save passes through unchanged', () => {
    const st = memStorage(); const s = SaveManager.newGame('ionix', content); s.level = 5;
    SaveManager.save(s, st);
    const r = SaveManager.load(content, st);
    expect(r.ok && r.data.level).toBe(5);
  });
});
