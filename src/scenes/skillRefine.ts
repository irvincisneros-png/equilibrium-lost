import type { GameContent, SaveData } from '../content/types';
import { MAX_TIER, REFINE_TIER_COSTS, TIER_DELTA } from '../systems/skillTiers';

export interface RefinePreview {
  tier: number;              // current tier (0..MAX_TIER)
  atMax: boolean;
  nextTier: number | null;   // null if already at MAX_TIER
  cost: number | null;       // RP cost of the next tier, or null at MAX_TIER
  canAfford: boolean;        // save.reagentPoints >= cost (false at MAX_TIER)
  delta: { power: number; statusChance: number; energyCost: number }; // the per-tier deltas (display only)
}

function currentTier(save: SaveData, skillId: string): number {
  const t = save.skillTiers[skillId] ?? 0;
  return Math.max(0, Math.min(MAX_TIER, Math.floor(t)));
}

/** Pure: never mutates `save`. */
export function previewRefine(save: SaveData, skillId: string, _content: GameContent): RefinePreview {
  const tier = currentTier(save, skillId);
  const atMax = tier >= MAX_TIER;
  const cost = atMax ? null : (REFINE_TIER_COSTS[tier] ?? null);
  return {
    tier,
    atMax,
    nextTier: atMax ? null : tier + 1,
    cost,
    canAfford: cost != null && save.reagentPoints >= cost,
    delta: { power: TIER_DELTA.power, statusChance: TIER_DELTA.statusChance, energyCost: TIER_DELTA.energyCost },
  };
}

/** Validates, then mutates `save` (caller persists via SaveManager). */
export function applyRefine(save: SaveData, skillId: string, content: GameContent):
  | { ok: true; tier: number; reagentPoints: number }
  | { ok: false; reason: string } {
  if (!content.skills[skillId]) return { ok: false, reason: `Unknown skill ${skillId}.` };
  if (!save.unlockedSkillIds.includes(skillId)) return { ok: false, reason: `You haven't learned ${content.skills[skillId]!.name} yet.` };
  const tier = currentTier(save, skillId);
  if (tier >= MAX_TIER) return { ok: false, reason: `${content.skills[skillId]!.name} is already fully refined.` };
  const cost = REFINE_TIER_COSTS[tier] ?? 0;
  if (save.reagentPoints < cost) return { ok: false, reason: `Need ${cost} Reagent Points (you have ${save.reagentPoints}).` };
  save.skillTiers[skillId] = tier + 1;
  save.reagentPoints -= cost;
  return { ok: true, tier: tier + 1, reagentPoints: save.reagentPoints };
}
