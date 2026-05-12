import Phaser from 'phaser';
import type { GameContent, SaveData, RegionDef } from '../content/types';
import { addPlaceholderLabel } from '../ui/placeholderTextures';

const W = 1920;
const H = 1080;
const FONT = 'monospace';
const TEXT_COLOR = '#cdd6f4';
const DIM_COLOR = '#415a77';
const DIM_COLOR_NUM = 0x415a77;
const NODE_UNLOCKED = 0x1e3a5f;
const NODE_LOCKED = 0x12202e;
const NODE_BORDER_UNLOCKED = 0x89b4fa;
const NODE_BORDER_LOCKED = 0x2a3f5c;
const NODE_CURRENT = 0x2a5298;

// Labels for the not-yet-built regions; the first content.regions.length nodes come from content.
const LOCKED_REGION_LABELS = [
  'The Acid Wastes',
  'The Crucible',
  "Equilibrium's Heart",
];

export class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMapScene'); }

  create(): void {
    const content: GameContent = this.registry.get('content');
    const save: SaveData = this.registry.get('save');

    this.cameras.main.setBackgroundColor('#0b0f17');

    // Draw worldmap placeholder
    this.add.image(W / 2, H / 2, 'worldmap').setDisplaySize(W, H);
    addPlaceholderLabel(this, W / 2, H / 2, 'worldmap', content.assets);

    // Title
    this.add.text(W / 2, 16, 'Æquor — World Map', {
      fontFamily: FONT, fontSize: '36px', color: TEXT_COLOR
    }).setOrigin(0.5, 0);

    // Real nodes for every shipped region, padded out to 8 with the locked labels.
    interface NodeInfo { id: string; label: string; region?: RegionDef; }
    const nodes: NodeInfo[] = content.regions.map(r => ({ id: r.id, label: r.name, region: r }));
    LOCKED_REGION_LABELS.forEach((label, i) => {
      nodes.push({ id: 'locked-region-' + (content.regions.length + i + 1), label });
    });

    // A content region is unlocked when it's the first region, or some other region whose
    // unlocksRegionId points at it has had its boss defeated.
    const isContentUnlocked = (r: RegionDef): boolean =>
      r.index === 1 || content.regions.some(prev => prev.unlocksRegionId === r.id && (save.regionProgress[prev.id]?.bossDefeated ?? false));

    // "◀ START HERE" follows the first unlocked content region that hasn't been cleared yet.
    const startHereId = (() => {
      for (const r of content.regions) {
        if (isContentUnlocked(r) && !(save.regionProgress[r.id]?.bossDefeated ?? false)) return r.id;
      }
      return null;
    })();

    // Layout: nodes arranged vertically, two columns (alternating left/right)
    const nodeW = 560;
    const nodeH = 90;
    const colLeft = 200;
    const colRight = W - 200 - nodeW;
    const startY = 72;
    const stepY = 110;

    nodes.forEach((node, i) => {
      const isLeft = i % 2 === 0;
      const nx = isLeft ? colLeft : colRight;
      const ny = startY + i * stepY;

      const regionProgress = save.regionProgress[node.id];
      const isUnlocked = node.region ? isContentUnlocked(node.region) : false;
      const isBossDefeated = regionProgress?.bossDefeated ?? false;
      const isCurrent = save.currentRegionId === node.id;

      const bgColor = isCurrent ? NODE_CURRENT : (isUnlocked ? NODE_UNLOCKED : NODE_LOCKED);
      const borderColor = isUnlocked ? NODE_BORDER_UNLOCKED : NODE_BORDER_LOCKED;

      const bg = this.add.rectangle(nx + nodeW / 2, ny + nodeH / 2, nodeW, nodeH, bgColor)
        .setStrokeStyle(4, borderColor);

      // Node label
      const labelColor = isUnlocked ? TEXT_COLOR : DIM_COLOR;
      const displayLabel = (isUnlocked ? '' : '🔒 ') + node.label;
      this.add.text(nx + 24, ny + nodeH / 2, displayLabel, {
        fontFamily: FONT, fontSize: '28px', color: labelColor
      }).setOrigin(0, 0.5);

      // ✓ on boss defeated
      if (isBossDefeated) {
        this.add.text(nx + nodeW - 24, ny + nodeH / 2, '✓', {
          fontFamily: FONT, fontSize: '32px', color: '#a6e3a1'
        }).setOrigin(1, 0.5);
      }

      // Player marker
      if (isCurrent) {
        this.add.text(nx + nodeW - 24, ny + nodeH / 2, '▶', {
          fontFamily: FONT, fontSize: '32px', color: '#f9e2af'
        }).setOrigin(1, 0.5);
      }

      // "Start here" hint on the first uncleared unlocked region
      if (node.id === startHereId) {
        this.add.text(nx + nodeW + 20, ny + nodeH / 2, '◀ START HERE', {
          fontFamily: FONT, fontSize: '24px', color: '#a6e3a1', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
      }

      // Connector line to next node
      if (i < nodes.length - 1) {
        const nextLeft = (i + 1) % 2 === 0;
        const nextNx = nextLeft ? colLeft : colRight;
        const nextNy = startY + (i + 1) * stepY;
        const g = this.add.graphics();
        g.lineStyle(4, DIM_COLOR_NUM, 0.4);
        g.beginPath();
        g.moveTo(nx + nodeW / 2, ny + nodeH);
        g.lineTo(nextNx + nodeW / 2, nextNy);
        g.strokePath();
      }

      // Interactivity
      bg.setInteractive({ useHandCursor: isUnlocked });
      bg.on('pointerdown', () => {
        if (isUnlocked) {
          this.enterRegion(node.id);
        } else {
          this.showToast('Restore the previous region\'s equilibrium first.');
        }
      });
    });

    // Completion banner — shows once the last shipped region's boss is down.
    const lastRegion: RegionDef | undefined = content.regions[content.regions.length - 1];
    if (lastRegion && (save.regionProgress[lastRegion.id]?.bossDefeated ?? false)) {
      const bannerY = H - 60;
      this.add.rectangle(W / 2, bannerY, W - 80, 72, 0x1a2f1a)
        .setStrokeStyle(4, 0x40a040);
      this.add.text(W / 2, bannerY, 'Region complete — more of Æquor awaits in a future update', {
        fontFamily: FONT, fontSize: '28px', color: '#a6e3a1'
      }).setOrigin(0.5);
    }

    // Menu button — opens MenuScene as an overlay
    const menuBtn = this.add.text(W - 32, 32, '[Menu]', {
      fontFamily: FONT, fontSize: '32px', color: DIM_COLOR
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    const openMenu = (): void => {
      if (this.scene.isActive('MenuScene') || !this.scene.get('MenuScene')) return;
      this.scene.launch('MenuScene', { returnTo: 'WorldMapScene' });
      this.scene.pause();
    };
    menuBtn.on('pointerdown', openMenu);
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', openMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb?.off('keydown-ESC', openMenu));
  }

  private enterRegion(regionId: string): void {
    this.scene.start('OverworldScene', { regionId });
  }

  private showToast(message: string): void {
    const toast = this.add.text(W / 2, H / 2 - 80, message, {
      fontFamily: FONT, fontSize: '32px', color: '#f38ba8',
      backgroundColor: '#0d1b2a', padding: { x: 32, y: 16 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => toast.destroy()
    });
  }
}
