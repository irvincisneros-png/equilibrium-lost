// tests/systems/typeChart.test.ts
import { describe, it, expect } from 'vitest';
import { effectiveness } from '../../src/systems/battle/typeChart';
import typeChart from '../../src/content/data/typeChart.json';
import type { TypeChart, Affinity } from '../../src/content/types';

const tc = typeChart as Record<string, Record<string, number>>;
const M = typeChart as TypeChart;

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

describe('full chemistry-coherent type chart (Task 9)', () => {
  it('has the agreed chemistry-flavoured matchups', () => {
    expect(effectiveness(M, 'Acid', 'Metal')).toBe(2);
    expect(effectiveness(M, 'Acid', 'Ionic')).toBe(2);
    expect(effectiveness(M, 'Acid', 'Base')).toBe(0.5);
    expect(effectiveness(M, 'Base', 'Acid')).toBe(2);
    expect(effectiveness(M, 'Base', 'Metal')).toBe(0.5);
    expect(effectiveness(M, 'Base', 'Covalent')).toBe(0.5);
    expect(effectiveness(M, 'Combustion', 'Covalent')).toBe(2);
    expect(effectiveness(M, 'Combustion', 'Decomposition')).toBe(2);
    expect(effectiveness(M, 'Combustion', 'Endothermic')).toBe(0.5);
    expect(effectiveness(M, 'Combustion', 'Metal')).toBe(0.5);
    expect(effectiveness(M, 'Endothermic', 'Exothermic')).toBe(2);
    expect(effectiveness(M, 'Endothermic', 'Combustion')).toBe(2);
    expect(effectiveness(M, 'Exothermic', 'Endothermic')).toBe(2);
    expect(effectiveness(M, 'Exothermic', 'Metal')).toBe(2);
    expect(effectiveness(M, 'Precipitation', 'Ionic')).toBe(2);
    expect(effectiveness(M, 'Precipitation', 'Acid')).toBe(0.5);
    expect(effectiveness(M, 'Synthesis', 'Decomposition')).toBe(2);
    expect(effectiveness(M, 'Synthesis', 'Atomic')).toBe(2);
    expect(effectiveness(M, 'Decomposition', 'Synthesis')).toBe(2);
    expect(effectiveness(M, 'Decomposition', 'Ionic')).toBe(2);
    expect(effectiveness(M, 'Decomposition', 'Metal')).toBe(2);
    expect(effectiveness(M, 'Metal', 'Covalent')).toBe(2);
    expect(effectiveness(M, 'Metal', 'Acid')).toBe(0.5);
    expect(effectiveness(M, 'Covalent', 'Atomic')).toBe(2);
    expect(effectiveness(M, 'Covalent', 'Combustion')).toBe(0.5);
    expect(effectiveness(M, 'Atomic', 'Ionic')).toBe(2);
  });
  it('keeps the like-vs-like fizzle on the reaction-pair affinities', () => {
    for (const a of ['Endothermic', 'Exothermic', 'Synthesis', 'Decomposition'] as const) {
      expect(effectiveness(M, a, a)).toBe(0.5);
    }
  });
  it('keeps Catalyst at 0.5 vs every affinity and Neutral at 1 everywhere', () => {
    const all: Affinity[] = ['Neutral','Atomic','Acid','Base','Metal','Ionic','Covalent','Synthesis','Decomposition','Combustion','Exothermic','Endothermic','Catalyst','Precipitation'];
    for (const d of all) {
      expect(effectiveness(M, 'Catalyst', d)).toBe(0.5);
      expect(effectiveness(M, 'Neutral', d)).toBe(1);
    }
  });
});
