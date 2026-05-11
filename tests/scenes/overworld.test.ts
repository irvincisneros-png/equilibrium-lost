import { describe, it, expect } from 'vitest';
import { pickWildEncounter, tileBlocks, isTallGrass } from '../../src/scenes/overworldHelpers';
import { loadGameContent } from '../../src/content/loadGameContent';

const region1 = loadGameContent().content.regions[0]!;

describe('overworld helpers', () => {
  it('tileBlocks: water(2) and wall(3) block; grass(0)/path(1)/tall-grass(4) do not', () => {
    expect(tileBlocks(2)).toBe(true);
    expect(tileBlocks(3)).toBe(true);
    expect(tileBlocks(0)).toBe(false);
    expect(tileBlocks(1)).toBe(false);
    expect(tileBlocks(4)).toBe(false);
  });

  it('isTallGrass: only tile id 4 is an encounter zone', () => {
    expect(isTallGrass(4)).toBe(true);
    expect(isTallGrass(0)).toBe(false);
    expect(isTallGrass(2)).toBe(false);
  });

  it("pickWildEncounter returns one of the region's wild enemy ids", () => {
    const e = pickWildEncounter(region1, () => 0.0);
    expect(region1.wildEnemyIds).toContain(e.enemyId);
    const e2 = pickWildEncounter(region1, () => 0.999);
    expect(region1.wildEnemyIds).toContain(e2.enemyId);
    expect(e.level).toBeGreaterThan(0);
  });

  it('pickWildEncounter uses the provided getLevel when supplied', () => {
    const e = pickWildEncounter(region1, () => 0.0, () => 7);
    expect(e.level).toBe(7);
  });
});
