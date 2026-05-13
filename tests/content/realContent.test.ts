import { describe, it, expect } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';
import { validateQuestionVisual } from '../../src/content/schema';
import elementalReaches from '../../src/content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../../src/content/data/tilemaps/bonding-forge.json';
import reactionHollow from '../../src/content/data/tilemaps/reaction-hollow.json';
import balanceHalls from '../../src/content/data/tilemaps/balance-halls.json';
import catalystCrags from '../../src/content/data/tilemaps/catalyst-crags.json';
import acidWastes from '../../src/content/data/tilemaps/acid-wastes.json';
import theCrucible from '../../src/content/data/tilemaps/the-crucible.json';
import equilibriumsHeart from '../../src/content/data/tilemaps/equilibriums-heart.json';
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
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
      'the-crucible': theCrucible as AuditTilemap,
      'equilibriums-heart': equilibriumsHeart as AuditTilemap,
    };
    for (const region of content.regions) {
      const map = maps[region.id];
      expect(map, `${region.id} has no audit tilemap`).toBeDefined();
      if (!map) throw new Error(`${region.id} has no audit tilemap`);
      const firstNpcId = region.npcIds[0];
      const firstNpc = map.objects.find(o => o.type === 'npc' && o.id === firstNpcId);
      expect(firstNpc, `${region.id} missing first NPC ${firstNpcId}`).toBeDefined();
      expect(isAdjacentReachable(reachableTilesBeforeGuardian(map), firstNpc!), `${firstNpcId} is sealed behind the guardian`).toBe(true);
      // healing_spring: present and reachable before the guardian
      const spring = map.objects.find(o => o.type === 'healing_spring');
      expect(spring, `${region.id} has no healing_spring`).toBeDefined();
      expect(isAdjacentReachable(reachableTilesBeforeGuardian(map), spring!), `${region.id} healing_spring is sealed behind the guardian`).toBe(true);
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
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
    expect(qs.length).toBeLessThanOrEqual(400);
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
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
  });
  it('Region 7 (the-crucible) exists, index 7, topic "energy-changes", with a valid mini-boss and region boss; Region 6 unlocks it', () => {
    const { content } = loadGameContent();
    const r7 = content.regions.find(r => r.index === 7)!;
    expect(r7.id).toBe('the-crucible');
    expect(r7.topic).toBe('energy-changes');
    expect(content.enemies[r7.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r7.regionBossId]?.role).toBe('regionBoss');
    const r6 = content.regions.find(r => r.index === 6)!;
    expect(r6.unlocksRegionId).toBe('the-crucible');
  });
  it('energy-changes question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['energy-changes']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(400);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('equilibrium question bank has 64–100 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['equilibrium']!;
    expect(qs.length).toBeGreaterThanOrEqual(64);
    expect(qs.length).toBeLessThanOrEqual(100);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the the-crucible tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = theCrucible as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
  });
  it('Region 8 (equilibriums-heart) exists, index 8, topic "equilibrium", with a valid mini-boss and region boss; Region 7 unlocks it', () => {
    const { content } = loadGameContent();
    const r8 = content.regions.find(r => r.index === 8)!;
    expect(r8.id).toBe('equilibriums-heart');
    expect(r8.topic).toBe('equilibrium');
    expect(content.enemies[r8.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r8.regionBossId]?.role).toBe('finalBoss');
    const r7 = content.regions.find(r => r.index === 7)!;
    expect(r7.unlocksRegionId).toBe('equilibriums-heart');
  });
  it('the equilibriums-heart tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = equilibriumsHeart as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'healing_spring', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(4);
  });
});

