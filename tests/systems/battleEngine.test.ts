// tests/systems/battleEngine.test.ts
import { describe, it, expect } from 'vitest';
import { createBattle, getTurnOrder, resolveTurn, buildEnemyCombatant } from '../../src/systems/BattleEngine';
import type { EnemyDef } from '../../src/content/types';
import itemsData from '../../src/content/data/items.json';
const items = itemsData as Record<string, import('../../src/content/types').ItemDef>;
import skillsData from '../../src/content/data/skills.json';
const skills = skillsData as Record<string, import('../../src/content/types').SkillDef>;

const enemy: EnemyDef = { id: 'protium', name: 'Protium', affinity: 'Atomic', baseStats: { hp: 22, atk: 8, def: 4, spd: 6 }, level: 3, attackPower: 22, skillIds: [], xpYield: 14, role: 'wild', spriteKey: 'enemy_protium' };

const playerInput = {
  name: 'Hero', classId: 'pyron', signatureAffinity: 'Combustion' as const, level: 5,
  maxHp: 52, hp: 52, atk: 30, def: 10, spd: 14, maxEnergy: 100, energy: 100,
  equippedSkillIds: ['proton-jab', 'spark-flare', 'shell-shatter'], attackPower: 24, isBoss: false
};

describe('createBattle / getTurnOrder', () => {
  it('builds player and enemy combatants with full HP/energy and empty statuses', () => {
    const s = createBattle(playerInput, { def: enemy, level: enemy.level }, { rng: () => 0.5 });
    expect(s.player.hp).toBe(52); expect(s.enemy.hp).toBe(22);
    expect(s.player.energy).toBe(100);
    expect(s.enemy.affinity).toBe('Atomic');
    expect(s.chain).toBe(0); expect(s.catalystBurstReady).toBe(false); expect(s.outcome).toBe('ongoing');
    expect(s.enemy.skillIds).toEqual([]);
    expect(s.enemy.enemyId).toBe('protium');
  });
  it('turn order is by SPD; faster goes first; ties favour the player', () => {
    const s = createBattle(playerInput, { def: enemy, level: enemy.level }); // player spd 14 > enemy 6
    expect(getTurnOrder(s)).toEqual(['player', 'enemy']);
    const slowPlayer = createBattle({ ...playerInput, spd: 6 }, { def: { ...enemy, baseStats: { ...enemy.baseStats, spd: 9 } }, level: 3 });
    expect(getTurnOrder(slowPlayer)).toEqual(['enemy', 'player']);
    const tie = createBattle({ ...playerInput, spd: 6 }, { def: enemy, level: 3 }); // both 6
    expect(getTurnOrder(tie)).toEqual(['player', 'enemy']);
  });
});

const ctx = {
  getSkill: (id: string) => { throw new Error('no skills in this test ' + id); },
  getItem: (id: string) => { throw new Error('no items ' + id); },
  getEnemyDef: (id: string) => { throw new Error('no enemies ' + id); },
  settings: { answerTimer: false }
} as any;

const skillCtx = { ...ctx, getSkill: (id: string) => { const s = skills[id]; if (!s) throw new Error('unknown skill ' + id); return s; } };
const fullCtx = { ...skillCtx, getItem: (id: string) => { const i = items[id]; if (!i) throw new Error('unknown item ' + id); return i; } };

