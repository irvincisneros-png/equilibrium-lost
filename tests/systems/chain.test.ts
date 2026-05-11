// tests/systems/chain.test.ts
import { describe, it, expect } from 'vitest';
import { CHAIN_MULTIPLIERS, MAX_CHAIN, chainMultiplier, nextChainOnCorrect, nextChainOnWrong, isCatalystBurstReady } from '../../src/systems/battle/chain';

describe('chain reaction', () => {
  it('multiplier table is the locked one and indexed by chain level', () => {
    expect(CHAIN_MULTIPLIERS).toEqual([1.0, 1.2, 1.5, 1.8, 2.2, 2.6]);
    expect(MAX_CHAIN).toBe(5);
    expect(chainMultiplier(0)).toBe(1.0);
    expect(chainMultiplier(3)).toBe(1.8);
    expect(chainMultiplier(5)).toBe(2.6);
    expect(chainMultiplier(99)).toBe(2.6); // clamps
  });
  it('a correct answer increments, capped at MAX_CHAIN', () => {
    expect(nextChainOnCorrect(0)).toBe(1);
    expect(nextChainOnCorrect(4)).toBe(5);
    expect(nextChainOnCorrect(5)).toBe(5);
  });
  it('a wrong answer resets to 0', () => { expect(nextChainOnWrong(4)).toBe(0); expect(nextChainOnWrong(0)).toBe(0); });
  it('Catalyst Burst is ready only at full chain', () => {
    expect(isCatalystBurstReady(4)).toBe(false);
    expect(isCatalystBurstReady(5)).toBe(true);
  });
});
