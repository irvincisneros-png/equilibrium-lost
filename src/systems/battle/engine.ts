import type { EnemyDef, Affinity, SkillDef, ItemDef, TypeChart } from '../../content/types';
import { type BattleState, type Combatant, type BattleEvent, type BattleAction, applyStage, clone, clampStage } from './types';
import { effectiveness } from './typeChart';
import { computeDamage } from './damage';
import { MAX_CHAIN, chainMultiplier } from './chain';
import { tickStatuses, consumePrecipitated, applyStatus } from './status';
import typeChartData from '../../content/data/typeChart.json';

const TYPE_CHART = typeChartData as TypeChart;

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

export interface BattleContext {
  getSkill(id: string): SkillDef;
  getItem(id: string): ItemDef;
  getEnemyDef(id: string): EnemyDef;
  settings: { answerTimer: boolean };
}
export interface TurnResult { state: BattleState; events: BattleEvent[]; }

const REGEN_PER_TURN = 25;

function other(side: 'player' | 'enemy'): 'player' | 'enemy' { return side === 'player' ? 'enemy' : 'player'; }

// Replaced properly in Task 19 (resolves the player's class Catalyst Burst skill from ctx).
function resolveBurstSkill(attacker: Combatant, ctx: BattleContext): SkillDef | null {
  if (!attacker.catalystBurstSkillId) return null;
  try { return ctx.getSkill(attacker.catalystBurstSkillId); } catch { return null; }
}
// Replaced properly in Task 20 (enemy AI: pick best affordable skill, 25% wildcard basic attack).
function chooseEnemyAction(state: BattleState, ctx: BattleContext): BattleAction {
  const e = state.enemy;
  if (state.rng() < 0.25) return { kind: 'attack' };
  let best: { id: string; score: number } | null = null;
  for (const id of e.skillIds) {
    let skill: SkillDef; try { skill = ctx.getSkill(id); } catch { continue; }
    if (skill.energyCost > e.energy) continue;
    const score = Math.max(1, skill.power) * effectiveness(TYPE_CHART, skill.affinity, state.player.affinity);
    if (!best || score > best.score) best = { id, score };
  }
  return best ? { kind: 'skill', skillId: best.id, quizCorrect: null } : { kind: 'attack' };
}