describe('resolveTurn — basic attacks only', () => {
  it('faster side (player) hits first; both act; player regenerates 25 energy at the start of the turn', () => {
    // attackPower trimmed to 4 so the player's basic attack doesn't one-shot a 22-HP wild enemy:
    // the shipped damage formula has the extra ×attacker.level factor (Task 13), so the plan's
    // original attackPower 24 here would have ended the battle before the enemy could swing.
    const s0 = createBattle({ ...playerInput, energy: 50, attackPower: 4 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const { state, events } = resolveTurn(s0, { kind: 'attack' }, ctx);
    expect(events[0]).toMatchObject({ t: 'turnStart', side: 'player' });
    expect(events.some(e => e.t === 'energyRegen' && (e as any).amount === 25)).toBe(true);
    expect(state.player.energy).toBe(75);
    const firstDmg = events.find(e => e.t === 'damage')! as any;
    expect(firstDmg.target).toBe('enemy'); // player struck first
    expect(state.enemy.hp).toBeLessThan(22);
    expect(state.player.hp).toBeLessThan(52); // enemy also acted
    expect(state.turn).toBe(2); // turn advanced after both acted
  });
  it('runs to playerWin when the enemy faints, and stops resolving once the battle is over', () => {
    let s = createBattle({ ...playerInput, atk: 999 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'attack' }, ctx);
    expect(r.state.outcome).toBe('playerWin');
    expect(r.events.some(e => e.t === 'faint' && (e as any).side === 'enemy')).toBe(true);
    expect(r.events.some(e => e.t === 'outcome' && (e as any).outcome === 'playerWin')).toBe(true);
    // enemy never got to swing because it fainted first (player faster)
    const playerHpEvents = r.events.filter(e => e.t === 'damage' && (e as any).target === 'player');
    expect(playerHpEvents.length).toBe(0);
  });
  it('a no-op on a finished battle returns the same state', () => {
    let s = createBattle({ ...playerInput, atk: 999 }, { def: enemy, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'attack' }, ctx).state;
    const again = resolveTurn(s, { kind: 'attack' }, ctx);
    expect(again.state.outcome).toBe('playerWin');
    expect(again.events).toEqual([]);
  });
});

describe('resolveTurn — skill action', () => {
  it('a correct quiz fires at full power, deducts energy, and ticks the chain up', () => {
    // start at energy 50 so regen fires (+25); spark-flare costs 25; net = 50 + 25 - 25 = 50
    const s0 = createBattle({ ...playerInput, atk: 30, energy: 50, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0.9 }); // rng 0.9: no status proc (chance 30), randFactor ~0.985
    const r = resolveTurn(s0, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx);
    expect(r.state.player.energy).toBe(50 + 25 - 25); // +25 regen, −25 cost
    expect(r.state.chain).toBe(1);
    expect(r.events.some(e => e.t === 'chainChanged' && (e as any).chain === 1)).toBe(true);
    expect(r.state.enemy.hp).toBeLessThan(999);
  });
  it('a wrong quiz fizzles to ~30% and resets the chain', () => {
    let s = createBattle({ ...playerInput, atk: 30, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state; // chain -> 1
    const before = s.enemy.hp;
    const r = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: false }, skillCtx);
    expect(r.events.some(e => e.t === 'quizFizzle')).toBe(true);
    expect(r.state.chain).toBe(0);
    const fizzleDmg = before - r.state.enemy.hp;
    const fullDmgRef = before - resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state.enemy.hp;
    expect(fizzleDmg).toBeLessThan(fullDmgRef * 0.5);
  });
  it('a no-quiz skill (proton-jab, topic null) fires at full power and does NOT touch the chain', () => {
    let s = createBattle({ ...playerInput, atk: 30, equippedSkillIds: ['spark-flare', 'proton-jab'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state; // chain 1
    const r = resolveTurn(s, { kind: 'skill', skillId: 'proton-jab', quizCorrect: null }, skillCtx);
    expect(r.state.chain).toBe(1); // unchanged
    expect(r.state.player.energy).toBe(s.player.energy + 25 - 0); // proton-jab costs 0
  });
  it('reaching chain 5 sets catalystBurstReady', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 99999, atk: 1, def: 99, spd: 1 } }, level: 3 }, { rng: () => 1 });
    for (let i = 0; i < 5; i++) s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state;
    expect(s.chain).toBe(5);
    expect(s.catalystBurstReady).toBe(true);
  });
});

describe('resolveTurn — skill behaviours', () => {
  it('shell-shatter can inflict Oxidised (DEF drain over time)', () => {
    // rng() must be < 0.40 for the status proc (chance 40); use 0 to force it. randFactor becomes 0.85.
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['shell-shatter'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'shell-shatter', quizCorrect: true }, skillCtx);
    expect(r.state.enemy.statuses.some(st => st.id === 'oxidised')).toBe(true);
    // after the end-of-turn tick, def stage should have dropped by 1
    expect(r.state.enemy.buffs.def).toBe(-1);
  });
  it('precipitate strips the target\'s stat buffs', () => {
    let s = createBattle({ ...playerInput, spd: 99, equippedSkillIds: ['precipitate'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s.enemy.buffs = { atk: 2, def: 1 };
    const r = resolveTurn(s, { kind: 'skill', skillId: 'precipitate', quizCorrect: true }, skillCtx);
    expect(r.state.enemy.buffs).toEqual({}); // ...modulo any end-of-turn oxidised tick, which precipitate doesn't apply
    expect(r.events.some(e => e.t === 'buffsStripped' && (e as any).target === 'enemy')).toBe(true);
  });
  it('catalyze grants an extra basic attack the same turn', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['catalyze'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'catalyze', quizCorrect: true }, skillCtx);
    expect(r.events.some(e => e.t === 'extraAction' && (e as any).side === 'player')).toBe(true);
    const playerHits = r.events.filter(e => e.t === 'attack' && (e as any).side === 'player');
    expect(playerHits.length).toBeGreaterThanOrEqual(2); // the catalyze "hit" (power 8) + the free attack
    expect(r.state.enemy.statuses.some(st => st.id === 'catalysed')).toBe(true);
  });
  it('decompose splits a high-HP enemy into two halves: one active now, one queued', () => {
    const enemyCtx = { ...skillCtx, getEnemyDef: (id: string) => { if (id === 'shellfracture-half') return { id, name: 'Shell Fragment', affinity: 'Decomposition', baseStats: { hp: 14, atk: 8, def: 3, spd: 7 }, level: 4, attackPower: 18, skillIds: [], xpYield: 8, role: 'wild', spriteKey: 'enemy_shellfracture_half' } as any; throw new Error('?'); } };
    let s = createBattle({ ...playerInput, atk: 1, spd: 99, equippedSkillIds: ['decompose'] }, { def: { id: 'shellfracture', name: 'Shellfracture', affinity: 'Decomposition', baseStats: { hp: 60, atk: 1, def: 99, spd: 1 }, level: 4, attackPower: 1, skillIds: [], xpYield: 24, role: 'wild', spriteKey: 'enemy_shellfracture', splitIntoId: 'shellfracture-half' } as any, level: 4 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'decompose', quizCorrect: true }, enemyCtx);
    expect(r.state.enemy.enemyId).toBe('shellfracture-half');
    expect(r.state.enemyQueue.length).toBe(1);
    expect(r.state.enemyQueue[0]!.enemyId).toBe('shellfracture-half');
    expect(r.events.some(e => e.t === 'enemySwitch')).toBe(true);
  });
  it('a fizzled skill applies NO behaviours', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['shell-shatter'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'shell-shatter', quizCorrect: false }, skillCtx);
    expect(r.state.enemy.statuses.some(st => st.id === 'oxidised')).toBe(false);
  });
});

