import Phaser from 'phaser';

const EN_COLOR = 0x4cc9f0;
const EN_AMBER = 0xf3722c;
const EN_RED   = 0xe63946;

const BAR_H = 32;
const LABEL_W = 128;
const BAR_PADDING = 16;

export class EnergyBar extends Phaser.GameObjects.Container {
  private readonly barW: number;
  private fill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, label: string) {
    super(scene, x, y);
    this.barW = w - LABEL_W - BAR_PADDING;

    // Label
    this.add(scene.add.text(0, BAR_H / 2, label, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#cdd6f4',
    }).setOrigin(0, 0.5));

    // Background track
    const track = scene.add.rectangle(LABEL_W, 0, this.barW, BAR_H, 0x1a2a3a).setOrigin(0, 0);
    this.add(track);

    // Fill rect — full width initially
    this.fill = scene.add.rectangle(LABEL_W, 0, this.barW, BAR_H, EN_COLOR).setOrigin(0, 0);
    this.add(this.fill);

    // Border
    const border = scene.add.rectangle(LABEL_W, 0, this.barW, BAR_H)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x415a77)
      .setFillStyle(0, 0);
    this.add(border);

    scene.add.existing(this);
  }

  setValue(value: number, max: number, animate = true): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    const targetW = Math.max(1, Math.round(this.barW * ratio));
    const color = ratio < 0.15 ? EN_RED : ratio < 0.30 ? EN_AMBER : EN_COLOR;
    this.fill.setFillStyle(color);

    if (animate) {
      this.scene.tweens.add({
        targets: this.fill,
        displayWidth: targetW,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    } else {
      this.fill.displayWidth = targetW;
    }
  }
}
