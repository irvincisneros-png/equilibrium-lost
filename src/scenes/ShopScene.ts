import Phaser from 'phaser';
import type { GameContent, SaveData, EquipmentDef } from '../content/types';
import { canEquip } from '../systems/equipment';
import { persist as savePersist } from '../persist';

interface ShopSceneData {
  regionId: string;
  returnTo: string;
  returnData: Record<string, unknown>;
}

const W = 1920, H = 1080, FONT = 'monospace';

// Vendor greetings by shop id — drawn from each shopkeeper's opening dialogue node
const SHOP_GREETINGS: Record<string, { vendor: string; greeting: string; colour: number }> = {
  'shop-elemental-reaches': {
    vendor: 'Vendor Mara',
    greeting: 'Atoms are everywhere — and so is quality gear. Browse what I have?',
    colour: 0x4e8abf,
  },
  'shop-bonding-forge': {
    vendor: 'Merchant Rho',
    greeting: 'Good equipment makes the difference between a clean bond and a broken one.',
    colour: 0xb87333,
  },
  'shop-reaction-hollow': {
    vendor: 'Trader Kira',
    greeting: 'Every reaction leaves a residue — the best ones leave behind fine equipment.',
    colour: 0xd97f3a,
  },
  'shop-balance-halls': {
    vendor: 'Vendor Theron',
    greeting: 'Every equation has two sides — and every chemist needs knowledge and equipment.',
    colour: 0x6e9e6e,
  },
  'shop-catalyst-crags': {
    vendor: 'Merchant Vex',
    greeting: 'Catalyst Crags run fast — so does my business. Everything here accelerates your edge.',
    colour: 0xc07a3a,
  },
  'shop-acid-wastes': {
    vendor: 'Trader Osh',
    greeting: "Acid eats through most things, but good equipment resists. Don't come through unprepared.",
    colour: 0x7abf4e,
  },
  'shop-the-crucible': {
    vendor: 'Vendor Brix',
    greeting: 'The Crucible tests everything — my gear is forged right here in the heat. It holds.',
    colour: 0xc84b20,
  },
  'shop-equilibriums-heart': {
    vendor: 'Merchant Mira',
    greeting: "Equilibrium's Heart holds the final balance. You'll want every advantage you can get.",
    colour: 0x9a6bbf,
  },
};

// Portrait dimensions and position
const PORTRAIT_W = 160, PORTRAIT_H = 200, PORTRAIT_X = 40, PORTRAIT_Y = 120;
// List starts to the right of the portrait
const LIST_X = PORTRAIT_X + PORTRAIT_W + 40;

