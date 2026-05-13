import type { GameContent, SaveData, EnemyDef, RegionDef, EvolutionDef, RegionProgress } from '../content/types';
import { addXp, statsForLevel, checkEvolution } from '../systems/Progression';

/** Reagent Points awarded per win type — spent in MenuScene's Refine Skills tab. Tune in playtest. */
export const RP_AWARDS = { wild: 2, miniBoss: 8, regionBoss: 15, finalBoss: 15, shrine: 5 } as const;

export interface VictoryResult {
  save: SaveData;
  banners: string[];
  evolved: EvolutionDef | null;
}

/**
 * Pure victory bookkeeping after a `playerWin`: XP (enemy yield + per-correct bonus), level-ups
 * (stat recompute + a small heal), skill unlocks (auto-equipped while there's room), TM-style
 * teaches, mini-boss / region-boss flags + the region's boss reward, and — once `bossDefeated`
 * is set — the evolution check. Returns a *new* save plus the banner lines and the `EvolutionDef`
 * (if any); `BattleScene` only animates what comes back. TDD'd because the sequencing is fiddly.
 */
export function applyVictory(save: SaveData, enemyDef: EnemyDef, region: RegionDef, bonusXp: number, content: GameContent): VictoryResult {
  const s: SaveData = structuredClone(save);
  const cls = content.classes.find(c => c.id === s.classId);
  if (!cls) throw new Error(`applyVictory: unknown class "${s.classId}"`);
  const banners: string[] = [];

  const equipIfRoom = (id: string): void => {
    if (s.equippedSkillIds.length < 5 && !s.equippedSkillIds.includes(id)) s.equippedSkillIds.push(id);
  };
  const recomputeStats = (): void => {
    const oldMax = s.stats.hp;
    s.stats = statsForLevel(cls, s.level, s.evolutionStage);
    if (s.stats.hp > oldMax) s.currentHp = Math.min(s.stats.hp, s.currentHp + (s.stats.hp - oldMax));
  };
  const award = (amount: number, banner: string): void => {
    if (amount <= 0) return;
    const r = addXp({ level: s.level, xp: s.xp, unlockedSkillIds: s.unlockedSkillIds }, amount, cls);
    banners.push(`+${amount} XP — ${banner}`);
    s.level = r.level; s.xp = r.xp; s.unlockedSkillIds = r.unlockedSkillIds;
    for (const lvl of r.leveledTo) banners.push(`Level ${lvl}!`);
    if (r.leveledTo.length) recomputeStats();
    for (const id of r.newlyUnlockedSkillIds) { banners.push(`Learned ${content.skills[id]?.name ?? id}!`); equipIfRoom(id); }
  };
  const learn = (id: string, banner: string): void => {
    if (s.unlockedSkillIds.includes(id)) return;
    s.unlockedSkillIds = [...s.unlockedSkillIds, id];
    banners.push(banner);
    equipIfRoom(id);
  };

  // XP / levels / unlocks (enemy yield + the per-correct quiz bonus)
  award(enemyDef.xpYield + Math.max(0, Math.floor(bonusXp)), 'Reaction mastered!');

  // TM-style teach
  if (enemyDef.teachesSkillId) learn(enemyDef.teachesSkillId, `${enemyDef.name} taught you ${content.skills[enemyDef.teachesSkillId]?.name ?? enemyDef.teachesSkillId}!`);

  // Boss clear
  const rp: RegionProgress = (s.regionProgress[region.id] ??= { entered: true, miniBossDefeated: false, bossDefeated: false, shrineCleared: false });
  if (enemyDef.role === 'miniBoss') {
    rp.miniBossDefeated = true;
    s.storyFlags[`miniboss_${region.id}_done`] = true;
    banners.push('The guardian falls — the path ahead is clear.');
  } else if (enemyDef.role === 'regionBoss') {
    rp.bossDefeated = true;
    s.storyFlags[`equilibrium_restored_${region.id}`] = true;
    award(region.bossReward.xp, 'Region cleared!');
    for (const itemId of region.bossReward.itemIds) {
      const e = s.items.find(i => i.itemId === itemId);
      if (e) e.qty += 1; else s.items.push({ itemId, qty: 1 });
    }
    if (region.bossReward.skillId) learn(region.bossReward.skillId, `Learned ${content.skills[region.bossReward.skillId]?.name ?? region.bossReward.skillId}!`);
    banners.push(`Equilibrium restored to ${region.name}!`);
  }

  // Reagent Points (skill-refine currency)
  const rpGain = enemyDef.role === 'miniBoss' ? RP_AWARDS.miniBoss
    : enemyDef.role === 'regionBoss' ? RP_AWARDS.regionBoss
    : enemyDef.role === 'finalBoss' ? RP_AWARDS.finalBoss
    : RP_AWARDS.wild;
  s.reagentPoints += rpGain;
  banners.push(`+${rpGain} Reagent Points`);

  // Evolution — checked last, now that bossDefeated may have just been set
  let evolved: EvolutionDef | null = null;
  const evo = checkEvolution(cls, s.level, s.evolutionStage, s.regionProgress);
  if (evo) {
    const oldName = s.evolutionStage === 0 ? cls.name : (cls.evolutions.find(e => e.stage === s.evolutionStage)?.name ?? cls.name);
    s.evolutionStage = evo.stage;
    recomputeStats();
    if (!s.unlockedSkillIds.includes(evo.newSignatureSkillId)) s.unlockedSkillIds = [...s.unlockedSkillIds, evo.newSignatureSkillId];
    equipIfRoom(evo.newSignatureSkillId);
    evolved = evo;
    banners.push(`Equilibrium flows through you — ${oldName} evolved into ${evo.name}!`);
  }

  return { save: s, banners, evolved };
}
