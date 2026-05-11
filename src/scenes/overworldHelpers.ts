import type { RegionDef } from '../content/types';

/**
 * Pure helpers for the overworld — kept out of `OverworldScene` so they can be
 * unit-tested without Phaser. Tile ids: 0=grass, 1=path, 2=water, 3=wall, 4=tall-grass.
 */

/** Water (2) and wall (3) tiles can't be walked onto. */
export function tileBlocks(tileId: number): boolean {
  return tileId === 2 || tileId === 3;
}

/** Tall-grass (4) is the wild-encounter zone. */
export function isTallGrass(tileId: number): boolean {
  return tileId === 4;
}

/**
 * Picks a wild enemy for a region (uniform over `wildEnemyIds`). `getLevel` lets the
 * caller derive the encounter level (in M1 the scene just passes the enemy def's own
 * level); when omitted the level defaults to 1.
 */
export function pickWildEncounter(
  region: RegionDef,
  rng: () => number,
  getLevel?: (enemyId: string) => number,
): { enemyId: string; level: number } {
  const ids = region.wildEnemyIds;
  const idx = Math.max(0, Math.min(ids.length - 1, Math.floor(rng() * ids.length)));
  const enemyId = ids[idx] ?? ids[0]!;
  return { enemyId, level: getLevel ? getLevel(enemyId) : 1 };
}
