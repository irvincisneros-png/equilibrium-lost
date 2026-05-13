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
    expect(s.settings).toEqual({ studyMode: false, answerTimer: false, musicVolume: 0.6 });
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
      expect(r.data.settings).toEqual({ studyMode: false, answerTimer: false, musicVolume: 0.6 });
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

const firstClassId = content.classes[0]!.id;

describe('SaveManager — save v2 (skillTiers + reagentPoints)', () => {
  it('newGame seeds skillTiers:{} and reagentPoints:0 at version 3', () => {
    const s = SaveManager.newGame(firstClassId, content);
    expect(s.version).toBe(3);
    expect(s.skillTiers).toEqual({});
    expect(s.reagentPoints).toBe(0);
  });

  it('migrates a v1 save by backfilling skillTiers / reagentPoints (and continues to v3)', () => {
    const v1: any = { ...SaveManager.newGame(firstClassId, content), version: 1 };
    delete v1.skillTiers; delete v1.reagentPoints;
    const storage = memStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(v1));
    const r = SaveManager.load(content, storage);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.version).toBe(3); expect(r.data.skillTiers).toEqual({}); expect(r.data.reagentPoints).toBe(0); }
  });

  it('keeps an explicit reagentPoints value through migration', () => {
    const v1: any = { ...SaveManager.newGame(firstClassId, content), version: 1, reagentPoints: 99, skillTiers: { 'acid-splash': 2 } };
    const storage = memStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(v1));
    const r = SaveManager.load(content, storage);
    expect(r.ok && r.data.reagentPoints).toBe(99);
    expect(r.ok && (r.data as any).skillTiers['acid-splash']).toBe(2);
  });
});

describe('SaveManager — save v3 (musicVolume)', () => {
  it('newGame seeds settings.musicVolume=0.6 at version 3', () => {
    const s = SaveManager.newGame(content.classes[0]!.id, content);
    expect(s.version).toBe(3);
    expect(s.settings.musicVolume).toBe(0.6);
  });

  it('migrates a v2 save by backfilling settings.musicVolume', () => {
    const storage = memStorage();
    const v2: any = { ...SaveManager.newGame(content.classes[0]!.id, content), version: 2 };
    delete v2.settings.musicVolume;
    storage.setItem(SAVE_KEY, JSON.stringify(v2));
    const r = SaveManager.load(content, storage);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.version).toBe(3); expect(r.data.settings.musicVolume).toBe(0.6); }
  });
});

describe('SaveManager.recordQuizResult', () => {
  it('creates a topic entry on first record', () => {
    const s = SaveManager.recordQuizResult(SaveManager.newGame('pyron', content), 'atomic-structure', true);
    expect(s.quizStats['atomic-structure']).toEqual({ topic: 'atomic-structure', asked: 1, correct: 1, recentMisses: 0 });
  });
  it('accumulates asked/correct and tracks a miss streak that resets on a correct answer', () => {
    let s = SaveManager.newGame('pyron', content);
    s = SaveManager.recordQuizResult(s, 'atomic-structure', false);
    s = SaveManager.recordQuizResult(s, 'atomic-structure', false);
    expect(s.quizStats['atomic-structure']).toMatchObject({ asked: 2, correct: 0, recentMisses: 2 });
    s = SaveManager.recordQuizResult(s, 'atomic-structure', true);
    expect(s.quizStats['atomic-structure']).toMatchObject({ asked: 3, correct: 1, recentMisses: 0 });
  });
  it('does not mutate the input', () => {
    const s0 = SaveManager.newGame('pyron', content);
    const s1 = SaveManager.recordQuizResult(s0, 'atomic-structure', true);
    expect(s0.quizStats).toEqual({});
    expect(s1).not.toBe(s0);
  });
});