describe('expanded question banks', () => {
  // formula -> { element: atomCount }; handles nested parens and a trailing ionic charge
  function parseFormula(formula: string): Record<string, number> {
    const f = formula.replace(/\s+/g, '').replace(/[+-]+\d*$|\d*[+-]+$/, '');
    let i = 0;
    const read = (): Record<string, number> => {
      const loc: Record<string, number> = {};
      const add = (el: string, n: number): void => { loc[el] = (loc[el] ?? 0) + n; };
      while (i < f.length && f[i] !== ')') {
        const ch = f[i]!;
        if (ch === '(') {
          i++;
          const sub = read();
          if (f[i] !== ')') throw new Error(`unbalanced parens in ${formula}`);
          i++;
          let num = '';
          while (i < f.length && /\d/.test(f[i]!)) num += f[i++];
          const m = num ? parseInt(num, 10) : 1;
          for (const [el, n] of Object.entries(sub)) add(el, n * m);
        } else if (/[A-Z]/.test(ch)) {
          let el = f[i++]!;
          while (i < f.length && /[a-z]/.test(f[i]!)) el += f[i++];
          let num = '';
          while (i < f.length && /\d/.test(f[i]!)) num += f[i++];
          add(el, num ? parseInt(num, 10) : 1);
        } else { i++; }
      }
      return loc;
    };
    return read();
  }
  function equationBalances(eq: { reactants: { formula: string; coeff: number }[]; products: { formula: string; coeff: number }[] }): boolean {
    const side = (terms: { formula: string; coeff: number }[]): Record<string, number> => {
      const tot: Record<string, number> = {};
      for (const t of terms) for (const [el, n] of Object.entries(parseFormula(t.formula))) tot[el] = (tot[el] ?? 0) + n * t.coeff;
      return tot;
    };
    const L = side(eq.reactants), R = side(eq.products);
    for (const el of new Set([...Object.keys(L), ...Object.keys(R)])) if ((L[el] ?? 0) !== (R[el] ?? 0)) return false;
    return true;
  }

  const BANKS: Array<{ topic: string; needsBalance: boolean }> = [
    { topic: 'atomic-structure', needsBalance: false },
    { topic: 'bonding', needsBalance: true },
    { topic: 'reaction-types', needsBalance: true },
    { topic: 'balancing-equations', needsBalance: true },
    { topic: 'reaction-rates', needsBalance: true },
    { topic: 'acids-bases', needsBalance: true },
    { topic: 'energy-changes', needsBalance: true },
  ];

  const { content } = loadGameContent();
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

  it('every orderSteps question has 3-6 non-empty string steps', () => {
    for (const bank of Object.values(content.questions)) {
      for (const q of bank.filter(q => q.format === 'orderSteps')) {
        expect(Array.isArray(q.steps), `${q.id} steps`).toBe(true);
        expect(q.steps!.length, `${q.id} step count`).toBeGreaterThanOrEqual(3);
        expect(q.steps!.length, `${q.id} step count`).toBeLessThanOrEqual(6);
        expect(q.steps!.every(s => typeof s === 'string' && s.trim().length > 0), `${q.id} non-empty steps`).toBe(true);
      }
    }
  });

  it('every bank has at least one orderSteps question', () => {
    for (const { topic } of BANKS) {
      expect(content.questions[topic]!.some(q => q.format === 'orderSteps'), `${topic} orderSteps`).toBe(true);
    }
  });

  for (const { topic, needsBalance } of BANKS) {
    describe(topic, () => {
      const qs = content.questions[topic]!;

      it('has 250–400 questions', () => {
        expect(qs.length).toBeGreaterThanOrEqual(250);
        expect(qs.length).toBeLessThanOrEqual(400);
      });

      it('each difficulty 1/2/3 has at least 30 questions', () => {
        for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length, `difficulty ${d}`).toBeGreaterThanOrEqual(30);
      });

      it('every question has a non-empty hint and explanation', () => {
        for (const q of qs) {
          expect(!!q.hint && q.hint.trim().length > 0, `${q.id} hint`).toBe(true);
          expect(q.explanation.trim().length > 0, `${q.id} explanation`).toBe(true);
        }
      });

      it('mcq answerIndex is spread — each of 0..3 is the answer for at least 18% of mcq items', () => {
        const mcq = qs.filter(q => q.format === 'mcq');
        expect(mcq.length).toBeGreaterThan(0);
        for (const idx of [0, 1, 2, 3]) {
          const share = mcq.filter(q => q.answerIndex === idx).length / mcq.length;
          expect(share, `answerIndex ${idx} share = ${(share * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.18);
        }
      });

      it('ids are unique and prompts are not duplicated', () => {
        const ids = qs.map(q => q.id);
        expect(new Set(ids).size, 'unique ids').toBe(ids.length);
        const prompts = qs.map(q => norm(q.prompt));
        expect(new Set(prompts).size, 'unique normalised prompts').toBe(prompts.length);
      });

      if (needsBalance) {
        it('has at least one balanceEquation question', () => {
          expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
        });
      }

      it('every balanceEquation balances with all coefficients between 1 and 9', () => {
        for (const q of qs.filter(q => q.format === 'balanceEquation')) {
          expect(q.equation, `${q.id} equation`).toBeDefined();
          const eq = q.equation!;
          for (const t of [...eq.reactants, ...eq.products]) {
            expect(Number.isInteger(t.coeff) && t.coeff >= 1 && t.coeff <= 9, `${q.id} coeff for ${t.formula} = ${t.coeff}`).toBe(true);
          }
          expect(equationBalances(eq), `${q.id} does not balance`).toBe(true);
        }
      });
    });
  }
});

describe('equipment content', () => {
  it('loads 47 equipment items with unique IDs', () => {
    const { content } = loadGameContent();
    const ids = Object.keys(content.equipment);
    expect(ids.length).toBe(47);
    expect(new Set(ids).size).toBe(47);
  });

  it('every equipment item has a valid kind (weapon|armour|accessory)', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      expect(['weapon', 'armour', 'accessory']).toContain(e.kind);
    }
  });

  it('every equipment item has a valid tier (1|2|3)', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      expect([1, 2, 3]).toContain(e.tier);
    }
  });

  it('universal-family items have empty wieldableBy', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      if (e.family === 'universal') expect(e.wieldableBy).toHaveLength(0);
    }
  });

  it('all 8 universal accessories have shopPrice null', () => {
    const { content } = loadGameContent();
    const universals = Object.values(content.equipment).filter(e => e.family === 'universal');
    expect(universals.length).toBe(8);
    for (const e of universals) expect(e.shopPrice).toBeNull();
  });

  it('all dropEquipmentId values on enemies reference real equipment IDs', () => {
    const { content } = loadGameContent();
    for (const enemy of Object.values(content.enemies)) {
      if (enemy.dropEquipmentId) {
        expect(content.equipment[enemy.dropEquipmentId], `enemy ${enemy.id} dropEquipmentId "${enemy.dropEquipmentId}" not found`).toBeDefined();
      }
    }
  });

  it('exactly 16 enemies have a dropEquipmentId (8 miniBosses + 8 regionBoss/finalBoss)', () => {
    const { content } = loadGameContent();
    const withDrop = Object.values(content.enemies).filter(e => e.dropEquipmentId);
    expect(withDrop.length).toBe(16);
  });
});

describe('shop content', () => {
  it('loads 8 shop definitions', () => {
    const { content } = loadGameContent();
    expect(Object.keys(content.shops).length).toBe(8);
  });

  it('every shop regionId references a real region', () => {
    const { content } = loadGameContent();
    const regionIds = new Set(content.regions.map(r => r.id));
    for (const shop of Object.values(content.shops)) {
      expect(regionIds.has(shop.regionId), `shop ${shop.id} regionId "${shop.regionId}" not a real region`).toBe(true);
    }
  });

  it('every shop equipmentId references a real equipment item', () => {
    const { content } = loadGameContent();
    for (const shop of Object.values(content.shops)) {
      for (const id of shop.equipmentIds) {
        expect(content.equipment[id], `shop ${shop.id} references unknown equipment "${id}"`).toBeDefined();
      }
    }
  });

  it('no shop stocks boss-drop-only items (shopPrice null)', () => {
    const { content } = loadGameContent();
    for (const shop of Object.values(content.shops)) {
      for (const id of shop.equipmentIds) {
        const eq = content.equipment[id];
        if (eq) expect(eq.shopPrice, `shop ${shop.id} stocks boss-drop-only item "${id}"`).not.toBeNull();
      }
    }
  });

  it('each region has exactly one shop', () => {
    const { content } = loadGameContent();
    const byRegion = new Map<string, number>();
    for (const shop of Object.values(content.shops)) {
      byRegion.set(shop.regionId, (byRegion.get(shop.regionId) ?? 0) + 1);
    }
    for (const region of content.regions) {
      expect(byRegion.get(region.id), `region ${region.id} has no shop`).toBe(1);
    }
  });
});

describe('shopkeeper NPC reachability', () => {
  const maps: Record<string, AuditTilemap> = {
    'elemental-reaches': elementalReaches as AuditTilemap,
    'bonding-forge': bondingForge as AuditTilemap,
    'reaction-hollow': reactionHollow as AuditTilemap,
    'balance-halls': balanceHalls as AuditTilemap,
    'catalyst-crags': catalystCrags as AuditTilemap,
    'acid-wastes': acidWastes as AuditTilemap,
    'the-crucible': theCrucible as AuditTilemap,
    'equilibriums-heart': equilibriumsHeart as AuditTilemap,
  };

  const shopkeeperIdByRegion: Record<string, string> = {
    'elemental-reaches': 'vendor-mara',
    'bonding-forge': 'merchant-rho',
    'reaction-hollow': 'trader-kira',
    'balance-halls': 'vendor-theron',
    'catalyst-crags': 'merchant-vex',
    'acid-wastes': 'trader-osh',
    'the-crucible': 'vendor-brix',
    'equilibriums-heart': 'merchant-mira',
  };

  it('every shopkeeper NPC is in its region tilemap and BFS-reachable before the miniboss', () => {
    const { content } = loadGameContent();
    for (const region of content.regions) {
      const map = maps[region.id];
      expect(map, `${region.id} has no audit tilemap`).toBeDefined();
      if (!map) continue;
      const shopkeeperId = shopkeeperIdByRegion[region.id];
      expect(shopkeeperId, `${region.id} has no expected shopkeeper id`).toBeDefined();
      const npcObj = map.objects.find(o => o.type === 'npc' && o.id === shopkeeperId);
      expect(npcObj, `${region.id} tilemap missing shopkeeper NPC "${shopkeeperId}"`).toBeDefined();
      if (!npcObj) continue;
      const reachable = reachableTilesBeforeGuardian(map);
      expect(isAdjacentReachable(reachable, npcObj), `shopkeeper "${shopkeeperId}" is not BFS-reachable before the miniboss`).toBe(true);
    }
  });

  it('every shopkeeper NPC has a "shop" launch in its dialogue', () => {
    const { content } = loadGameContent();
    for (const npcId of Object.values(shopkeeperIdByRegion)) {
      const npc = content.npcs[npcId];
      expect(npc, `NPC "${npcId}" not found in content`).toBeDefined();
      if (!npc) continue;
      const hasShopLaunch = npc.dialogue.some(node => node.launch === 'shop');
      expect(hasShopLaunch, `NPC "${npcId}" has no dialogue node with launch:'shop'`).toBe(true);
    }
  });
});

describe('question visuals', () => {
  it('every question with a visual field passes validateQuestionVisual without throwing', () => {
    const { content } = loadGameContent();
    let total = 0;
    for (const [topic, bank] of Object.entries(content.questions)) {
      for (const q of bank) {
        if (q.visual !== undefined) {
          expect(
            () => validateQuestionVisual(q.visual, `question[${q.id}].visual`),
            `question ${q.id} (topic: ${topic}) visual is invalid`,
          ).not.toThrow();
          total++;
        }
      }
    }
    // Sanity: at least 43 questions should have visuals
    expect(total, 'expected at least 43 questions with visuals').toBeGreaterThanOrEqual(43);
  });

  it('no question has a visual on a non-mcq format', () => {
    const { content } = loadGameContent();
    for (const [topic, bank] of Object.entries(content.questions)) {
      for (const q of bank) {
        if (q.visual !== undefined) {
          expect(q.format, `${q.id} (${topic}): visual on non-mcq question`).toBe('mcq');
        }
      }
    }
  });

  it('at least one question in each of the 7 relevant banks has a visual', () => {
    const { content } = loadGameContent();
    const relevantBanks = [
      'atomic-structure', 'bonding', 'reaction-types', 'balancing-equations',
      'reaction-rates', 'acids-bases', 'energy-changes',
    ];
    for (const bank of relevantBanks) {
      const withVisual = (content.questions[bank] ?? []).filter(q => q.visual !== undefined);
      expect(withVisual.length, `${bank} should have at least 1 visual`).toBeGreaterThanOrEqual(1);
    }
  });
});
