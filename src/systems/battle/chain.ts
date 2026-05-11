export const CHAIN_MULTIPLIERS = [1.0, 1.2, 1.5, 1.8, 2.2, 2.6] as const;
export const MAX_CHAIN = CHAIN_MULTIPLIERS.length - 1; // 5

export function chainMultiplier(chain: number): number {
  const i = Math.max(0, Math.min(MAX_CHAIN, Math.floor(chain)));
  return CHAIN_MULTIPLIERS[i]!;
}
export function nextChainOnCorrect(chain: number): number { return Math.min(MAX_CHAIN, chain + 1); }
export function nextChainOnWrong(_chain: number): number { return 0; }
export function isCatalystBurstReady(chain: number): boolean { return chain >= MAX_CHAIN; }
