import { describe, it, expect } from 'vitest';
import { scoreGauntlet } from '../../src/scenes/shrineScoring';

// passRatio 0.8333 ≈ 5/6 — "miss no more than one" out of six.
describe('scoreGauntlet', () => {
  it('passes when correct/total >= passRatio', () => {
    expect(scoreGauntlet([true, true, true, true, true, false], 0.8333)).toEqual({ correct: 5, total: 6, passed: true });
    expect(scoreGauntlet([true, true, true, true, false, false], 0.8333)).toEqual({ correct: 4, total: 6, passed: false });
  });
  it('an empty gauntlet does not pass', () => { expect(scoreGauntlet([], 0.5).passed).toBe(false); });
  it('100% always passes when passRatio <= 1', () => { expect(scoreGauntlet([true, true], 1).passed).toBe(true); });
});
