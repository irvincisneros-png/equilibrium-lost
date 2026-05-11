// tests/systems/progression.test.ts
import { describe, it, expect } from 'vitest';
import { xpToNextLevel, totalXpForLevel, levelForXp } from '../../src/systems/Progression';

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