export class ShopScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private returnTo = '';
  private returnData: Record<string, unknown> = {};
  private shopEquipmentIds: string[] = [];

  private rowButtons: Phaser.GameObjects.Text[] = [];
  private rowIdx = 0;
  private headerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private shopId = '';

  constructor() { super('ShopScene'); }

  create(data: ShopSceneData): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('WorldMapScene'); return; }
    this.save = save;
    this.returnTo = data.returnTo;
    this.returnData = data.returnData ?? {};
    this.rowIdx = 0;

    const shopEntry = Object.entries(this.content.shops ?? {}).find(([, s]) => s.regionId === data.regionId);
    if (!shopEntry) {
      console.warn(`[ShopScene] no shop for region "${data.regionId}"`);
      this.exitScene();
      return;
    }
    const [shopId, shop] = shopEntry;
    this.shopId = shopId;
    this.shopEquipmentIds = shop.equipmentIds;

    this.cameras.main.setBackgroundColor('#050810');
    this.add.rectangle(0, 0, W, H, 0x050810).setOrigin(0, 0);
    this.add.text(W / 2, 32, `${shop.name}`, { fontFamily: FONT, fontSize: '44px', color: '#f9e2af' }).setOrigin(0.5, 0);
    this.add.text(W / 2, H - 80, '↑/↓ select   Enter buy   ESC exit', { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setOrigin(0.5, 0);
    this.headerText = this.add.text(LIST_X, 96, '', { fontFamily: FONT, fontSize: '32px', color: '#89dceb' }).setOrigin(0, 0);
    this.toastText = this.add.text(W / 2, H - 44, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af' }).setOrigin(0.5, 0);

    this.buildVendorPortrait(shopId);
    this.buildList();

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      kb.on('keydown-ENTER', this.onConfirm, this);
      kb.on('keydown-SPACE', this.onConfirm, this);
      kb.on('keydown-ESC', this.exitScene, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.exitScene, this);
      });
    }
  }

  override update(): void {
    if (!this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.rowIdx = (this.rowIdx + this.rowButtons.length - 1) % this.rowButtons.length;
      this.highlight();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.rowIdx = (this.rowIdx + 1) % this.rowButtons.length;
      this.highlight();
    }
  }

  private buildVendorPortrait(shopId: string): void {
    const info = SHOP_GREETINGS[shopId];
    if (!info) return;

    // Portrait panel — slides in from left
    const panelX = PORTRAIT_X - PORTRAIT_W - 20;
    const panel = this.add.graphics();
    panel.fillStyle(info.colour, 0.85);
    panel.fillRoundedRect(0, 0, PORTRAIT_W, PORTRAIT_H, 12);
    panel.lineStyle(2, 0xffffff, 0.3);
    panel.strokeRoundedRect(0, 0, PORTRAIT_W, PORTRAIT_H, 12);
    panel.x = panelX;
    panel.y = PORTRAIT_Y;

    // Vendor icon placeholder (initials in centre)
    const initials = info.vendor.split(' ').map(w => w[0]).join('').slice(0, 2);
    const icon = this.add.text(panelX + PORTRAIT_W / 2, PORTRAIT_Y + PORTRAIT_H / 2 - 10, initials, {
      fontFamily: FONT, fontSize: '64px', color: '#ffffffcc',
    }).setOrigin(0.5).setAlpha(0);

    // Vendor name below portrait
    const nameText = this.add.text(PORTRAIT_X + PORTRAIT_W / 2, PORTRAIT_Y + PORTRAIT_H + 8, info.vendor, {
      fontFamily: FONT, fontSize: '20px', color: '#f9e2af',
    }).setOrigin(0.5, 0).setAlpha(0);

    // Speech bubble — greeting text to the right of portrait
    const bubbleX = PORTRAIT_X + PORTRAIT_W + 12;
    const bubbleY = PORTRAIT_Y + 8;
    const bubbleW = 520;
    const bubble = this.add.graphics();
    bubble.fillStyle(0x1a1e2e, 0.92);
    bubble.fillRoundedRect(0, 0, bubbleW, 80, 10);
    bubble.lineStyle(1, 0xf9e2af, 0.5);
    bubble.strokeRoundedRect(0, 0, bubbleW, 80, 10);
    bubble.x = bubbleX;
    bubble.y = bubbleY;
    bubble.setAlpha(0);

    const greetingText = this.add.text(bubbleX + 14, bubbleY + 12, `"${info.greeting}"`, {
      fontFamily: FONT, fontSize: '18px', color: '#cdd6f4',
      wordWrap: { width: bubbleW - 28 },
    }).setOrigin(0, 0).setAlpha(0);

    // Tween: portrait slides in
    this.tweens.add({
      targets: [panel, icon],
      x: (target: { x: number }) => target === panel ? PORTRAIT_X : PORTRAIT_X + PORTRAIT_W / 2,
      alpha: 1,
      duration: 250,
      ease: 'Power2',
    });

    // Name fades in after portrait lands
    this.time.delayedCall(200, () => {
      this.tweens.add({ targets: nameText, alpha: 1, duration: 200 });
    });

    // Greeting fades in after portrait
    this.time.delayedCall(320, () => {
      this.tweens.add({ targets: [bubble, greetingText], alpha: 1, duration: 250 });
    });
  }

  private buildList(): void {
    for (const b of this.rowButtons) b.destroy();
    this.rowButtons = [];

    this.headerText.setText(`Balance: ${this.save.drachms} ⬡`);

    const classId = this.save.classId;
    const startY = 160;

    this.shopEquipmentIds.forEach((id, i) => {
      const eq = this.content.equipment?.[id];
      if (!eq) return;
      const owned = this.save.ownedEquipmentIds.includes(id);
      const equippable = canEquip(eq, classId);
      const label = this.buildLabel(eq, owned, equippable);
      const btn = this.add.text(LIST_X, startY + i * 48, label, {
        fontFamily: FONT, fontSize: '26px',
        color: equippable ? '#cdd6f4' : '#566074',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { this.rowIdx = i; this.highlight(); });
      btn.on('pointerdown', () => { this.rowIdx = i; this.tryBuy(); });
      this.rowButtons.push(btn);
    });

    this.highlight();
  }

  private buildLabel(eq: EquipmentDef, owned: boolean, equippable: boolean): string {
    const ownedTag = owned ? ' ✓' : '';
    const classTag = equippable ? '' : ' (wrong class)';
    const price = eq.shopPrice !== null ? `${eq.shopPrice} ⬡` : 'Boss drop';
    const stats = `ATK+${eq.atkBonus} DEF+${eq.defBonus} SPD+${eq.spdBonus} HP+${eq.hpBonus}`;
    return `${eq.name}  [T${eq.tier} ${eq.kind}]  ${stats}  — ${price}${ownedTag}${classTag}`;
  }

  private highlight(): void {
    this.rowButtons.forEach((b, i) => {
      b.setColor(i === this.rowIdx ? '#f9e2af' : (b.text.includes('wrong class') ? '#566074' : '#cdd6f4'));
    });
  }

  private onConfirm(): void { this.tryBuy(); }

  private tryBuy(): void {
    const id = this.shopEquipmentIds[this.rowIdx];
    if (!id) return;
    const eq = this.content.equipment?.[id];
    if (!eq) return;
    if (eq.shopPrice === null) { this.toast('Boss drop only — not for sale.'); return; }
    if (this.save.ownedEquipmentIds.includes(id)) { this.toast('Already owned.'); return; }
    if (!canEquip(eq, this.save.classId)) { this.toast("Your class can't wield that."); return; }
    if (this.save.drachms < eq.shopPrice) { this.toast(`Not enough ⬡ (need ${eq.shopPrice}).`); return; }
    this.save.drachms -= eq.shopPrice;
    this.save.ownedEquipmentIds.push(id);
    this.registry.set('save', this.save);
    savePersist();
    this.toast(`Bought: ${eq.name}!`);
    this.buildList();
  }

  private toast(msg: string): void {
    this.toastText.setText(msg);
    this.time.delayedCall(2200, () => { if (this.toastText.text === msg) this.toastText.setText(''); });
  }

  private exitScene = (): void => {
    this.scene.stop();
    this.scene.start(this.returnTo, this.returnData);
  };
}
