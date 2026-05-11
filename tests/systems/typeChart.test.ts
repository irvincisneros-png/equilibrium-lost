// tests/systems/typeChart.test.ts
import { describe, it, expect } from 'vitest';
import { effectiveness } from '../../src/systems/battle/typeChart';
import typeChart from '../../src/content/data/typeChart.json';

const tc = typeChart as Record<string, Record<string, number>>;

describe('effectiveness(typeChart, attacker, defender)', () => {
  it('Base is super-effective vs Acid (neutralisation)', () => { expect(effectiveness(tc, 'Base', 'Acid')).toBe(2); });
  it('Acid is super-effective vs Metal and vs Ionic', () => {
    expect(effectiveness(tc, 'Acid', 'Metal')).toBe(2);
    expect(effectiveness(tc, 'Acid', 'Ionic')).toBe(2);
  });
  it('Endothermic counters Exothermic and Combustion', () => {
    expect(effectiveness(tc, 'Endothermic', 'Exothermic')).toBe(2);
    expect(effectiveness(tc, 'Endothermic', 'Combustion')).toBe(2);
  });
  it('Acid vs Base is resisted (0.5)', () => { expect(effectiveness(tc, 'Acid', 'Base')).toBe(0.5); });
  it('Catalyst skills deal chip damage to everything (0.5)', () => { expect(effectiveness(tc, 'Catalyst', 'Atomic')).toBe(0.5); });
  it('unspecified matchups are neutral (1)', () => { expect(effectiveness(tc, 'Atomic', 'Atomic')).toBe(1); expect(effectiveness(tc, 'Neutral', 'Ionic')).toBe(1); });
});
