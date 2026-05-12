import { describe, it, expect } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';
import elementalReaches from '../../src/content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../../src/content/data/tilemaps/bonding-forge.json';
import reactionHollow from '../../src/content/data/tilemaps/reaction-hollow.json';
import balanceHalls from '../../src/content/data/tilemaps/balance-halls.json';
import catalystCrags from '../../src/content/data/tilemaps/catalyst-crags.json';
import acidWastes from '../../src/content/data/tilemaps/acid-wastes.json';
import type { DialogueNode } from '../../src/content/types';

type AuditTileObject = { type: string; id?: string; x: number; y: number };
type AuditTilemap = { width: number; height: number; ground: number[][]; objects: AuditTileObject[] };

function reachableTilesBeforeGuardian(map: AuditTilemap): Set<string> {
  const spawn = map.objects.find(o => o.type === 'player_spawn');
  expect(spawn).toBeDefined();
  const seen = new Set<string>();
  const queue = [{ x: spawn!.x, y: spawn!.y }];
  const blocks = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    const tile = map.ground[y]?.[x] ?? 0;
    if (tile === 2 || tile === 3) return true;
    if (map.objects.some(o => o.type === 'npc' && o.x === x && o.y === y)) return true;
    if (map.objects.some(o => o.type === 'minibossTrigger' && x === o.x && y === o.y - 1)) return true;
    return false;
  };
  while (queue.length) {
    const tile = queue.shift()!;
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key) || blocks(tile.x, tile.y)) continue;
    seen.add(key);
    queue.push(
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    );
  }
  return seen;
}

function isAdjacentReachable(reachable: Set<string>, object: AuditTileObject): boolean {
  return [
    `${object.x + 1},${object.y}`,
    `${object.x - 1},${object.y}`,
    `${object.x},${object.y + 1}`,
    `${object.x},${object.y - 1}`,
  ].some(tile => reachable.has(tile));
}