/** Apply ONE combatant's action to a (mutable) working state. Returns events + whether a free follow-up attack was granted. */
function applyAction(state: BattleState, side: 'player' | 'enemy', action: BattleAction, ctx: BattleContext): { events: BattleEvent[]; grantedExtraAttack: boolean } {
  const events: BattleEvent[] = [];
  const attacker = state[side];
  const defSide = other(side);
  let defender = state[defSide];
  let grantedExtraAttack = false;

  const dealDamage = (power: number, isSkill: boolean, affinity: Affinity, quizCorrect: boolean | null, crit: boolean, isBurst = false) => {
    const typeMult = effectiveness(TYPE_CHART, affinity, defender.affinity);
    events.push({ t: 'attack', side, skillId: isSkill ? (action as any).skillId : undefined, affinity });
    const dmg = computeDamage({ attacker: { level: attacker.level, atk: attacker.atk, def: attacker.def, spd: attacker.spd, signatureAffinity: attacker.signatureAffinity, buffs: attacker.buffs },
      defenderDef: defender.def, defenderBuffs: defender.buffs, power, isSkill, skillAffinity: affinity, typeMult, chain: state.chain,
      quizCorrect, crit, isCatalystBurst: isBurst, rng: state.rng });
    defender.hp = Math.max(0, defender.hp - dmg);
    events.push({ t: 'damage', target: defSide, amount: dmg, effectiveness: typeMult, crit });
    return typeMult;
  };

  switch (action.kind) {
    case 'attack':
      dealDamage(attacker.attackPower, false, 'Neutral', null, false);
      break;

    case 'skill': {
      const skill = ctx.getSkill(action.skillId);
      if (!attacker.skillIds.includes(skill.id)) break; // not equipped — no-op (scene shouldn't allow it)
      if (attacker.energy < skill.energyCost) break;     // not enough energy — no-op (scene gates this)
      attacker.energy -= skill.energyCost;
      const hasQuiz = skill.topic !== null;
      const correct = hasQuiz ? action.quizCorrect : null;
      const fizzled = hasQuiz && correct === false;
      const crit = !!ctx.settings.answerTimer && !!action.fastAnswer && correct === true;
      if (fizzled) events.push({ t: 'quizFizzle', skillId: skill.id });
      const typeMult = skill.power > 0 ? dealDamage(skill.power, true, skill.affinity, correct, crit) : effectiveness(TYPE_CHART, skill.affinity, defender.affinity);
      void typeMult; // computed for parity with the plan; unused for now (utility-skill type-effectiveness telemetry lands later)
      // chain update (only quizzed skills touch the chain)
      if (hasQuiz) {
        state.chain = correct ? Math.min(MAX_CHAIN, state.chain + 1) : 0;
        state.catalystBurstReady = state.chain >= MAX_CHAIN;
        events.push({ t: 'chainChanged', chain: state.chain, multiplier: chainMultiplier(state.chain), burstReady: state.catalystBurstReady });
      }
      // behaviours — only on a non-fizzled hit
      if (!fizzled && skill.behavior) {
        const b = skill.behavior;
        if (b.healPercent) { const heal = Math.floor(attacker.maxHp * b.healPercent / 100); attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal); events.push({ t: 'heal', target: side, amount: heal }); }
        if (b.stripBuffs) { defender.buffs = {}; events.push({ t: 'buffsStripped', target: defSide }); }
        if (b.applyStatus && state.rng() * 100 <= b.applyStatus.chance) {
          const ap = applyStatus(defender, { id: b.applyStatus.id, turns: b.applyStatus.turns, magnitude: b.applyStatus.magnitude });
          state[defSide] = ap.combatant; defender = state[defSide]; events.push(...ap.events);
        }
        if (b.splitTarget && defSide === 'enemy' && defender.splitIntoId && defender.enemyId !== defender.splitIntoId) {
          const halfDef = ctx.getEnemyDef(defender.splitIntoId);
          const mk = () => buildEnemyCombatant(halfDef, defender.level);
          const h1 = mk(), h2 = mk();
          state.enemy = h1; state.enemyQueue = [...state.enemyQueue, h2];
          events.push({ t: 'enemySwitch', toName: h1.name, toEnemyId: h1.enemyId! });
          defender = state.enemy;
        }
        if (b.grantExtraAction) grantedExtraAttack = true;
      }
      break;
    }

    case 'catalystBurst': {
      if (side !== 'player' || !state.catalystBurstReady) break;
      const burst = resolveBurstSkill(attacker, ctx);
      if (burst) {
        if (burst.power > 0) dealDamage(burst.power, true, burst.affinity, true, false, true);
        else { events.push({ t: 'attack', side, skillId: burst.id, affinity: burst.affinity }); }
        if (burst.behavior) {
          if (burst.behavior.stripBuffs) { defender.buffs = {}; events.push({ t: 'buffsStripped', target: defSide }); }
          if (burst.behavior.applyStatus) { const ap = applyStatus(defender, { id: burst.behavior.applyStatus.id, turns: burst.behavior.applyStatus.turns, magnitude: burst.behavior.applyStatus.magnitude }); state[defSide] = ap.combatant; defender = state[defSide]; events.push(...ap.events); }
        }
      } else {
        // fallback: triple the highest-power equipped quizzed skill
        dealDamage(45, true, attacker.affinity, true, false, true);
      }
      state.chain = 0; state.catalystBurstReady = false;
      events.push({ t: 'chainChanged', chain: 0, multiplier: chainMultiplier(0), burstReady: false });
      break;
    }

    case 'item': {
      const item = ctx.getItem(action.itemId);
      const e = item.effect;
      let healed = 0;
      if (attacker.hp <= 0 && e.revive) { healed = Math.floor(attacker.maxHp * (e.reviveHpPercent ?? 50) / 100); attacker.hp = healed; }
      else if (attacker.hp > 0) {
        if (e.healHp) healed += e.healHp;
        if (e.healHpPercent) healed += Math.floor(attacker.maxHp * e.healHpPercent / 100);
        if (healed) attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
      }
      if (e.restoreEnergy) attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + e.restoreEnergy);
      if (e.statBoostStages) for (const [k, d] of Object.entries(e.statBoostStages)) attacker.buffs[k as keyof typeof attacker.buffs] = clampStage((attacker.buffs[k as keyof typeof attacker.buffs] ?? 0) + (d as number));
      events.push({ t: 'item', itemId: item.id, target: side });
      if (healed) events.push({ t: 'heal', target: side, amount: healed });
      break;
    }

    case 'run': {
      if (side !== 'player') break;
      if (state.enemy.isBoss) { events.push({ t: 'fleeFailed' }); break; }
      state.outcome = 'fled'; events.push({ t: 'outcome', outcome: 'fled' });
      break;
    }
  }
  return { events, grantedExtraAttack };
}

