import type { GameContent, SaveData } from '../content/types';
import type { PlayerBattleInput, BattleContext } from '../systems/BattleEngine';
import { statsForLevel } from '../systems/Progression';

/**
 * Pure glue between the save/content and the battle engine — kept Phaser-free and unit-tested
 * so `BattleScene` can stay a thin renderer.
 */

/** Registry key: a one-shot "study refresher" message the battle queues for the overworld to toast. */
export const REFRESHER_TOAST_KEY = 'overworld:refresherToast';

/** Builds the engine's player input from the current save + content (stats, equipped skills, burst id). */
export function playerBattleInputFromSave(save: SaveData, content: GameContent): PlayerBattleInput {
  const cls = content.classes.find(c => c.id === save.classId);
  if (!cls) throw new Error(`battlePresenter: unknown class "${save.classId}"`);
  const stats = statsForLevel(cls, save.level, save.evolutionStage);
  const reachable = [...cls.startingSkillIds, ...cls.skillUnlocks.map(u => u.skillId)];
  const catalystBurstSkillId = reachable.find(id => content.skills[id]?.isCatalystBurst);
  const attackPower = Math.max(14, Math.floor(stats.atk * 1.1)); // basic attack — a bit above ATK; the real damage is in skills
  return {
    name: cls.name,
    classId: cls.id,
    signatureAffinity: cls.signatureAffinity,
    level: save.level,
    maxHp: stats.hp,
    hp: save.currentHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    maxEnergy: 100,
    energy: save.currentEnergy,
    equippedSkillIds: [...save.equippedSkillIds],
    attackPower,
    isBoss: false,
    catalystBurstSkillId,
  };
}

/** Wires the engine's content lookups + the settings it cares about (the answer-timer crit gate). */
export function battleContextFromContent(content: GameContent, settings: { answerTimer: boolean }): BattleContext {
  return {
    getSkill: (id) => { const s = content.skills[id]; if (!s) throw new Error('unknown skill ' + id); return s; },
    getItem: (id) => { const i = content.items[id]; if (!i) throw new Error('unknown item ' + id); return i; },
    getEnemyDef: (id) => { const e = content.enemies[id]; if (!e) throw new Error('unknown enemy ' + id); return e; },
    settings: { answerTimer: settings.answerTimer },
  };
}
