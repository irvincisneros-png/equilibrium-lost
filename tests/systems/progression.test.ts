// tests/systems/progression.test.ts
import { describe, it, expect } from 'vitest';
import { xpToNextLevel, totalXpForLevel, levelForXp, statsForLevel } from '../../src/systems/Progression';
import classesData from '../../src/content/data/classes.json';
import type { ClassDef } from '../../src/content/types';
const classes = classesData as ClassDef[];
const pyron = classes.find(c => c.id === 'pyron')!;

describe('xp / level curves', () => {
  it('xpToNextLevel(L) = 100*L', () => { expect(xpToNextLevel(1)).toBe(100); expect(xpToNextLevel(9)).toBe(900); });
  it('totalXpForLevel(L) = 50*L*(L-1) (cumulative to *reach* level L)', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);   // 0 + 100
    expect(totalXpForLevel(3)).toBe(300);   // 0 + 100 + 200
    expect(totalXpForLevel(10)).toBe(4500);
  });
  it('levelForXp inverts the curve', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(4500)).toBe(10);
  });
});

describe('statsForLevel', () => {
  it('at level 1, stage 0 = baseStats', () => { expect(statsForLevel(pyron, 1, 0)).toEqual(pyron.baseStats); });
  it('grows by `growth` each level beyond 1', () => {
    const l5 = statsForLevel(pyron, 5, 0);
    expect(l5.hp).toBe(pyron.baseStats.hp + pyron.growth.hp * 4);
    expect(l5.atk).toBe(pyron.baseStats.atk + pyron.growth.atk * 4);
  });
  it('adds the evolution statBonus once stage 1 is reached', () => {
    const evo = pyron.evolutions[0]!.statBonus;
    const l10s0 = statsForLevel(pyron, 10, 0);
    const l10s1 = statsForLevel(pyron, 10, 1);
    expect(l10s1.hp).toBe(l10s0.hp + evo.hp);
    expect(l10s1.atk).toBe(l10s0.atk + evo.atk);
  });
});
