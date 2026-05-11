import { CHAIN_MULTIPLIERS, MAX_CHAIN } from '../systems/battle/chain';

/**
 * Renders the Chain-Reaction multiplier for the HUD: `×1.0` … `×2.6`, or
 * `BURST READY!` once the chain is maxed. Pure (Phaser-free) so it can be unit-tested;
 * `ChainMeter` re-exports it.
 */
export function formatMultiplier(chain: number): string {
  if (chain >= MAX_CHAIN) return 'BURST READY!';
  const m = CHAIN_MULTIPLIERS[Math.max(0, Math.min(MAX_CHAIN - 1, Math.floor(chain)))]!;
  return '×' + m.toFixed(1);
}
