import type { StatusId } from '../../content/types';
import { type BattleEvent, type Combatant, clone, clampStage } from './types';

export function hasStatus(c: Combatant, id: StatusId): boolean { return c.statuses.some(s => s.id === id); }

export function applyStatus(c: Combatant, spec: { id: StatusId; turns: number; magnitude: number }): { combatant: Combatant; events: BattleEvent[] } {
  const next = clone(c);
  const existing = next.statuses.find(s => s.id === spec.id);
  if (existing) { existing.turnsRemaining = Math.max(existing.turnsRemaining, spec.turns); existing.magnitude = Math.max(existing.magnitude, spec.magnitude); }
  else next.statuses.push({ id: spec.id, turnsRemaining: spec.turns, magnitude: spec.magnitude });
  return { combatant: next, events: [{ t: 'statusApplied', target: c.side, id: spec.id, turns: spec.turns }] };
}

/** End-of-turn tick for one combatant: dot damage, stat drains, refresh catalysed spd, decrement, expire. */
export function tickStatuses(c: Combatant): { combatant: Combatant; events: BattleEvent[] } {
  const next = clone(c);
  const events: BattleEvent[] = [];
  for (const s of next.statuses) {
    switch (s.id) {
      case 'dissolved':
      case 'combusting': {
        const dmg = Math.max(0, s.magnitude);
        next.hp = Math.max(0, next.hp - dmg);
        events.push({ t: 'statusTick', target: c.side, id: s.id, damage: dmg });
        break;
      }
      case 'oxidised':
        next.buffs.def = clampStage((next.buffs.def ?? 0) - 1);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'endothermicChill':
        next.buffs.atk = clampStage((next.buffs.atk ?? 0) - 1);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'catalysed':
        next.buffs.spd = Math.max(next.buffs.spd ?? 0, 2);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'precipitated':
        // consumed by consumePrecipitated() in the engine before acting; nothing on tick
        break;
    }
  }
  // decrement & expire
  const survivors = [];
  for (const s of next.statuses) {
    s.turnsRemaining -= 1;
    if (s.turnsRemaining <= 0) events.push({ t: 'statusExpired', target: c.side, id: s.id });
    else survivors.push(s);
  }
  next.statuses = survivors;
  return { combatant: next, events };
}

/** If the combatant is precipitated, remove it and report that they skip this action. */
export function consumePrecipitated(c: Combatant): { combatant: Combatant; skipped: boolean } {
  if (!hasStatus(c, 'precipitated')) return { combatant: c, skipped: false };
  const next = clone(c);
  next.statuses = next.statuses.filter(s => s.id !== 'precipitated');
  return { combatant: next, skipped: true };
}
