import { describe, it, expect } from 'vitest';
import { GAME_WIDTH, GAME_HEIGHT, makeGameConfig } from '../../src/gameConfig';
import { resolvePlaceholderSpec } from '../../src/ui/placeholderSpec';
import { loadGameContent } from '../../src/content/loadGameContent';

describe('game config', () => {
  it('is a 1920x1080 16:9 canvas, non-pixel-art, with a scene list starting at BootScene', () => {
    const cfg = makeGameConfig([{ key: 'BootScene' }] as any);
    expect(GAME_WIDTH).toBe(1920);
    expect(GAME_HEIGHT).toBe(1080);
    expect(cfg.pixelArt).toBe(false);
    expect(cfg.scale?.mode).toBeDefined();
    expect((cfg.scene as any[])[0].key).toBe('BootScene');
  });
});

describe('resolvePlaceholderSpec', () => {
  const manifest = loadGameContent().content.assets;
  it('returns the manifest entry for a known key', () => {
    const s = resolvePlaceholderSpec('enemy_protium', manifest);
    expect(s.key).toBe('enemy_protium');
    expect(s.w).toBeGreaterThan(0);
    expect(s.color).toMatch(/^#/);
  });
  it('returns a magenta fallback for an unknown key (never throws)', () => {
    const s = resolvePlaceholderSpec('totally_missing', manifest);
    expect(s.color.toLowerCase()).toBe('#ff00ff');
    expect(s.label).toBe('totally_missing');
  });
});
