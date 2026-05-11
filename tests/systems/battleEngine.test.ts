// tests/systems/battleEngine.test.ts
import { describe, it, expect } from 'vitest';
import { createBattle, getTurnOrder, resolveTurn } from '../../src/systems/BattleEngine';
import type { EnemyDef } from '../../src/content/types';

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
