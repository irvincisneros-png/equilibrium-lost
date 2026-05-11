// tests/systems/battleEngine.test.ts
import { describe, it, expect } from 'vitest';
import { createBattle, getTurnOrder, resolveTurn } from '../../src/systems/BattleEngine';
import type { EnemyDef } from '../../src/content/types';
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
