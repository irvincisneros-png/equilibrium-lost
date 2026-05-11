import { describe, it, expect } from 'vitest';
// Imported from the Phaser-free module (ChainMeter.ts pulls in Phaser, which can't load under node).
import { formatMultiplier } from '../../src/ui/chainFormat';

describe('formatMultiplier', () => {
  it('formats the chain multiplier to one decimal', () => {
    expect(formatMultiplier(0)).toBe('×1.0');
    expect(formatMultiplier(1)).toBe('×1.2');
    expect(formatMultiplier(2)).toBe('×1.5');
    expect(formatMultiplier(3)).toBe('×1.8');
    expect(formatMultiplier(4)).toBe('×2.2');
  });
  it('says BURST READY at full chain', () => {
    expect(formatMultiplier(5)).toBe('BURST READY!');
    expect(formatMultiplier(9)).toBe('BURST READY!');
  });
});
