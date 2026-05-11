import type { EnemyDef, Affinity } from '../../content/types';
import { type BattleState, type Combatant, applyStage, clone } from './types';

export interface PlayerBattleInput {
  name: string; classId: string; signatureAffinity: Affinity; level: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  maxEnergy: number; energy: number; equippedSkillIds: string[]; attackPower: number; isBoss: boolean;
  catalystBurstSkillId?: string;
}
export interface EnemyBattleInput { def: EnemyDef; level: number; }

const DEFAULT_RNG = () => Math.random();

function scaleStat(base: number, defLevel: number, atLevel: number): number {
  if (atLevel === defLevel) return base;
  // simple linear-ish soft scale: ±~6% per level difference, never below 1
  return Math.max(1, Math.round(base * (1 + 0.06 * (atLevel - defLevel))));
}

export function buildEnemyCombatant(def: EnemyDef, level: number, playerLevel?: number): Combatant {
  // Region/final bosses with bossSoftScale: scale UP to the player's level if the player is higher (never down). (Task 23.)
  let lvl = level;
  if (def.bossSoftScale && typeof playerLevel === 'number' && playerLevel > level) lvl = playerLevel;
  const s = def.baseStats;
  return {
    side: 'enemy', name: def.name, affinity: def.affinity, signatureAffinity: def.affinity, level: lvl,
    maxHp: scaleStat(s.hp, def.level, lvl), hp: scaleStat(s.hp, def.level, lvl),
    atk: scaleStat(s.atk, def.level, lvl), def: scaleStat(s.def, def.level, lvl), spd: scaleStat(s.spd, def.level, lvl),
    maxEnergy: 100, energy: 100, statuses: [], buffs: {}, isBoss: def.role === 'regionBoss' || def.role === 'finalBoss',
    skillIds: [...def.skillIds], attackPower: def.attackPower, enemyId: def.id, splitIntoId: def.splitIntoId
  };
}

export function createBattle(player: PlayerBattleInput, enemy: EnemyBattleInput, opts?: { rng?: () => number }): BattleState {
  const playerCombatant: Combatant = {
    side: 'player', name: player.name, affinity: player.signatureAffinity, signatureAffinity: player.signatureAffinity, level: player.level,
    maxHp: player.maxHp, hp: Math.min(player.hp, player.maxHp), atk: player.atk, def: player.def, spd: player.spd,
    maxEnergy: player.maxEnergy, energy: Math.min(player.energy, player.maxEnergy), statuses: [], buffs: {}, isBoss: player.isBoss,
    skillIds: [...player.equippedSkillIds], attackPower: player.attackPower
  };
  playerCombatant.catalystBurstSkillId = player.catalystBurstSkillId;
  const enemyCombatant = buildEnemyCombatant(enemy.def, enemy.level, player.level);
  return {
    player: playerCombatant, enemy: enemyCombatant, enemyQueue: [], turn: 1, chain: 0, catalystBurstReady: false,
    pendingExtraActionFor: [], outcome: 'ongoing', rng: opts?.rng ?? DEFAULT_RNG, log: [], actedThisTurn: { player: false, enemy: false }
  };
}

export function effectiveSpd(c: Combatant): number { return applyStage(c.spd, c.buffs.spd ?? 0); }
export function getTurnOrder(state: BattleState): ('player' | 'enemy')[] {
  const ps = effectiveSpd(state.player), es = effectiveSpd(state.enemy);
  return ps >= es ? ['player', 'enemy'] : ['enemy', 'player'];
}
