import type { GameContent, SaveData } from '../content/types';
import { statsForLevel } from './Progression';

export const SAVE_KEY = 'equilibrium-lost:save:v1';
export const CURRENT_SAVE_VERSION = 1;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SaveManager = {
  newGame(classId: string, content: GameContent): SaveData {
    const cls = content.classes.find(c => c.id === classId);
    if (!cls) throw new Error(`SaveManager.newGame: unknown class "${classId}"`);
    const region1 = content.regions[0];
    if (!region1) throw new Error('SaveManager.newGame: no regions defined in content');
    const stats = statsForLevel(cls, 1, 0);
    return {
      version: CURRENT_SAVE_VERSION,
      classId,
      evolutionStage: 0,
      level: 1,
      xp: 0,
      stats,
      currentHp: stats.hp,
      currentEnergy: 100,
      unlockedSkillIds: [...cls.startingSkillIds],
      equippedSkillIds: cls.startingSkillIds.slice(0, 5),
      items: cls.startingItemIds.map(i => ({ ...i })),
      currentRegionId: region1.id,
      regionProgress: {
        [region1.id]: {
          entered: true,
          miniBossDefeated: false,
          bossDefeated: false,
          shrineCleared: false
        }
      },
      storyFlags: {},
      // OverworldScene snaps to the tilemap's player_spawn on entry; this is a fallback
      // TODO Task 43: read spawn coords from tilemap objects layer once authored
      playerTile: { regionId: region1.id, x: 4, y: 14 },
      quizStats: {},
      settings: { studyMode: false, answerTimer: false }
    };
  },
  save(data: SaveData, storage: StorageLike): void {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  clear(storage: StorageLike): void {
    storage.removeItem(SAVE_KEY);
  },

  load(content: GameContent, storage: StorageLike): { ok: true; data: SaveData } | { ok: false; reason: 'none' | 'corrupt' } {
    const raw = storage.getItem(SAVE_KEY);
    if (raw == null) return { ok: false, reason: 'none' };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupt' }; }
    try { const data = SaveManager.migrate(parsed, content); return { ok: true, data }; }
    catch { return { ok: false, reason: 'corrupt' }; }
  },

  migrate(raw: unknown, _content: GameContent): SaveData {
    if (typeof raw !== 'object' || raw === null) throw new Error('corrupt');
    return raw as SaveData;
  },

  // recordQuizResult — Task 34
};
