import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';
import { ErrorScene } from './scenes/ErrorScene';

// Scenes are appended here as Phase 6 tasks add them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCENES: any[] = [BootScene, ErrorScene];

new Phaser.Game(makeGameConfig(SCENES));
