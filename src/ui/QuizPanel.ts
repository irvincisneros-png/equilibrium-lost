import Phaser from 'phaser';
import type { QuestionDef, BalanceEquationSpec } from '../content/types';

export interface QuizAnswer {
  index?: number;          // mcq selection 0..3
  widgetCoeffs?: number[]; // balanceEquation: one per term, [...reactants, ...products]
  fastAnswer: boolean;     // answered quickly under the (optional) countdown
}

export interface QuizAskOptions {
  studyMode: boolean;      // show the question's hint
  answerTimer?: boolean;   // run a countdown bar; answering in its first half sets fastAnswer
}

const FONT = 'monospace';
const C_BG = 0x0d1b2a;
const C_BORDER = 0x415a77;
const C_TEXT = '#cdd6f4';
const C_DIM = '#8fa3c0';
const C_ACCENT = '#f9e2af';
const C_OK = '#a6e3a1';
const DIGIT_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR'] as const;
const LETTER_KEYS = ['A', 'B', 'C', 'D'] as const;
const TIMER_MS = 5000;
const CORRECTION_MS = 2000;

type AnyHandler = (...args: unknown[]) => void;

/**
 * The in-battle question panel. It only *collects* an answer — grading is
 * `QuizEngine.checkAnswer`'s job. `ask()` resolves with the player's input;
 * `showCorrection()` then flashes the right answer + explanation for ~2s.
 *
 * MCQ → four labelled A–D buttons (mouse, keys 1-4 or A-D).
 * Balance-the-equation → a `[▲] n [▼] formula` stepper per term ([...reactants, ...products])
 * with `+`/`→` separators and a Submit button (mouse; ←/→ focus, ↑/↓ adjust, Enter submit).
 */
export class QuizPanel extends Phaser.GameObjects.Container {
  private readonly panelW: number;
  private readonly panelH: number;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly controlsText: Phaser.GameObjects.Text;
  private readonly timerBar: Phaser.GameObjects.Rectangle;

  private widgets: Phaser.GameObjects.GameObject[] = [];
  private keyHandlers: Array<[string, AnyHandler]> = [];
  private timerTween?: Phaser.Tweens.Tween;
  private resolver: ((a: QuizAnswer) => void) | null = null;

