import Phaser from 'phaser';
import { Textbox } from '../ui/Textbox';
import { entryNode, nextNode } from '../ui/DialogueRunner';
import { persist as savePersist } from '../persist';
import type { DialogueNode, NpcDef, SaveData } from '../content/types';
import type { GameContent } from '../content/types';

interface DialogueSceneData {
  npcId: string;
  returnTo: string;
  returnData?: Record<string, unknown>;
}

const CHOICE_COLOR_DEFAULT = '#cdd6f4';
const CHOICE_COLOR_SELECTED = '#f9e2af';
const OVERLAY_ALPHA = 0.7;

export class DialogueScene extends Phaser.Scene {
  // ----- live state -----
  private tree: DialogueNode[] = [];
  private npc!: NpcDef;
  private returnTo = '';
  private returnData: Record<string, unknown> = {};

  private currentNode!: DialogueNode;
  private textbox!: Textbox;
  private speakerTag!: Phaser.GameObjects.Text;

  // choice list state
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private choiceIndex = 0;
  private choiceVisible = false;
  private choiceReady = false;
  private choiceGeneration = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // "press to continue" state — when a node's text is fully shown, hold it on screen and
  // wait for an explicit press before advancing to the next node / ending the conversation.
  private pendingAdvance: (() => void) | null = null;
  private continueReady = false;
  private continueGeneration = 0;

  constructor() { super('DialogueScene'); }

  create(data: DialogueSceneData): void {
    const content = this.registry.get('content') as GameContent | undefined;
    if (!content) {
      console.error('[DialogueScene] no content on registry');
      this.closeScene();
      return;
    }

    this.returnTo = data.returnTo;
    this.returnData = data.returnData ?? {};

    const npc = content.npcs[data.npcId];
    if (!npc) {
      console.error(`[DialogueScene] unknown npc "${data.npcId}"`);
      this.closeScene();
      return;
    }
    this.npc = npc;
    this.tree = npc.dialogue;

    // Semi-transparent overlay covering the whole canvas
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, OVERLAY_ALPHA).setOrigin(0, 0);