describe('chooseEnemyAction', () => {
  it('with skills, picks the highest expected-damage affordable skill (rng above the 25% wildcard)', () => {
    // electrid knows spark-flare (Combustion, power 42). player affinity Combustion vs Combustion -> neutral 1. Still better than basic attack 20.
    let s = createBattle({ ...playerInput, spd: 1 }, { def: { id: 'electrid', name: 'Electrid', affinity: 'Atomic', baseStats: { hp: 9999, atk: 30, def: 4, spd: 99 }, level: 3, attackPower: 20, skillIds: ['spark-flare'], xpYield: 16, role: 'wild', spriteKey: 'enemy_electrid' } as any, level: 3 }, { rng: () => 0.9 });
    const r = resolveTurn(s, { kind: 'attack' }, skillCtx);
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy' && (e as any).skillId === 'spark-flare')).toBe(true);
  });
  it('falls back to a basic attack when the enemy has no skills', () => {
    let s = createBattle({ ...playerInput, spd: 1 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 30, def: 4, spd: 99 } }, level: 3 }, { rng: () => 0.9 });
    const r = resolveTurn(s, { kind: 'attack' }, skillCtx);
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy' && (e as any).skillId === undefined)).toBe(true);
  });
});

describe('resolveTurn — Catalyst Burst', () => {
  const burstPlayer = { ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['spark-flare', 'combustion-cascade'], catalystBurstSkillId: 'combustion-cascade', signatureAffinity: 'Combustion' as const };
  it('is rejected (no-op) when the chain is not full', () => {
    let s = createBattle(burstPlayer, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    expect(s.catalystBurstReady).toBe(false);
    const r = resolveTurn(s, { kind: 'catalystBurst' }, skillCtx);
    // burst didn't fire: enemy only took the enemy's own basic attack damage? no — enemy hp 9999, enemy atk 1 on player; enemy hp unchanged by a no-op burst.
    expect(r.state.enemy.hp).toBe(9999);
  });
  it('when ready: fires the class burst skill at flat ×3, applies its guaranteed status, zeroes the chain', () => {
    let s = createBattle(burstPlayer, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    for (let i = 0; i < 5; i++) s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state;
    expect(s.catalystBurstReady).toBe(true);
    const before = s.enemy.hp;
    const refSkillDmg = before - resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state.enemy.hp; // chain-5 spark-flare hit
    const r = resolveTurn(s, { kind: 'catalystBurst' }, skillCtx);
    expect(before - r.state.enemy.hp).toBeGreaterThan(refSkillDmg); // burst hits harder than a maxed-chain skill
    expect(r.state.enemy.statuses.some(st => st.id === 'combusting')).toBe(true);
    expect(r.state.chain).toBe(0);
    expect(r.state.catalystBurstReady).toBe(false);
  });
});

// ── Task 21: Item action in battle ────────────────────────────────────────────

describe('resolveTurn — items', () => {
  it('minor-buffer heals 25 HP, capped at max', () => {
    const s = createBattle({ ...playerInput, hp: 10, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'minor-buffer' }, fullCtx);
    // healed by ~25 then took a small hit from enemy
    expect(r.state.player.hp).toBeGreaterThan(10);
    expect(r.events.some(e => e.t === 'item' && (e as any).itemId === 'minor-buffer')).toBe(true);
  });
  it('reagent revives a fainted hero — but only if hp is 0', () => {
    // hp starts at 0; reagent restores 50% of maxHp (50); the heal event confirms the amount
    const s = createBattle({ ...playerInput, hp: 0, maxHp: 100, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'reagent' }, fullCtx);
    // verify the revive event fired with amount 50
    const healEvent = r.events.find(e => e.t === 'heal' && (e as any).target === 'player') as any;
    expect(healEvent).toBeDefined();
    expect(healEvent.amount).toBe(50); // 50% of maxHp 100
    expect(r.state.player.hp).toBeGreaterThan(0); // player is no longer fainted
  });
  it('energy-cell restores 50 Energy, capped at max', () => {
    const s = createBattle({ ...playerInput, energy: 30, maxEnergy: 100, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'energy-cell' }, fullCtx);
    // +25 turn regen happens first (energy 55), then +50 cell -> capped at 100
    expect(r.state.player.energy).toBe(100);
  });
  it('a stat booster raises the relevant buff stage', () => {
    const s = createBattle({ ...playerInput, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'atk-catalyst' }, fullCtx);
    expect(r.state.player.buffs.atk).toBe(1);
  });
});

// ── Task 22: Run action — flee succeeds vs wild, fails vs boss ────────────────

describe('resolveTurn — run', () => {
  it('fleeing a wild battle ends it with outcome "fled"', () => {
    const s = createBattle({ ...playerInput, spd: 99 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'run' }, fullCtx);
    expect(r.state.outcome).toBe('fled');
    expect(r.events.some(e => e.t === 'outcome' && (e as any).outcome === 'fled')).toBe(true);
    // the enemy never got to act because the player fled first (faster) and the battle ended
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy')).toBe(false);
  });
  it('fleeing a boss battle fails and wastes the player\'s turn', () => {
    const bossDef = { id: 'the-unstable-isotope', name: 'The Unstable Isotope', affinity: 'Atomic', baseStats: { hp: 140, atk: 16, def: 12, spd: 10 }, level: 9, attackPower: 30, skillIds: [], xpYield: 260, role: 'regionBoss', spriteKey: 'enemy_unstable_isotope', bossSoftScale: true };
    const s = createBattle({ ...playerInput, spd: 99 }, { def: bossDef as any, level: 9 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'run' }, fullCtx);
    expect(r.state.outcome).toBe('ongoing');
    expect(r.events.some(e => e.t === 'fleeFailed')).toBe(true);
    expect(r.state.player.hp).toBeLessThan(s.player.hp); // boss still swung
  });
});

// ── Task 23: Boss soft-scaling + integration battle ───────────────────────────

describe('boss soft-scaling', () => {
  const bossDef = { id: 'the-unstable-isotope', name: 'The Unstable Isotope', affinity: 'Atomic', baseStats: { hp: 140, atk: 16, def: 12, spd: 10 }, level: 9, attackPower: 30, skillIds: ['isotope-flux'], xpYield: 260, role: 'regionBoss', spriteKey: 'enemy_unstable_isotope', bossSoftScale: true } as any;
  it('scales UP to an over-levelled player but never DOWN for an under-levelled one', () => {
    const vsHigh = buildEnemyCombatant(bossDef, 9, 13);
    expect(vsHigh.level).toBe(13);
    expect(vsHigh.maxHp).toBeGreaterThan(140);
    const vsLow = buildEnemyCombatant(bossDef, 9, 5);
    expect(vsLow.level).toBe(9);            // not scaled down — under-levelled players aren't punished further
    expect(vsLow.maxHp).toBe(140);
  });
  it('wild enemies never soft-scale', () => {
    const w = buildEnemyCombatant({ ...bossDef, role: 'wild', bossSoftScale: false } as any, 9, 20);
    expect(w.level).toBe(9);
  });
});

describe('integration — a whole battle resolves deterministically', () => {
  it('a level-9 player beats Protium without fainting (seeded rng)', () => {
    let seed = 12345; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let s = createBattle({ ...playerInput, level: 9, maxHp: 100, hp: 100, atk: 40, def: 18, spd: 18, equippedSkillIds: ['proton-jab', 'spark-flare', 'shell-shatter'] }, { def: enemy, level: 3 }, { rng });
    let guard = 0;
    while (s.outcome === 'ongoing' && guard++ < 50) s = resolveTurn(s, { kind: guard % 2 === 0 ? 'attack' : 'skill', skillId: 'spark-flare', quizCorrect: true } as any, skillCtx).state;
    expect(s.outcome).toBe('playerWin');
    expect(guard).toBeLessThan(50);
  });
});
