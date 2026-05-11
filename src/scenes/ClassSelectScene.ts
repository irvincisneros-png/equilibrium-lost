import Phaser from 'phaser';
import type { GameContent, ClassDef, SaveData, SaveSettings } from '../content/types';
import { SaveManager } from '../systems/SaveManager';
import { persist as savePersist } from '../persist';

const W = 480;
const H = 320;
const FONT = 'monospace';
const TEXT_COLOR = '#cdd6f4';
const DIM_COLOR = '#415a77';
const PANEL_BG = 0x0d1b2a;
const PANEL_BORDER = 0x415a77;
const SELECT_BORDER = 0x89b4fa;

const PLAYSTYLE: Record<string, string> = {
  pyron: 'Aggressive — high damage, fragile',
  aqualis: 'All-rounder — survivable, flexible',
  ionix: 'Tricky — acts first, stacks debuffs',
};

export class ClassSelectScene extends Phaser.Scene {
  private selectedIdx = 0;
  private panels: Phaser.GameObjects.Rectangle[] = [];
  private classes: ClassDef[] = [];

  constructor() { super('ClassSelectScene'); }

  create(): void {
    const content: GameContent = this.registry.get('content');
    this.classes = content.classes;

    this.cameras.main.setBackgroundColor('#0b0f17');

    this.add.text(W / 2, 12, 'Choose Your Class', {
      fontFamily: FONT, fontSize: '13px', color: TEXT_COLOR
    }).setOrigin(0.5);

    this.add.text(W / 2, 28, '← → to browse   Enter / click to confirm', {
      fontFamily: FONT, fontSize: '8px', color: DIM_COLOR
    }).setOrigin(0.5);

    const panelW = 136;
    const panelH = 230;
    const panelY = 55;
    const startX = (W - (3 * panelW + 2 * 10)) / 2;

    this.classes.forEach((cls, i) => {
      const px = startX + i * (panelW + 10);
      const py = panelY;

      const bg = this.add.rectangle(px + panelW / 2, py + panelH / 2, panelW, panelH, PANEL_BG)
        .setStrokeStyle(1, i === this.selectedIdx ? SELECT_BORDER : PANEL_BORDER);
      this.panels.push(bg);

      // Class name
      this.add.text(px + panelW / 2, py + 10, cls.name, {
        fontFamily: FONT, fontSize: '11px', color: TEXT_COLOR
      }).setOrigin(0.5, 0);

      // Theme
      this.add.text(px + panelW / 2, py + 26, cls.theme, {
        fontFamily: FONT, fontSize: '7px', color: '#8fa3c0',
        wordWrap: { width: panelW - 10 }, align: 'center'
      }).setOrigin(0.5, 0);

      // Stats
      const stats = cls.baseStats;
      this.add.text(px + 8, py + 56, [
        'HP:  ' + stats.hp,
        'ATK: ' + stats.atk,
        'DEF: ' + stats.def,
        'SPD: ' + stats.spd,
      ].join('\n'), {
        fontFamily: FONT, fontSize: '8px', color: TEXT_COLOR, lineSpacing: 3
      });

      // Signature affinity
      this.add.text(px + 8, py + 110, 'Affinity: ' + cls.signatureAffinity, {
        fontFamily: FONT, fontSize: '8px', color: '#f9e2af'
      });

      // Starting skills
      const skillNames = cls.startingSkillIds
        .map(id => content.skills[id]?.name ?? id)
        .join('\n• ');
      this.add.text(px + 8, py + 126, 'Skills:\n• ' + skillNames, {
        fontFamily: FONT, fontSize: '7px', color: '#a6e3a1', lineSpacing: 3
      });

      // Playstyle blurb
      const blurb = PLAYSTYLE[cls.id] ?? '';
      this.add.text(px + panelW / 2, py + panelH - 24, blurb, {
        fontFamily: FONT, fontSize: '7px', color: '#89dceb',
        wordWrap: { width: panelW - 8 }, align: 'center'
      }).setOrigin(0.5, 0);

      // Click to select + confirm
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (this.selectedIdx === i) {
          this.confirmClass(content);
        } else {
          this.selectedIdx = i;
          this.refreshPanelBorders();
        }
      });
    });

    // Instruction at bottom
    this.add.text(W / 2, H - 10, 'Click selected class again or press Enter to confirm', {
      fontFamily: FONT, fontSize: '8px', color: DIM_COLOR
    }).setOrigin(0.5, 1);

    // Keyboard nav
    this.input.keyboard!.on('keydown-LEFT', () => {
      this.selectedIdx = (this.selectedIdx - 1 + this.classes.length) % this.classes.length;
      this.refreshPanelBorders();
    });

    this.input.keyboard!.on('keydown-RIGHT', () => {
      this.selectedIdx = (this.selectedIdx + 1) % this.classes.length;
      this.refreshPanelBorders();
    });

    this.input.keyboard!.on('keydown-ENTER', () => this.confirmClass(content));
    this.input.keyboard!.on('keydown-SPACE', () => this.confirmClass(content));
  }

  private refreshPanelBorders(): void {
    this.panels.forEach((p, i) => {
      p.setStrokeStyle(1, i === this.selectedIdx ? SELECT_BORDER : PANEL_BORDER);
    });
  }

  private confirmClass(content: GameContent): void {
    const cls = this.classes[this.selectedIdx];
    if (!cls) return;

    const save: SaveData = SaveManager.newGame(cls.id, content);

    // Apply any pending settings from TitleScene Settings panel (no-save path)
    const pending: SaveSettings | null = this.registry.get('pendingSettings');
    if (pending) {
      save.settings = { ...pending };
      this.registry.set('pendingSettings', null);
    }

    this.registry.set('save', save);
    savePersist();
    this.scene.start('WorldMapScene');
  }
}
