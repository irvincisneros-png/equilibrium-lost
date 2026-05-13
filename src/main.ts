import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';
import { ErrorScene } from './scenes/ErrorScene';
import { TitleScene } from './scenes/TitleScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { OverworldScene } from './scenes/OverworldScene';
import { DialogueScene } from './scenes/DialogueScene';
import { BattleScene } from './scenes/BattleScene';
import { ChallengeShrineScene } from './scenes/ChallengeShrineScene';
import { HealingSpringScene } from './scenes/HealingSpringScene';
import { MenuScene } from './scenes/MenuScene';
import { EndingScene } from './scenes/EndingScene';

// First scene is auto-started; the rest are registered for `this.scene.start/launch`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCENES: any[] = [
  BootScene, ErrorScene, TitleScene, ClassSelectScene, WorldMapScene,
  OverworldScene, DialogueScene, BattleScene, ChallengeShrineScene, HealingSpringScene, MenuScene, EndingScene,
];

new Phaser.Game(makeGameConfig(SCENES));