describe('shipped content', () => {
  it('loads without throwing and reports no cross-reference warnings', () => {
    const { content, warnings } = loadGameContent();
    expect(warnings).toEqual([]); // all ids resolve; no malformed questions in the shipped file
    expect(content.classes.map(c => c.id).sort()).toEqual(['aqualis', 'ionix', 'pyron']);
  });
  it('Region 1 exists, points at the atomic-structure topic, and has a mini-boss + region boss', () => {
    const { content } = loadGameContent();
    const r1 = content.regions.find(r => r.index === 1)!;
    expect(r1.id).toBe('elemental-reaches');
    expect(r1.topic).toBe('atomic-structure');
    expect(content.enemies[r1.miniBossId]).toBeDefined();
    expect(content.enemies[r1.regionBossId]).toBeDefined();
    expect(content.enemies[r1.regionBossId]!.role).toBe('regionBoss');
  });
  it('every class can equip 5 skills by some level (≥5 skills reachable)', () => {
    const { content } = loadGameContent();
    for (const c of content.classes) {
      const reachable = new Set([...c.startingSkillIds, ...c.skillUnlocks.map(u => u.skillId)]);
      expect(reachable.size).toBeGreaterThanOrEqual(5);
    }
  });
  it('atomic-structure question bank has 40–60 questions spanning all three difficulties', () => {
    const { content } = loadGameContent();
    const qs = content.questions['atomic-structure']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true); // at least one widget question (used by the boss)
  });
  it('every skill id referenced by an enemy exists', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.enemies)) for (const sid of e.skillIds) expect(content.skills[sid], `${e.id} -> ${sid}`).toBeDefined();
  });
  it('each class has exactly one Catalyst Burst skill reachable', () => {
    const { content } = loadGameContent();
    for (const c of content.classes) {
      const reachable = [...c.startingSkillIds, ...c.skillUnlocks.map(u => u.skillId)];
      const bursts = reachable.filter(id => content.skills[id]?.isCatalystBurst);
      expect(bursts.length, c.id).toBe(1);
    }
  });
  it('every content-referenced asset key has both an images entry and a placeholder spec', () => {
    const { content } = loadGameContent();
    const placeholderKeys = new Set(content.assets.placeholders.map(p => p.key));
    const referenced = new Set<string>();
    for (const e of Object.values(content.enemies)) referenced.add(e.spriteKey);
    for (const n of Object.values(content.npcs)) referenced.add(n.spriteKey);
    for (const r of content.regions) { referenced.add(r.tilesetKey); referenced.add(r.battleBackgroundKey); }
    for (const c of content.classes) for (const stage of [0, ...c.evolutions.map(e => e.stage)]) {
      const sk = stage === 0 ? `hero_${c.id}_0` : `hero_${c.id}_${stage}`;
      referenced.add(`${sk}_overworld`); referenced.add(`${sk}_battle`);
    }
    for (const key of referenced) {
      expect(content.assets.images[key], `images[${key}]`).toBeDefined();
      expect(placeholderKeys.has(key), `placeholder[${key}]`).toBe(true);
    }
  });
  it('Region 2 (bonding-forge) exists, index 2, topic "bonding", with a valid mini-boss and region boss; Region 1 unlocks it', () => {
    const { content } = loadGameContent();
    const r2 = content.regions.find(r => r.index === 2)!;
    expect(r2.id).toBe('bonding-forge');
    expect(r2.topic).toBe('bonding');
    expect(content.enemies[r2.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r2.regionBossId]?.role).toBe('regionBoss');
    const r1 = content.regions.find(r => r.index === 1)!;
    expect(r1.unlocksRegionId).toBe('bonding-forge');
  });
  it('bonding question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['bonding']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the bonding-forge tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = bondingForge as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
  it('first-lesson NPCs are reachable before the mini-boss gate in every shipped region', () => {
    const { content } = loadGameContent();
    const maps: Record<string, AuditTilemap> = {
      'elemental-reaches': elementalReaches as AuditTilemap,
      'bonding-forge': bondingForge as AuditTilemap,
      'reaction-hollow': reactionHollow as AuditTilemap,
      'balance-halls': balanceHalls as AuditTilemap,
      'catalyst-crags': catalystCrags as AuditTilemap,
      'acid-wastes': acidWastes as AuditTilemap,
    };
    for (const region of content.regions) {
      const map = maps[region.id];
      expect(map, `${region.id} has no audit tilemap`).toBeDefined();
      if (!map) throw new Error(`${region.id} has no audit tilemap`);
      const firstNpcId = region.npcIds[0];
      const firstNpc = map.objects.find(o => o.type === 'npc' && o.id === firstNpcId);
      expect(firstNpc, `${region.id} missing first NPC ${firstNpcId}`).toBeDefined();
      expect(isAdjacentReachable(reachableTilesBeforeGuardian(map), firstNpc!), `${firstNpcId} is sealed behind the guardian`).toBe(true);
    }
  });
  it('first-lesson NPCs set the topic-based lesson flag the overworld objective reads', () => {
    const { content } = loadGameContent();
    for (const region of content.regions) {
      const firstNpc = content.npcs[region.npcIds[0] ?? ''];
      expect(firstNpc, `${region.id} missing first NPC content`).toBeDefined();
      const flags = firstNpc?.dialogue.map(node => node.setFlag).filter(Boolean);
      expect(flags, `${region.id} first lesson flag`).toContain(`lesson_${region.topic}_seen`);
    }
  });
  it('every NPC dialogue tree is walkable to a terminal node down every branch', () => {
    const { content } = loadGameContent();
    const walk = (tree: DialogueNode[], id: string, seen: Set<string>): void => {
      if (seen.has(id)) return; // guard against cycles
      seen.add(id);
      const node = tree.find(n => n.id === id);
      expect(node, `dangling node "${id}"`).toBeDefined();
      if (!node) return;
      const terminal = node.end === true || (!node.next && !(node.choices && node.choices.length));
      if (terminal) return;
      if (node.choices && node.choices.length) for (const c of node.choices) walk(tree, c.next, new Set(seen));
      else if (node.next) walk(tree, node.next, new Set(seen));
    };
    for (const npc of Object.values(content.npcs)) {
      expect(npc.dialogue.length, `${npc.id} has no dialogue`).toBeGreaterThan(0);
      walk(npc.dialogue, npc.dialogue[0]!.id, new Set());
    }
  });
  it('Region 3 (reaction-hollow) exists, index 3, topic "reaction-types", with a valid mini-boss and region boss; Region 2 unlocks it', () => {
    const { content } = loadGameContent();
    const r3 = content.regions.find(r => r.index === 3)!;
    expect(r3.id).toBe('reaction-hollow');
    expect(r3.topic).toBe('reaction-types');
    expect(content.enemies[r3.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r3.regionBossId]?.role).toBe('regionBoss');
    const r2 = content.regions.find(r => r.index === 2)!;
    expect(r2.unlocksRegionId).toBe('reaction-hollow');
  });
  it('reaction-types question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['reaction-types']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the reaction-hollow tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = reactionHollow as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
  it('Region 4 (balance-halls) exists, index 4, topic "balancing-equations", with a valid mini-boss and region boss; Region 3 unlocks it', () => {
    const { content } = loadGameContent();
    const r4 = content.regions.find(r => r.index === 4)!;
    expect(r4.id).toBe('balance-halls');
    expect(r4.topic).toBe('balancing-equations');
    expect(content.enemies[r4.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r4.regionBossId]?.role).toBe('regionBoss');
    const r3 = content.regions.find(r => r.index === 3)!;
    expect(r3.unlocksRegionId).toBe('balance-halls');
  });
  it('balancing-equations question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['balancing-equations']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the balance-halls tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = balanceHalls as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
  it('Region 5 (catalyst-crags) exists, index 5, topic "reaction-rates", with a valid mini-boss and region boss; Region 4 unlocks it', () => {
    const { content } = loadGameContent();
    const r5 = content.regions.find(r => r.index === 5)!;
    expect(r5.id).toBe('catalyst-crags');
    expect(r5.topic).toBe('reaction-rates');
    expect(content.enemies[r5.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r5.regionBossId]?.role).toBe('regionBoss');
    const r4 = content.regions.find(r => r.index === 4)!;
    expect(r4.unlocksRegionId).toBe('catalyst-crags');
  });
  it('reaction-rates question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['reaction-rates']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the catalyst-crags tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = catalystCrags as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
  it('Region 6 (acid-wastes) exists, index 6, topic "acids-bases", with a valid mini-boss and region boss; Region 5 unlocks it', () => {
    const { content } = loadGameContent();
    const r6 = content.regions.find(r => r.index === 6)!;
    expect(r6.id).toBe('acid-wastes');
    expect(r6.topic).toBe('acids-bases');
    expect(content.enemies[r6.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r6.regionBossId]?.role).toBe('regionBoss');
    const r5 = content.regions.find(r => r.index === 5)!;
    expect(r5.unlocksRegionId).toBe('acid-wastes');
  });
  it('acids-bases question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['acids-bases']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the acid-wastes tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = acidWastes as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
});
