import { describe, it, expect } from 'vitest';
import { playerBattleInputFromSave, battleContextFromContent } from '../../src/scenes/battlePresenter';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';

const content = loadGameContent().content;

describe('battlePresenter', () => {
  it('builds a player battle input matching the save (stats, equipped skills, burst skill id)', () => {
    const save = SaveManager.newGame('pyron', content);
    const inp = playerBattleInputFromSave(save, content);
    expect(inp.level).toBe(1);
    expect(inp.maxHp).toBe(save.stats.hp);
    expect(inp.equippedSkillIds).toEqual(save.equippedSkillIds);
    expect(inp.signatureAffinity).toBe('Combustion');
    expect(inp.catalystBurstSkillId).toBe('combustion-cascade');
  });

  it('battleContextFromContent wires getSkill/getItem/getEnemyDef + settings', () => {
    const ctx = battleContextFromContent(content, { answerTimer: true });
    expect(ctx.getSkill('proton-jab').name).toBe('Proton Jab');
    expect(ctx.getItem('minor-buffer').name).toBe('Minor Buffer');
    expect(ctx.getEnemyDef('protium').name).toBe('Protium');
    expect(ctx.settings.answerTimer).toBe(true);
    expect(() => ctx.getSkill('nope')).toThrow();
  });
});
