import { describe, it, expect } from 'vitest';
import { GAME_WIDTH, GAME_HEIGHT, makeGameConfig } from '../../src/gameConfig';

describe('game config', () => {
  it('is a GBA-ish resolution scaled up, pixelArt, with a scene list starting at BootScene', () => {
    const cfg = makeGameConfig([{ key: 'BootScene' }] as any);
    expect(GAME_WIDTH).toBe(480);   // 2x GBA width (240)
    expect(GAME_HEIGHT).toBe(320);  // 2x GBA height (160)
    expect(cfg.pixelArt).toBe(true);
    expect(cfg.scale?.mode).toBeDefined();
    expect((cfg.scene as any[])[0].key).toBe('BootScene');
  });
});
