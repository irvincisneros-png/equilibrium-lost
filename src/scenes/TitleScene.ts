import Phaser from 'phaser';
import type { GameContent, SaveData, SaveSettings } from '../content/types';
import { SaveManager } from '../systems/SaveManager';
import { addPlaceholderLabel } from '../ui/placeholderTextures';

const W = 480;
const H = 320;

const FONT = 'monospace';
const TEXT_COLOR = '#cdd6f4';
const DIM_COLOR = '#415a77';
const PANEL_BG = 0x0d1b2a;
const PANEL_BORDER = 0x415a77;

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create(): void {
    const content: GameContent = this.registry.get('content');
    const save: SaveData | null = this.registry.get('save');
    const saveLoadResult: { ok: boolean; reason?: string } = this.registry.get('saveLoadResult');

    this.cameras.main.setBackgroundColor('#0b0f17');

    // --- Title art placeholder ---
    const art = this.add.image(W / 2, 100, 'title_art').setDisplaySize(W, 200);
    addPlaceholderLabel(this, W / 2, 100, 'title_art', content.assets);
    void art; // used for layout

    // Subtitle
    this.add.text(W / 2, 208, 'A Year 10 Chemistry RPG', {
      fontFamily: FONT, fontSize: '10px', color: '#8fa3c0'
    }).setOrigin(0.5);

    // Corrupt-save warning
    if (!saveLoadResult.ok && saveLoadResult.reason === 'corrupt') {
      this.add.text(W / 2, 228, 'Your saved game was corrupted and couldn\'t be loaded. Starting New Game will overwrite it.', {
        fontFamily: FONT, fontSize: '8px', color: '#f38ba8',
        wordWrap: { width: W - 32 }, align: 'center'
      }).setOrigin(0.5);
    }

    // --- Menu ---
    const menuY = 262;
    const menuItems = [
      { label: 'New Game', key: 'new', enabled: true },
      { label: 'Continue', key: 'continue', enabled: save !== null },
      { label: 'Settings', key: 'settings', enabled: true },
    ];

    const textObjs: Phaser.GameObjects.Text[] = [];
    let selectedIdx = 0;

    menuItems.forEach((item, i) => {
      const color = item.enabled ? TEXT_COLOR : DIM_COLOR;
      const t = this.add.text(W / 2, menuY + i * 18, item.label, {
        fontFamily: FONT, fontSize: '12px', color
      }).setOrigin(0.5);

      if (item.enabled) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => {
          if (item.key === 'new') this.startNewGame();
          else if (item.key === 'continue') this.scene.start('WorldMapScene');
          else if (item.key === 'settings') this.openSettings(save, content);
        });
        t.on('pointerover', () => { selectedIdx = i; this.updateCursor(cursor, textObjs, selectedIdx); });
      }
      textObjs.push(t);
    });

    // Cursor marker
    const cursor = this.add.text(W / 2 - 68, menuY, '▶', {
      fontFamily: FONT, fontSize: '12px', color: TEXT_COLOR
    }).setOrigin(0.5);

    this.updateCursor(cursor, textObjs, selectedIdx);

    // Keyboard navigation
    this.input.keyboard!.on('keydown-UP', () => {
      do { selectedIdx = (selectedIdx - 1 + menuItems.length) % menuItems.length; }
      while (!menuItems[selectedIdx]!.enabled && selectedIdx !== 0);
      // skip disabled items
      let guard = 0;
      while (!menuItems[selectedIdx]!.enabled && guard++ < menuItems.length) {
        selectedIdx = (selectedIdx - 1 + menuItems.length) % menuItems.length;
      }
      this.updateCursor(cursor, textObjs, selectedIdx);
    });

    this.input.keyboard!.on('keydown-DOWN', () => {
      let next = (selectedIdx + 1) % menuItems.length;
      let guard = 0;
      while (!menuItems[next]!.enabled && guard++ < menuItems.length) {
        next = (next + 1) % menuItems.length;
      }
      selectedIdx = next;
      this.updateCursor(cursor, textObjs, selectedIdx);
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      const item = menuItems[selectedIdx];
      if (!item?.enabled) return;
      if (item.key === 'new') this.startNewGame();
      else if (item.key === 'continue') this.scene.start('WorldMapScene');
      else if (item.key === 'settings') this.openSettings(save, content);
    });

    this.input.keyboard!.on('keydown-SPACE', () => {
      const item = menuItems[selectedIdx];
      if (!item?.enabled) return;
      if (item.key === 'new') this.startNewGame();
      else if (item.key === 'continue') this.scene.start('WorldMapScene');
      else if (item.key === 'settings') this.openSettings(save, content);
    });
  }

  private updateCursor(
    cursor: Phaser.GameObjects.Text,
    items: Phaser.GameObjects.Text[],
    idx: number
  ): void {
    const target = items[idx];
    if (target) cursor.setY(target.y);
  }

  private startNewGame(): void {
    this.scene.start('ClassSelectScene');
  }

  private openSettings(save: SaveData | null, content: GameContent): void {
    // If a panel already exists, destroy it (toggle)
    const existing = this.children.getByName('settings-panel');
    if (existing) { existing.destroy(); return; }

    // Transient defaults when no save
    let settings: SaveSettings;
    if (save) {
      settings = save.settings;
    } else {
      const pending: SaveSettings = this.registry.get('pendingSettings') ?? { studyMode: false, answerTimer: false };
      settings = pending;
      this.registry.set('pendingSettings', settings);
    }

    const px = W / 2 - 100;
    const py = 126;
    const pw = 200;
    const ph = 76;

    const panel = this.add.container(0, 0).setName('settings-panel');
    const bg = this.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, PANEL_BG, 0.95)
      .setStrokeStyle(1, PANEL_BORDER);
    panel.add(bg);

    const title = this.add.text(px + pw / 2, py + 8, 'Settings', {
      fontFamily: FONT, fontSize: '10px', color: TEXT_COLOR
    }).setOrigin(0.5, 0);
    panel.add(title);

    const makeToggle = (label: string, yOff: number, getVal: () => boolean, setVal: (v: boolean) => void) => {
      const row = this.add.container(0, 0);
      const lbl = this.add.text(px + 10, py + yOff, label + ':', {
        fontFamily: FONT, fontSize: '9px', color: TEXT_COLOR
      });
      const valTxt = this.add.text(px + pw - 10, py + yOff, getVal() ? 'ON' : 'OFF', {
        fontFamily: FONT, fontSize: '9px', color: getVal() ? '#a6e3a1' : '#f38ba8'
      }).setOrigin(1, 0);
      valTxt.setInteractive({ useHandCursor: true });
      valTxt.on('pointerdown', () => {
        const next = !getVal();
        setVal(next);
        valTxt.setText(next ? 'ON' : 'OFF');
        valTxt.setColor(next ? '#a6e3a1' : '#f38ba8');
        if (save) SaveManager.save(save, window.localStorage);
      });
      row.add([lbl, valTxt]);
      panel.add(row);
    };

    makeToggle('Study Mode', 26, () => settings.studyMode, (v) => { settings.studyMode = v; });
    makeToggle('Answer Timer', 46, () => settings.answerTimer, (v) => { settings.answerTimer = v; });

    const closeBtn = this.add.text(px + pw - 6, py + 6, '✕', {
      fontFamily: FONT, fontSize: '9px', color: DIM_COLOR
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => panel.destroy());
    panel.add(closeBtn);

    void content; // available if needed later
  }
}
