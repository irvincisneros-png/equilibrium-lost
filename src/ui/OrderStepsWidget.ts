import Phaser from 'phaser';

const FONT = 'monospace';
const CARD_H = 56;
const CARD_GAP = 12;
const SLOT_PITCH = CARD_H + CARD_GAP;

export interface OrderStepsWidgetOpts {
  /** Called once when the player submits, with their order as indices into the original steps array. */
  onSubmit: (order: number[]) => void;
  /** Register scene keyboard listeners that the host QuizPanel will clean up. */
  registerKey: (event: string, fn: (e: KeyboardEvent) => void) => void;
}

/**
 * A "drag the steps into the right order" widget. The host owns teardown:
 * Container.destroy() removes the children, and registered keys are cleaned up
 * through QuizPanel's key lifecycle.
 */
export class OrderStepsWidget extends Phaser.GameObjects.Container {
  private readonly steps: string[];
  private readonly widgetW: number;
  private readonly onSubmit: (order: number[]) => void;
  private order: number[];
  private cards: Phaser.GameObjects.Container[] = [];
  private cardBgs: Phaser.GameObjects.Rectangle[] = [];
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private focus = 0;
  private dragging = -1;
  private dragOffsetY = 0;
  private submitted = false;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, steps: string[], opts: OrderStepsWidgetOpts) {
    super(scene, x, y);
    this.steps = steps;
    this.widgetW = width;
    this.onSubmit = opts.onSubmit;
    this.order = OrderStepsWidget.shuffledIdentity(steps.length, () => Math.random());
    this.buildCards();
    this.layoutCards(true);
    this.buildSubmitButton();
    this.highlightFocus();
    this.attachKeys(opts.registerKey);
    scene.add.existing(this);
  }

  /** A random permutation of 0..n-1 that is not the identity, so the puzzle never starts solved. */
  static shuffledIdentity(n: number, rng: () => number): number[] {
    if (n <= 0) return [];
    if (n === 1) return [0];
    let a: number[];
    do {
      a = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
    } while (a.every((v, i) => v === i));
    return a;
  }

  private slotY(slot: number): number { return slot * SLOT_PITCH; }

  private buildCards(): void {
    const cardW = this.widgetW - 80;
    this.cards = this.steps.map((text, origIdx) => {
      const card = this.scene.add.container(0, 0);
      const bg = this.scene.add.rectangle(0, 0, cardW, CARD_H, 0x1b2a3a, 1).setOrigin(0, 0).setStrokeStyle(2, 0x415a77);
      const grip = this.scene.add.text(14, CARD_H / 2, '≡', { fontFamily: FONT, fontSize: '26px', color: '#8fa3c0' }).setOrigin(0.5);
      const label = this.scene.add.text(44, CARD_H / 2, text, {
        fontFamily: FONT, fontSize: '22px', color: '#cdd6f4', wordWrap: { width: cardW - 58 }, lineSpacing: 2,
      }).setOrigin(0, 0.5);

      card.add([bg, grip, label]);
      bg.setInteractive({ useHandCursor: true, draggable: true });
      bg.on('dragstart', (pointer: Phaser.Input.Pointer) => this.onDragStart(origIdx, pointer));
      bg.on('drag', (pointer: Phaser.Input.Pointer) => this.onDrag(origIdx, pointer));
      bg.on('dragend', () => this.onDragEnd(origIdx));
      this.add(card);
      this.cardBgs[origIdx] = bg;
      return card;
    });
  }

  private slotOf(origIdx: number): number { return this.order.indexOf(origIdx); }

  private pointerLocalY(pointer: Phaser.Input.Pointer): number {
    return pointer.worldY - this.getWorldTransformMatrix().ty;
  }

  private onDragStart(origIdx: number, pointer: Phaser.Input.Pointer): void {
    const slot = this.slotOf(origIdx);
    if (slot < 0) return;
    const card = this.cards[origIdx]!;
    this.dragging = slot;
    this.focus = slot;
    this.dragOffsetY = this.pointerLocalY(pointer) - card.y;
    this.bringToTop(card);
    this.cardBgs[origIdx]?.setFillStyle(0x26384c, 1);
    this.highlightFocus();
  }

  private onDrag(origIdx: number, pointer: Phaser.Input.Pointer): void {
    if (this.dragging < 0) return;
    const card = this.cards[origIdx]!;
    const minY = this.slotY(0) - CARD_H / 2;
    const maxY = this.slotY(this.steps.length - 1) + CARD_H / 2;
    const y = Phaser.Math.Clamp(this.pointerLocalY(pointer) - this.dragOffsetY, minY, maxY);
    card.setY(y);

    const centreY = y + CARD_H / 2;
    const targetSlot = Phaser.Math.Clamp(Math.round(centreY / SLOT_PITCH), 0, this.steps.length - 1);
    if (targetSlot === this.dragging) return;

    const [moved] = this.order.splice(this.dragging, 1);
    if (moved === undefined) return;
    this.order.splice(targetSlot, 0, moved);
    this.dragging = targetSlot;
    this.focus = targetSlot;
    this.layoutCards(false);
    this.highlightFocus();
  }

  private onDragEnd(origIdx: number): void {
    if (this.dragging >= 0) this.focus = this.dragging;
    this.dragging = -1;
    this.cardBgs[origIdx]?.setFillStyle(0x1b2a3a, 1);
    this.layoutCards(true);
    this.highlightFocus();
  }

  /** Position every card at its slot's y. */
  private layoutCards(includeDragged: boolean): void {
    this.order.forEach((origIdx, slot) => {
      if (!includeDragged && slot === this.dragging) return;
      this.cards[origIdx]!.setPosition(40, this.slotY(slot));
    });
    this.redrawSlotNumbers();
  }

  private redrawSlotNumbers(): void {
    while (this.slotLabels.length > this.steps.length) this.slotLabels.pop()?.destroy();
    for (let i = 0; i < this.steps.length; i++) {
      if (!this.slotLabels[i]) {
        const label = this.scene.add.text(8, this.slotY(i) + CARD_H / 2, '', {
          fontFamily: FONT, fontSize: '22px', color: '#8fa3c0',
        }).setOrigin(0, 0.5);
        this.slotLabels[i] = label;
        this.add(label);
      }
      this.slotLabels[i]!.setText(`${i + 1}.`).setPosition(8, this.slotY(i) + CARD_H / 2);
    }
  }

  private buildSubmitButton(): void {
    const y = this.slotY(this.steps.length) + 8;
    const btn = this.scene.add.text((this.widgetW - 80) / 2, y, '[ Submit ⏎ ]', {
      fontFamily: FONT, fontSize: '28px', color: '#a6e3a1',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#a6e3a1'));
    btn.on('pointerdown', () => this.submit());
    this.add(btn);
  }

  private attachKeys(register: (event: string, fn: (e: KeyboardEvent) => void) => void): void {
    register('keydown-UP', (e) => {
      e.preventDefault();
      if (e.shiftKey) this.moveFocused(-1);
      else {
        this.focus = Math.max(0, this.focus - 1);
        this.highlightFocus();
      }
    });
    register('keydown-DOWN', (e) => {
      e.preventDefault();
      if (e.shiftKey) this.moveFocused(1);
      else {
        this.focus = Math.min(this.steps.length - 1, this.focus + 1);
        this.highlightFocus();
      }
    });
    register('keydown-ENTER', () => this.submit());
  }

  private moveFocused(delta: number): void {
    const j = this.focus + delta;
    if (j < 0 || j >= this.steps.length) return;
    [this.order[this.focus], this.order[j]] = [this.order[j]!, this.order[this.focus]!];
    this.focus = j;
    this.layoutCards(true);
    this.highlightFocus();
  }

  private highlightFocus(): void {
    this.order.forEach((origIdx, slot) => {
      const bg = this.cardBgs[origIdx]!;
      bg.setStrokeStyle(slot === this.focus ? 3 : 2, slot === this.focus ? 0xf9e2af : 0x415a77);
    });
  }

  private submit(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.onSubmit([...this.order]);
  }
}
