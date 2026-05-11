import type { GameContent, SaveData } from '../content/types';

/**
 * Validates a proposed equipped-skills loadout against the save: 1–5 skills, no duplicates,
 * every id known and already unlocked. Pure → unit-tested; `MenuScene` calls it before committing.
 */
export function setLoadout(save: SaveData, ids: string[], content: GameContent): { ok: true; equipped: string[] } | { ok: false; reason: string } {
  if (ids.length === 0) return { ok: false, reason: 'Equip at least one skill.' };
  if (ids.length > 5) return { ok: false, reason: 'You can equip at most 5 skills.' };
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'No duplicate skills.' };
  const unlocked = new Set(save.unlockedSkillIds);
  for (const id of ids) {
    if (!unlocked.has(id)) return { ok: false, reason: `You haven't learned ${content.skills[id]?.name ?? id} yet.` };
    if (!content.skills[id]) return { ok: false, reason: `Unknown skill ${id}.` };
  }
  return { ok: true, equipped: [...ids] };
}
