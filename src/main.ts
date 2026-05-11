import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';
import { ErrorScene } from './scenes/ErrorScene';
import { DialogueScene } from './scenes/DialogueScene';
import { TitleScene } from './scenes/TitleScene';

// Scenes are appended here as Phase 6 tasks add them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCENES: any[] = [BootScene, ErrorScene, DialogueScene, TitleScene];

new Phaser.Game(makeGameConfig(SCENES));