  // balance-widget state
  private coeffs: number[] = [];
  private coeffLabels: Phaser.GameObjects.Text[] = [];
  private focusIdx = 0;
  private timerActive = false;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    super(scene, x, y);
    this.panelW = w; this.panelH = h;
    this.add(scene.add.rectangle(0, 0, w, h, C_BG, 0.97).setOrigin(0, 0).setStrokeStyle(4, C_BORDER));
    this.promptText = scene.add.text(32, 32, '', { fontFamily: FONT, fontSize: '36px', color: C_TEXT, wordWrap: { width: w - 64 } }).setOrigin(0, 0);
    this.add(this.promptText);
    this.hintText = scene.add.text(32, h - 56, '', { fontFamily: FONT, fontSize: '28px', color: '#89dceb', wordWrap: { width: w - 64 } }).setOrigin(0, 1);
    this.add(this.hintText);
    this.controlsText = scene.add.text(w / 2, h - 14, '', { fontFamily: FONT, fontSize: '22px', color: '#8fa3c0', align: 'center' }).setOrigin(0.5, 1);
    this.add(this.controlsText);
    this.timerBar = scene.add.rectangle(0, h - 8, w, 8, 0xf9e2af).setOrigin(0, 0).setVisible(false);
    this.add(this.timerBar);
    scene.add.existing(this);
    this.setVisible(false);
  }

  /** Present `question`; resolves with the player's collected answer. */
  ask(question: QuestionDef, opts: QuizAskOptions): Promise<QuizAnswer> {
    this.reset();
    this.setVisible(true);
    this.promptText.setText(question.prompt);
    this.hintText.setText(opts.studyMode && question.hint ? `Hint: ${question.hint}` : '');

    if (question.format === 'balanceEquation' && question.equation) {
      this.buildBalance(question.equation);
      this.controlsText.setText('▲▼ buttons (or ←/→ pick a term, ↑/↓ change it) · Enter to submit').setVisible(true);
    } else {
      this.buildMcq(question.options ?? ['(error)', '(error)', '(error)', '(error)']);
      this.controlsText.setText('Click an answer — or press A · B · C · D  (or 1 · 2 · 3 · 4)').setVisible(true);
    }

    if (opts.answerTimer) this.startTimer();
    return new Promise<QuizAnswer>(resolve => { this.resolver = resolve; });
  }

  /** After grading, briefly show the result: "✓ Correct!" or "✗ The answer was …" + the explanation. Resolves when done. */
  showCorrection(question: QuestionDef, correct = false): Promise<void> {
    this.clearWidgets();
    this.clearKeys();
    this.stopTimer();
    this.setVisible(true);
    this.controlsText.setVisible(false);

    let answerStr = '';
    if (question.format === 'mcq' && question.options && typeof question.answerIndex === 'number') {
      answerStr = `${String.fromCharCode(65 + question.answerIndex)}. ${question.options[question.answerIndex] ?? ''}`;
    } else if (question.format === 'balanceEquation' && question.equation) {
      const coeffs = [...question.equation.reactants, ...question.equation.products].map(t => t.coeff);
      answerStr = this.equationString(question.equation, coeffs);
    }
    const heading = correct ? '✓ Correct!' : `✗ The answer was ${answerStr}`;
    const box = this.scene.add.text(32, 112, `${heading}\n— ${question.explanation}`, {
      fontFamily: FONT, fontSize: '32px', color: correct ? C_OK : '#f9e2af', wordWrap: { width: this.panelW - 64 }, lineSpacing: 8,
    }).setOrigin(0, 0);
    this.add(box);
    this.widgets.push(box);
    const cont = this.scene.add.text(this.panelW / 2, this.panelH - 16, '▸ Press Enter (or click) to continue', { fontFamily: FONT, fontSize: '22px', color: '#8fa3c0' }).setOrigin(0.5, 1);
    this.add(cont);
    this.widgets.push(cont);
    // Resolve on a keypress/click, or auto-advance after a generous read time — whichever first.
    return new Promise<void>(resolve => {
      const kb = this.scene.input.keyboard;
      const onPointer = (): void => finish();
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        kb?.off('keydown-ENTER', finish); kb?.off('keydown-SPACE', finish);
        this.scene.input?.off('pointerdown', onPointer);
        resolve();
      };
      kb?.on('keydown-ENTER', finish);
      kb?.on('keydown-SPACE', finish);
      this.scene.input.on('pointerdown', onPointer);
      this.scene.time.delayedCall(correct ? CORRECTION_MS : CORRECTION_MS + 1800, finish);
    });
  }

  hide(): void { this.setVisible(false); this.reset(); }

  override destroy(fromScene?: boolean): void { this.reset(); super.destroy(fromScene); }

  // --- mcq -----------------------------------------------------------------

  private buildMcq(options: string[]): void {
    const startY = 96;
    options.slice(0, 4).forEach((opt, i) => {
      const txt = this.scene.add.text(48, startY + i * 56, `${String.fromCharCode(65 + i)}.  ${opt}`, {
        fontFamily: FONT, fontSize: '32px', color: C_TEXT, wordWrap: { width: this.panelW - 96 },
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => txt.setColor(C_ACCENT));
      txt.on('pointerout', () => txt.setColor(C_TEXT));
      txt.on('pointerdown', () => this.choose({ index: i, fastAnswer: this.snapFast() }));
      this.add(txt);
      this.widgets.push(txt);
    });
    DIGIT_KEYS.forEach((k, i) => this.onKey(`keydown-${k}`, () => this.choose({ index: i, fastAnswer: this.snapFast() })));
    LETTER_KEYS.forEach((k, i) => this.onKey(`keydown-${k}`, () => this.choose({ index: i, fastAnswer: this.snapFast() })));
  }

  // --- balance equation ----------------------------------------------------

  private buildBalance(eq: BalanceEquationSpec): void {
    const terms = [...eq.reactants, ...eq.products];
    const rCount = eq.reactants.length;
    this.coeffs = terms.map(() => 1);
    this.coeffLabels = [];
    const midY = 152;
    let x = 48;
    terms.forEach((term, i) => {
      const up = this.scene.add.text(x + 16, midY - 56, '▲', { fontFamily: FONT, fontSize: '28px', color: C_DIM }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      up.on('pointerdown', () => this.bump(i, +1));
      const num = this.scene.add.text(x + 16, midY, '1', { fontFamily: FONT, fontSize: '40px', color: C_ACCENT }).setOrigin(0, 0.5);
      this.coeffLabels.push(num);
      const down = this.scene.add.text(x + 16, midY + 56, '▼', { fontFamily: FONT, fontSize: '28px', color: C_DIM }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      down.on('pointerdown', () => this.bump(i, -1));
      const f = this.scene.add.text(x + 64, midY, term.formula, { fontFamily: FONT, fontSize: '36px', color: C_TEXT }).setOrigin(0, 0.5);
      this.add([up, num, down, f]);
      this.widgets.push(up, num, down, f);
      x += 64 + f.width + 24;
      const sep = i === rCount - 1 ? '→' : (i < terms.length - 1 ? '+' : '');
      if (sep) {
        const s = this.scene.add.text(x, midY, sep, { fontFamily: FONT, fontSize: '36px', color: C_DIM }).setOrigin(0, 0.5);
        this.add(s); this.widgets.push(s);
        x += s.width + 24;
      }
    });
    const submit = this.scene.add.text(this.panelW - 48, midY, '[ Submit ⏎ ]', { fontFamily: FONT, fontSize: '32px', color: C_OK }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    submit.on('pointerover', () => submit.setColor('#ffffff'));
    submit.on('pointerout', () => submit.setColor(C_OK));
    submit.on('pointerdown', () => this.submitBalance());
    this.add(submit); this.widgets.push(submit);

    this.focusIdx = 0;
    this.highlightFocus();
    this.onKey('keydown-LEFT', () => { this.focusIdx = (this.focusIdx - 1 + terms.length) % terms.length; this.highlightFocus(); });
    this.onKey('keydown-RIGHT', () => { this.focusIdx = (this.focusIdx + 1) % terms.length; this.highlightFocus(); });
    this.onKey('keydown-UP', () => this.bump(this.focusIdx, +1));
    this.onKey('keydown-DOWN', () => this.bump(this.focusIdx, -1));
    this.onKey('keydown-ENTER', () => this.submitBalance());
  }

  private bump(i: number, delta: number): void {
    const v = Math.max(1, Math.min(9, (this.coeffs[i] ?? 1) + delta));
    this.coeffs[i] = v;
    this.coeffLabels[i]?.setText(String(v));
  }

  private highlightFocus(): void {
    this.coeffLabels.forEach((l, i) => l.setColor(i === this.focusIdx ? '#ffffff' : C_ACCENT));
  }

  private submitBalance(): void {
    this.choose({ widgetCoeffs: [...this.coeffs], fastAnswer: this.snapFast() });
  }

  private equationString(eq: BalanceEquationSpec, coeffs: number[]): string {
    const terms = [...eq.reactants, ...eq.products];
    const rCount = eq.reactants.length;
    return terms.map((t, i) => {
      const c = coeffs[i] ?? 1;
      const piece = (c === 1 ? '' : String(c)) + t.formula;
      const sep = i === rCount - 1 ? ' → ' : (i < terms.length - 1 ? ' + ' : '');
      return piece + sep;
    }).join('');
  }

  // --- optional countdown bar ----------------------------------------------

  private startTimer(): void {
    this.timerActive = true;
    this.timerBar.setVisible(true).setScale(1, 1);
    this.timerTween = this.scene.tweens.add({
      targets: this.timerBar, scaleX: 0, duration: TIMER_MS, ease: 'Linear',
      onComplete: () => { this.timerActive = false; },
    });
  }

  private stopTimer(): void {
    this.timerTween?.remove();
    this.timerTween = undefined;
    this.timerActive = false;
    this.timerBar.setVisible(false);
  }

  /** True only while an answer-timer is running and we're still in its first half. */
  private snapFast(): boolean {
    return this.timerActive && this.timerBar.scaleX > 0.5;
  }

  // --- plumbing ------------------------------------------------------------

  private choose(answer: QuizAnswer): void {
    const resolve = this.resolver;
    if (!resolve) return;
    this.resolver = null;
    this.clearKeys();
    this.clearWidgets();
    this.stopTimer();
    resolve(answer);
  }

  private onKey(event: string, fn: AnyHandler): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    kb.on(event, fn);
    this.keyHandlers.push([event, fn]);
  }

  private clearKeys(): void {
    const kb = this.scene?.input?.keyboard;
    for (const [event, fn] of this.keyHandlers) kb?.off(event, fn);
    this.keyHandlers = [];
  }

  private clearWidgets(): void {
    for (const w of this.widgets) w.destroy();
    this.widgets = [];
    this.coeffLabels = [];
  }

  private reset(): void {
    this.clearKeys();
    this.clearWidgets();
    this.stopTimer();
    this.resolver = null;
    this.coeffs = [];
    this.promptText.setText('');
    this.hintText.setText('');
    this.controlsText.setText('').setVisible(false);
  }
}
