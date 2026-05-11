// tests/systems/status.test.ts
import { describe, it, expect } from 'vitest';
import { applyStatus, tickStatuses, hasStatus, consumePrecipitated } from '../../src/systems/battle/status';
import type { Combatant } from '../../src/systems/battle/types';

function combatant(over: Partial<Combatant> = {}): Combatant {
  return { side: 'enemy', name: 'X', affinity: 'Atomic', signatureAffinity: 'Atomic', level: 5, maxHp: 50, hp: 50, atk: 10, def: 10, spd: 10,
    maxEnergy: 100, energy: 100, statuses: [], buffs: {}, isBoss: false, skillIds: [], attackPower: 20, ...over };
}

describe('status effects', () => {
  it('applyStatus adds (and refreshes) an instance and logs', () => {
    let c = combatant();
    const r = applyStatus(c, { id: 'dissolved', turns: 2, magnitude: 4 });
    expect(hasStatus(r.combatant, 'dissolved')).toBe(true);
    expect(r.events[0]).toMatchObject({ t: 'statusApplied', id: 'dissolved', turns: 2 });
    const r2 = applyStatus(r.combatant, { id: 'dissolved', turns: 3, magnitude: 4 });
    expect(r2.combatant.statuses.filter(s => s.id === 'dissolved').length).toBe(1);
    expect(r2.combatant.statuses.find(s => s.id === 'dissolved')!.turnsRemaining).toBe(3); // refreshed to the longer
  });
  it('dissolved & combusting deal magnitude damage on tick', () => {
    let c = combatant({ statuses: [{ id: 'dissolved', turnsRemaining: 2, magnitude: 4 }, { id: 'combusting', turnsRemaining: 1, magnitude: 5 }] });
    const r = tickStatuses(c);
    expect(r.combatant.hp).toBe(50 - 4 - 5);
    expect(r.events.filter(e => e.t === 'statusTick').length).toBe(2);
  });
  it('oxidised drains DEF stage, endothermicChill drains ATK stage, each tick (min -6)', () => {
    let c = combatant({ statuses: [{ id: 'oxidised', turnsRemaining: 2, magnitude: 0 }, { id: 'endothermicChill', turnsRemaining: 2, magnitude: 0 }] });
    const r = tickStatuses(c);
    expect(r.combatant.buffs.def).toBe(-1);
    expect(r.combatant.buffs.atk).toBe(-1);
  });
  it('catalysed sets spd stage to at least +2 while active', () => {
    let c = combatant({ statuses: [{ id: 'catalysed', turnsRemaining: 2, magnitude: 0 }] });
    expect(tickStatuses(c).combatant.buffs.spd).toBeGreaterThanOrEqual(2);
  });
  it('turnsRemaining decrements; status removed and logged at 0', () => {
    let c = combatant({ statuses: [{ id: 'combusting', turnsRemaining: 1, magnitude: 3 }] });
    const r = tickStatuses(c);
    expect(hasStatus(r.combatant, 'combusting')).toBe(false);
    expect(r.events.some(e => e.t === 'statusExpired' && (e as any).id === 'combusting')).toBe(true);
  });
  it('a tick that brings hp to 0 leaves hp at 0 (faint handled by the engine)', () => {
    let c = combatant({ hp: 3, statuses: [{ id: 'dissolved', turnsRemaining: 2, magnitude: 10 }] });
    expect(tickStatuses(c).combatant.hp).toBe(0);
  });
  it('consumePrecipitated removes the status and reports true when present', () => {
    let c = combatant({ statuses: [{ id: 'precipitated', turnsRemaining: 1, magnitude: 0 }] });
    const r = consumePrecipitated(c);
    expect(r.skipped).toBe(true);
    expect(hasStatus(r.combatant, 'precipitated')).toBe(false);
    expect(consumePrecipitated(combatant()).skipped).toBe(false);
  });
});
