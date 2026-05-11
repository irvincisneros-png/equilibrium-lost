import Phaser from 'phaser';
import { MAX_CHAIN } from '../systems/battle/chain';
import { formatMultiplier } from './chainFormat';

// Re-exported so callers can `import { formatMultiplier } from '.../ChainMeter'`;
// the pure implementation lives in chainFormat.ts (Phaser-free → unit-testable).
export { formatMultiplier };

/**
 * Battle HUD widget: `MAX_CHAIN` segments that fill amber → red as the chain rises,
 * with the multiplier text beside them. Flashes on change and pulses in the
 * "BURST READY" state. Logic-free — `setChain` is the only input.
 */
export class ChainMeter extends Phaser.GameObjects.Container {
  private static readonly SEG_W = 12;
  private static readonly SEG_H = 8;
  private static readonly GAP = 2;
  private static readonly LIT = [0xfacc15, 0xf59e0b, 0xf97316, 0xea580c, 0xdc2626]; // amber → red
  private static readonly DIM = 0x33394a;

  private readonly segs: Phaser.GameObjects.Rectangle[] = [];
  private readonly label: Phaser.GameObjects.Text;
  private chain = 0;
  private burstTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const step = ChainMeter.SEG_W + ChainMeter.GAP;
    for (let i = 0; i < MAX_CHAIN; i++) {
      const r = scene.add.rectangle(i * step, 0, ChainMeter.SEG_W, ChainMeter.SEG_H, ChainMeter.DIM)
        .setOrigin(0, 0.5).setStrokeStyle(1, 0x000000, 0.4);
      this.segs.push(r);
      this.add(r);
    }
    this.label = scene.add.text(MAX_CHAIN * step + 6, 0, formatMultiplier(0), {
      fontFamily: 'monospace', fontSize: '9px', color: '#cdd6f4',
    }).setOrigin(0, 0.5);
    this.add(this.label);
    scene.add.existing(this);
    this.render();
  }

  getChain(): number { return this.chain; }

  setChain(chain: number): void {
    const next = Math.max(0, Math.min(MAX_CHAIN, Math.floor(chain)));
    if (next === this.chain) return;
    this.chain = next;
    this.render();
    this.scene.tweens.add({ targets: this, scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 90 });
    if (next >= MAX_CHAIN) this.startBurstPulse();
    else this.stopBurstPulse();
  }

  private render(): void {
    for (let i = 0; i < this.segs.length; i++) {
      const lit = i < this.chain;
      this.segs[i]!.setFillStyle(lit ? (ChainMeter.LIT[Math.min(i, ChainMeter.LIT.length - 1)] ?? 0xdc2626) : ChainMeter.DIM);
    }
    const burst = this.chain >= MAX_CHAIN;
    this.label.setText(formatMultiplier(this.chain)).setColor(burst ? '#f9e2af' : '#cdd6f4');
  }

  private startBurstPulse(): void {
    this.stopBurstPulse();
    this.burstTween = this.scene.tweens.add({ targets: this.label, alpha: 0.35, yoyo: true, repeat: -1, duration: 350 });
  }

  private stopBurstPulse(): void {
    this.burstTween?.remove();
    this.burstTween = undefined;
    this.label.setAlpha(1);
  }

  override destroy(fromScene?: boolean): void {
    this.stopBurstPulse();
    super.destroy(fromScene);
  }
}
