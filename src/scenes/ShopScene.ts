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

  constructor() { super('ShopScene'); }

  create(data: ShopSceneData): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('WorldMapScene'); return; }
    this.save = save;
    this.returnTo = data.returnTo;
    this.returnData = data.returnData ?? {};
    this.rowIdx = 0;

    const shop = Object.values(this.content.shops ?? {}).find(s => s.regionId === data.regionId);
    if (!shop) {
      console.warn(`[ShopScene] no shop for region "${data.regionId}"`);
      this.exitScene();
      return;
    }
    this.shopEquipmentIds = shop.equipmentIds;

    this.cameras.main.setBackgroundColor('#050810');
    this.add.rectangle(0, 0, W, H, 0x050810).setOrigin(0, 0);
    this.add.text(W / 2, 32, `${shop.name}`, { fontFamily: FONT, fontSize: '44px', color: '#f9e2af' }).setOrigin(0.5, 0);
    this.add.text(W / 2, H - 80, '↑/↓ select   Enter buy   ESC exit', { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setOrigin(0.5, 0);
    this.headerText = this.add.text(W / 2, 96, '', { fontFamily: FONT, fontSize: '32px', color: '#89dceb' }).setOrigin(0.5, 0);
    this.toastText = this.add.text(W / 2, H - 44, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af' }).setOrigin(0.5, 0);

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
      const btn = this.add.text(160, startY + i * 48, label, {
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
