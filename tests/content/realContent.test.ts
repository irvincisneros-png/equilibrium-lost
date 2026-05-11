import { describe, it, expect } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';

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
});
