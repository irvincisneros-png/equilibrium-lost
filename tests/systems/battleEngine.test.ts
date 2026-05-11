// tests/systems/battleEngine.test.ts
import { describe, it, expect } from 'vitest';
import { createBattle, getTurnOrder } from '../../src/systems/BattleEngine';
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
