import type Phaser from 'phaser';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

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
    pixelArt: false,
    backgroundColor: '#0b0f17',
    scale: { mode: SCALE_FIT, autoCenter: CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: scenes as unknown as Phaser.Types.Scenes.SceneType[]
  };
}
