import Phaser from 'phaser';
import type { GameContent, SaveData } from '../content/types';
import { MusicManager } from '../systems/MusicManager';

const W = 1920;
const H = 1080;
const FONT = 'monospace';

export class EndingScene extends Phaser.Scene {
  constructor() { super('EndingScene'); }

  create(): void {
    const content: GameContent | null = this.registry.get('content');
    const save: SaveData | null = this.registry.get('save');

    MusicManager.play(this, 'music_ending');

    this.cameras.main.setBackgroundColor('#05080d');
    this.add.rectangle(W / 2, H / 2, W, H, 0x05080d).setOrigin(0.5);

    let y = 160;

    // Closing narration
    const narration = [
      'The Great Imbalance is undone.',
      'Across Æquor, the reversible reactions breathe again —',
      'forward and reverse, equal and steady, a world in balance.',
      'The closed systems hum. The scales hold.',
      'You restored equilibrium.',
    ];

    for (const line of narration) {
      this.add.text(W / 2, y, line, {
        fontFamily: FONT, fontSize: '36px', color: '#cdd6f4',
        align: 'center', wordWrap: { width: W - 320 },
      }).setOrigin(0.5, 0);
      y += 64;
    }

    y += 48;

    // Player summary
    if (save && content) {
      const cls = content.classes.find(c => c.id === save.classId);
      const stageName = save.evolutionStage === 0
        ? (cls?.name ?? save.classId)
        : (cls?.evolutions.find(e => e.stage === save.evolutionStage)?.name ?? cls?.name ?? save.classId);
      this.add.text(W / 2, y, `${stageName}   Lv. ${save.level}`, {
        fontFamily: FONT, fontSize: '32px', color: '#a6e3a1',
      }).setOrigin(0.5, 0);
      y += 56;
    }

    y += 32;

    // THE END
    this.add.text(W / 2, y, '— EQUILIBRIUM RESTORED —', {
      fontFamily: FONT, fontSize: '60px', color: '#f9e2af',
    }).setOrigin(0.5, 0);

    y += 96;

    this.add.text(W / 2, y, 'THE END', {
      fontFamily: FONT, fontSize: '48px', color: '#f9e2af',
    }).setOrigin(0.5, 0);

    y += 80;

    // Music credits (CC-BY tracks require attribution)
    const creditLines = [
      'Music: "RPG Title Theme" (Tauredian, CC-BY 3.0 · opengameart.org),',
      '"Overworld Select – 8-bit Gameboy Track" (Wolfgang_ / Ted Kerr, CC-BY 4.0 · opengameart.org),',
      '"Their Spears Fell Like Rain" (request, CC-BY 4.0 · opengameart.org).  Other tracks CC0 via OpenGameArt.',
    ];
    for (const line of creditLines) {
      this.add.text(W / 2, y, line, {
        fontFamily: FONT, fontSize: '18px', color: '#566074',
        align: 'center', wordWrap: { width: W - 320 },
      }).setOrigin(0.5, 0);
      y += 28;
    }

    y += 24;

    // Prompt
    this.add.text(W / 2, y, 'Press Enter to return to the title', {
      fontFamily: FONT, fontSize: '32px', color: '#566074',
    }).setOrigin(0.5, 0);

    // Input handlers
    const onKey = (): void => { this.scene.start('TitleScene'); };
    const onPointer = (): void => { this.scene.start('TitleScene'); };

    this.input.keyboard!.on('keydown-ENTER', onKey);
    this.input.keyboard!.on('keydown-SPACE', onKey);
    this.input.on('pointerdown', onPointer);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard!.off('keydown-ENTER', onKey);
      this.input.keyboard!.off('keydown-SPACE', onKey);
      this.input.off('pointerdown', onPointer);
    });
  }
}
