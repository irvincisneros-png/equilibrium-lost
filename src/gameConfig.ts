import type Phaser from 'phaser';

export const GBA_WIDTH = 240;
export const GBA_HEIGHT = 160;
export const SCALE = 2;
export const GAME_WIDTH = GBA_WIDTH * SCALE;
export const GAME_HEIGHT = GBA_HEIGHT * SCALE;

// Phaser constant values — avoids importing Phaser (with its DOM side-effects) in non-browser contexts.
// Verified against Phaser 3.90 source: src/const.js, src/scale/const/*.js
const PHASER_AUTO = 0;          // Phaser.AUTO
const SCALE_FIT = 3;            // Phaser.Scale.FIT
const CENTER_BOTH = 1;          // Phaser.Scale.CENTER_BOTH

export function makeGameConfig(scenes: Phaser.Types.Scenes.SettingsConfig[]): Phaser.Types.Core.GameConfig {
  return {
    type: PHASER_AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    backgroundColor: '#0b0f17',
    scale: { mode: SCALE_FIT, autoCenter: CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: scenes as unknown as Phaser.Types.Scenes.SceneType[]
  };
}