    // Speaker name tag (sits just above the textbox)
    const textboxY = height - 320;
    this.speakerTag = this.add.text(32, textboxY - 56, '', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#f9e2af',
      backgroundColor: '#1e1e2e',
      padding: { x: 16, y: 8 },
    });

    // Textbox
    this.textbox = new Textbox(this, {
      x: 0,
      y: textboxY,
      w: width,
      h: 304,
      charsPerLine: 64,
      linesPerPage: 3,
      speedMs: 18,
    });

    // Keyboard cursor keys for choice navigation; Enter/Space both confirm a choice AND advance
    // the conversation past a fully-shown node; pointer-down also advances.
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-ENTER', this.handleChoiceConfirm, this);
      this.input.keyboard.on('keydown-SPACE', this.handleChoiceConfirm, this);
      this.input.keyboard.on('keydown-ENTER', this.advanceDialogue, this);
      this.input.keyboard.on('keydown-SPACE', this.advanceDialogue, this);
    }
    this.input.on('pointerdown', this.advanceDialogue, this);

    // Clean up listeners when scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.input.keyboard) {
        this.input.keyboard.off('keydown-ENTER', this.handleChoiceConfirm, this);
        this.input.keyboard.off('keydown-SPACE', this.handleChoiceConfirm, this);
        this.input.keyboard.off('keydown-ENTER', this.advanceDialogue, this);
        this.input.keyboard.off('keydown-SPACE', this.advanceDialogue, this);
      }
      this.input.off('pointerdown', this.advanceDialogue, this);
    });

    // Begin at the entry node
    const entry = entryNode(this.tree);
    this.enterNode(entry);

    // When textbox finishes revealing the last page → decide what to do
    this.textbox.on('complete', this.handleTextComplete, this);
  }

  // -----------------------------------------------------------------------
  // Node navigation
  // -----------------------------------------------------------------------

  private enterNode(node: DialogueNode): void {
    this.currentNode = node;

    // We're revealing fresh text — drop any armed "press to continue".
    this.pendingAdvance = null;
    this.continueReady = false;
    this.continueGeneration++;

    // Apply setFlag if present
    this.applySetFlag(node.setFlag);

    // Update speaker tag
    const speaker = node.speaker ?? this.npc.name;
    this.speakerTag.setText(speaker);

    // Dismiss any existing choice UI
    this.clearChoices();

    // Show text
    this.textbox.show(node.text);
  }

  private handleTextComplete(): void {
    const node = this.currentNode;

    if (node.choices && node.choices.length > 0) {
      // Show choice list — wait for player selection
      this.showChoices(node.choices.map(c => c.label));
      return;
    }
    // Linear or terminal node — hold it on screen until the player presses to continue.
    if (node.end === true || !node.next) {
      this.armContinue(() => this.handleEnd(node));
    } else {
      const result = nextNode(this.tree, node.id);
      this.armContinue(() => this.enterNode(result.node));
    }
  }

  /** A node's text is fully shown. Show the ▼ caret and wait for the next press to run `action`. */
  private armContinue(action: () => void): void {
    this.pendingAdvance = action;
    this.continueReady = false;
    const gen = ++this.continueGeneration;
    this.textbox.setCaretVisible(true);
    // Defer "ready" one tick so the keypress that finished/skipped the reveal isn't *also*
    // counted as the continue press (mirrors the choice-list debounce).
    this.time.delayedCall(0, () => { if (this.continueGeneration === gen) this.continueReady = true; });
  }

  private advanceDialogue(): void {
    if (!this.pendingAdvance || !this.continueReady) return;
    const action = this.pendingAdvance;
    this.pendingAdvance = null;
    this.continueReady = false;
    this.continueGeneration++;
    action();
  }

  // -----------------------------------------------------------------------
  // Choice UI
  // -----------------------------------------------------------------------

  private showChoices(labels: string[]): void {
    this.choiceVisible = true;
    this.choiceReady = false;
    this.pendingAdvance = null;
    this.textbox.setCaretVisible(false);
    const generation = ++this.choiceGeneration;
    this.choiceIndex = 0;

    const { width, height } = this.scale;
    const startY = height - 400 - labels.length * 72;

    this.choiceTexts = labels.map((label, i) => {
      const txt = this.add.text(64, startY + i * 72, '▷ ' + label, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: CHOICE_COLOR_DEFAULT,
      });
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => {
        this.choiceIndex = i;
        this.refreshChoiceHighlight();
      });
      txt.on('pointerdown', () => {
        this.choiceIndex = i;
        this.confirmChoice();
      });
      return txt;
    });

    // Unused parameter: suppress lint
    void width;

    this.refreshChoiceHighlight();
    this.time.delayedCall(0, () => {
      if (this.choiceVisible && this.choiceGeneration === generation) {
        this.choiceReady = true;
      }
    });
  }

  private refreshChoiceHighlight(): void {
    this.choiceTexts.forEach((txt, i) => {
      txt.setColor(i === this.choiceIndex ? CHOICE_COLOR_SELECTED : CHOICE_COLOR_DEFAULT);
    });
  }

  private clearChoices(): void {
    for (const txt of this.choiceTexts) txt.destroy();
    this.choiceTexts = [];
    this.choiceVisible = false;
    this.choiceReady = false;
    this.choiceGeneration++;
  }

  private handleChoiceConfirm(): void {
    if (!this.choiceVisible || !this.choiceReady) return;
    this.confirmChoice();
  }

  private confirmChoice(): void {
    const node = this.currentNode;
    this.clearChoices();
    const result = nextNode(this.tree, node.id, this.choiceIndex);
    // setFlag is on the *resolved* node (already applied inside enterNode below)
    this.enterNode(result.node);
    if (result.end) {
      // enterNode shows the text; when it completes handleTextComplete fires → handleEnd
    }
  }

  // -----------------------------------------------------------------------
  // Update: keyboard navigation for choices
  // -----------------------------------------------------------------------

  override update(): void {
    if (!this.choiceVisible || !this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.choiceIndex = (this.choiceIndex - 1 + this.choiceTexts.length) % this.choiceTexts.length;
      this.refreshChoiceHighlight();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.choiceIndex = (this.choiceIndex + 1) % this.choiceTexts.length;
      this.refreshChoiceHighlight();
    }
  }

  // -----------------------------------------------------------------------
  // End handling
  // -----------------------------------------------------------------------

  private handleEnd(node: DialogueNode): void {
    const launch = node.launch;
    const regionId = typeof this.returnData.regionId === 'string' ? this.returnData.regionId : '';

    if (launch === 'shrine' && regionId && this.scene.get('ChallengeShrineScene')) {
      this.scene.stop(this.returnTo);
      this.scene.start('ChallengeShrineScene', { regionId });
      return;
    }
    if (launch === 'shop' && regionId) {
      this.scene.stop(this.returnTo);
      this.scene.start('ShopScene', { regionId, returnTo: this.returnTo, returnData: this.returnData });
      return;
    }
    if (typeof launch === 'string' && launch.startsWith('battle:') && regionId && this.scene.get('BattleScene')) {
      const enemyId = launch.slice('battle:'.length);
      this.scene.stop(this.returnTo);
      this.scene.start('BattleScene', { enemyId, regionId, returnTo: this.returnTo, returnData: this.returnData });
      return;
    }
    this.closeScene();
  }

  private closeScene(): void {
    // Persist story flags back to save (save may be null before newGame runs)
    const save = this.registry.get('save') as SaveData | null | undefined;
    if (save) {
      this.registry.set('save', save); // re-set in case registry listeners need a notification
      savePersist();
    }

    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private applySetFlag(flag: string | undefined): void {
    if (!flag) return;
    const save = this.registry.get('save') as SaveData | null | undefined;
    if (save?.storyFlags) {
      save.storyFlags[flag] = true;
    }
  }

}