function settleFaints(state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (state.player.hp <= 0) { state.outcome = 'playerLose'; events.push({ t: 'faint', side: 'player' }, { t: 'outcome', outcome: 'playerLose' }); return events; }
  if (state.enemy.hp <= 0) {
    events.push({ t: 'faint', side: 'enemy' });
    if (state.enemyQueue.length > 0) { const next = state.enemyQueue.shift()!; state.enemy = next; events.push({ t: 'enemySwitch', toName: next.name, toEnemyId: next.enemyId! }); }
    else { state.outcome = 'playerWin'; events.push({ t: 'outcome', outcome: 'playerWin' }); }
  }
  return events;
}

export function resolveTurn(prev: BattleState, playerAction: BattleAction, ctx: BattleContext): TurnResult {
  if (prev.outcome !== 'ongoing') return { state: prev, events: [] };
  // structuredClone throws on functions — clone the state without `rng`, then restore the live reference.
  const state = clone({ ...prev, rng: undefined as unknown as () => number });
  state.rng = prev.rng;
  const events: BattleEvent[] = [];
  const enemyAction = chooseEnemyAction(state, ctx);
  for (const side of getTurnOrder(state)) {
    if (state.outcome !== 'ongoing') break;
    events.push({ t: 'turnStart', side, turn: state.turn });
    if (side === 'player') {
      const regen = Math.min(REGEN_PER_TURN, state.player.maxEnergy - state.player.energy);
      if (regen > 0) { state.player.energy += regen; events.push({ t: 'energyRegen', side: 'player', amount: regen }); }
    }
    const cp = consumePrecipitated(state[side]); state[side] = cp.combatant;
    if (cp.skipped) { events.push({ t: 'precipitatedSkip', side }); continue; }
    const act = side === 'player' ? playerAction : enemyAction;
    const r = applyAction(state, side, act, ctx); events.push(...r.events);
    events.push(...settleFaints(state));
    if (r.grantedExtraAttack && state.outcome === 'ongoing') {
      events.push({ t: 'extraAction', side });
      const r2 = applyAction(state, side, { kind: 'attack' }, ctx); events.push(...r2.events);
      events.push(...settleFaints(state));
    }
  }
  if (state.outcome === 'ongoing') {
    for (const side of ['player', 'enemy'] as const) { const tr = tickStatuses(state[side]); state[side] = tr.combatant; events.push(...tr.events); }
    events.push(...settleFaints(state));
    if (state.outcome === 'ongoing') state.turn += 1;
  }
  state.log = [...prev.log, ...events];
  return { state, events };
}
