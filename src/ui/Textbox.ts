import Phaser from 'phaser';
import { chunkText } from './textWrap';

export interface TextboxOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  charsPerLine?: number;
  linesPerPage?: number;
  speedMs?: number;
}

export class Textbox extends Phaser.GameObjects.Container {
  private readonly opts: Required<TextboxOptions>;
  private textObj!: Phaser.GameObjects.Text;
  private caretObj!: Phaser.GameObjects.Text;
  private pages: string[][] = [];
  private pageIdx = 0;
  private charIdx = 0;
  private ticker: Phaser.Time.TimerEvent | null = null;
  private revealing = false;

  constructor(scene: Phaser.Scene, opts: TextboxOptions) {
    super(scene, opts.x, opts.y);
    this.opts = {
      x: opts.x,
      y: opts.y,
      w: opts.w,
      h: opts.h,
      charsPerLine: opts.charsPerLine ?? 36,
      linesPerPage: opts.linesPerPage ?? 3,
      speedMs: opts.speedMs ?? 40,
    };

    // Panel background: stretched image of 'ui_textbox'
    const panel = scene.add.image(0, 0, 'ui_textbox')
      .setDisplaySize(this.opts.w, this.opts.h)
      .setOrigin(0, 0);
    this.add(panel);

    // border rect
    const border = scene.add.rectangle(0, 0, this.opts.w, this.opts.h)
      .setOrigin(0, 0)
      .setStrokeStyle(4, 0x415a77)
      .setFillStyle(0, 0); // transparent fill
    this.add(border);

    // Text object for content
    this.textObj = scene.add.text(32, 32, '', {
      fontFamily: 'monospace',
      fontSize: '44px',
      color: '#cdd6f4',
      wordWrap: { width: this.opts.w - 64 },
    }).setOrigin(0, 0);
    this.add(this.textObj);

    // Advance caret
    this.caretObj = scene.add.text(this.opts.w - 64, this.opts.h - 64, '▼', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#cdd6f4',
    }).setOrigin(0.5).setVisible(false);
    this.add(this.caretObj);

    scene.add.existing(this);

    // Advance on pointer down anywhere on the scene
    scene.input.on('pointerdown', this.handleAdvance, this);
    // Advance on Enter/Space key
    const keys = scene.input.keyboard;
    if (keys) {
      keys.on('keydown-ENTER', this.handleAdvance, this);
      keys.on('keydown-SPACE', this.handleAdvance, this);
    }
  }

  show(text: string): void {
    const pages = chunkText(text, this.opts.charsPerLine, this.opts.linesPerPage);
    this.showPages(pages);
  }

  showPages(pages: string[][]): void {
    this.stopTicker();
    this.pages = pages.length > 0 ? pages : [['']];
    this.pageIdx = 0;
    this.revealPage();
  }

  skip(): void {
    if (!this.revealing) return;
    this.stopTicker();
    this.revealing = false;
    const page = this.pages[this.pageIdx];
    if (page) {
      this.textObj.setText(page.join('\n'));
    }
    const isLast = this.pageIdx >= this.pages.length - 1;
    this.caretObj.setVisible(!isLast);
    // Mirror revealPage()'s natural-completion path: a skipped *last* page must still
    // fire 'complete', or consumers (e.g. DialogueScene) stall forever. (Was the freeze bug.)
    if (isLast) this.emit('complete');
  }

  private revealPage(): void {
    const page = this.pages[this.pageIdx];
    if (!page) return;
    const fullText = page.join('\n');
    this.charIdx = 0;
    this.revealing = true;
    this.caretObj.setVisible(false);
    this.textObj.setText('');

    this.stopTicker();
    this.ticker = this.scene.time.addEvent({
      delay: this.opts.speedMs,
      loop: true,
      callback: () => {
        this.charIdx++;
        this.textObj.setText(fullText.slice(0, this.charIdx));
        if (this.charIdx >= fullText.length) {
          this.stopTicker();
          this.revealing = false;
          const isLast = this.pageIdx >= this.pages.length - 1;
          this.caretObj.setVisible(!isLast);
          if (isLast) {
            this.emit('complete');
          }
        }
      },
    });
  }

  private handleAdvance(): void {
    if (this.revealing) {
      this.skip();
      return;
    }
    const isLast = this.pageIdx >= this.pages.length - 1;
    if (isLast) return;
    this.emit('pageAdvance', this.pageIdx);
    this.pageIdx++;
    this.revealPage();
  }

  private stopTicker(): void {
    if (this.ticker) {
      this.ticker.remove();
      this.ticker = null;
    }
  }

  destroy(fromScene?: boolean): void {
    this.stopTicker();
    const keys = this.scene?.input?.keyboard;
    if (keys) {
      keys.off('keydown-ENTER', this.handleAdvance, this);
      keys.off('keydown-SPACE', this.handleAdvance, this);
    }
    this.scene?.input?.off('pointerdown', this.handleAdvance, this);
    super.destroy(fromScene);
  }
}
