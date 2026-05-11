import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';
import { ErrorScene } from './scenes/ErrorScene';
import { DialogueScene } from './scenes/DialogueScene';
import { TitleScene } from './scenes/TitleScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { ChallengeShrineScene } from './scenes/ChallengeShrineScene';

// Scenes are appended here as Phase 6 tasks add them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCENES: any[] = [BootScene, ErrorScene, DialogueScene, TitleScene, ClassSelectScene, WorldMapScene, OverworldScene, BattleScene, ChallengeShrineScene];

new Phaser.Game(makeGameConfig(SCENES));
