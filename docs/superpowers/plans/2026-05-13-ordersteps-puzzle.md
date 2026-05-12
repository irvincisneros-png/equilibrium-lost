# `orderSteps` Drag-and-Drop Puzzle — Spec + Implementation Plan

> **Handoff note:** This doc is both the design and the step-by-step plan. It was written by Claude (Opus 4.7) for "Equilibrium Lost", a Year-10 Chemistry RPG (Phaser 3 + TypeScript + Vite + Vitest). It's intended to be executed end-to-end by another agent (Codex) **on this branch (`feat/ordersteps-puzzle`)** without further design input. **Do NOT merge to `main` without the repo owner's review.** The three gates `npx tsc --noEmit`, `npm test`, `npm run build` must be green before every commit and at the end. The design was reviewed with the repo owner; the JSON shape (option below) was their explicit choice.

## Goal

Add a third question `format` — `orderSteps` — a drag-and-drop "put these steps in the right order" puzzle. It slots into the existing quiz pipeline exactly like the current `mcq` and `balanceEquation` formats: stored as ordinary items in `src/content/data/questions/<topic>.json`, picked by `QuizEngine`, rendered by `QuizPanel`, used in both `BattleScene` and `ChallengeShrineScene`. No scene changes, no new assets (the widget is drawn with Phaser rectangles + text like the rest of `QuizPanel`). Ship ~4 starter `orderSteps` puzzles per topic (~28 total) plus tests.

## Background — how the quiz pipeline works (read these files first)

- `src/content/types.ts` — `QuestionDef` (the `format` discriminated union, `options`/`answerIndex` for mcq, `equation` for balanceEquation), `BalanceEquationSpec`.
- `src/content/schema.ts` — `validateQuestion(raw)`: a malformed question is a **warning (skip)**, never a hard error; the game keeps running. Add the new format the same way.
- `src/systems/QuizEngine.ts` — `pickQuestion` (no change needed) and `checkAnswer(q, answer)` (add a branch).
- `src/ui/QuizPanel.ts` — `QuizAnswer` interface; `ask(question, opts)` branches on `question.format` to call `buildMcq` / `buildBalance`; `showCorrection(question, correct)` renders the right answer + explanation; `choose(answer)` resolves the `ask` promise; `onKey` / `clearKeys` / `clearWidgets` / `reset` lifecycle; `snapFast()` for the optional answer-timer bonus; `startTimer`/`stopTimer`. Study every method.
- `src/scenes/BattleScene.ts` (~line 319) and `src/scenes/ChallengeShrineScene.ts` (~line 66): `const ans = await this.quizPanel.ask(q, {...}); const correct = engine.checkAnswer(q, ans); await this.quizPanel.showCorrection(q, correct);` — they pass the whole `ans` object through, so a new optional field on `QuizAnswer` rides along automatically. **No scene changes.**
- `tests/systems/quizEngine.test.ts`, `tests/content/realContent.test.ts`, `tests/content/contentLoader.test.ts` — existing test patterns.
- `scripts/check-question-bank.mjs` — dev tool that validates a bank against the quality bar; `node scripts/check-question-bank.mjs --all`. It currently understands `mcq` and `balanceEquation`; you'll add minimal `orderSteps` awareness (count it, accept it; don't fail on it).

## Data shape (the repo owner picked the minimal form)

An `orderSteps` question:

```jsonc
{
  "id": "ec-300",
  "topic": "energy-changes",
  "difficulty": 2,                 // 1 | 2 | 3 — mostly 2 or 3 for these
  "format": "orderSteps",
  "prompt": "Put the energy story of an exothermic reaction in the right order:",
  "steps": [                        // ← the steps IN THE CORRECT ORDER; 3 to 6 of them
    "Bonds in the reactants break, absorbing energy",
    "New bonds form in the products, releasing more energy",
    "The surplus energy is released to the surroundings",
    "The temperature of the surroundings rises"
  ],
  "explanation": "Breaking the old bonds takes energy in; making the new bonds gives more out; the surplus heats the surroundings.",
  "hint": "What has to happen to the old bonds before any new ones can form?"
}
```

Rules: `steps` is an array of **3–6 non-empty strings**, stored in the correct order. The widget shuffles them for display; the player drags them back; the answer is "correct" iff the player's order matches the stored order. There are no decoy steps — the set is fixed, the challenge is the order. `prompt`/`steps`/`explanation`/`hint` may use Unicode subscripts (`H₂O`), `→`, etc. like the other formats. `explanation`/`hint` must not reference positions ("the third step…") — the display order is shuffled — phrase them by content.

---

## Task 1 — types, schema, QuizEngine, QuizAnswer (+ unit tests). TDD-friendly; do this first.

**Files:** `src/content/types.ts`, `src/content/schema.ts`, `src/systems/QuizEngine.ts`, `src/ui/QuizPanel.ts` (the `QuizAnswer` interface only — not the widget yet), `tests/systems/quizEngine.test.ts`, and a `validateQuestion` test (extend `tests/content/contentLoader.test.ts` or `tests/content/realContent.test.ts` — wherever `validateQuestion` is currently exercised; if it isn't, add a small `tests/content/schema.test.ts`).

- [ ] **Step 1 — extend `QuestionDef` in `src/content/types.ts`:**

```ts
export interface QuestionDef {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  format: 'mcq' | 'balanceEquation' | 'orderSteps';
  prompt: string;
  options?: string[];          // mcq: length 4
  answerIndex?: number;        // mcq: 0..3
  equation?: BalanceEquationSpec; // balanceEquation: coeff fields are the correct answer
  steps?: string[];            // orderSteps: 3..6 items, stored in the correct order
  explanation: string;
  hint?: string;
}
```

- [ ] **Step 2 — `validateQuestion` branch in `src/content/schema.ts`:** in the `if (raw['format'] === 'mcq') {...} else if (raw['format'] === 'balanceEquation') {...}` chain, add before the final `else` (the "unknown format" warning):

```ts
} else if (raw['format'] === 'orderSteps') {
  const steps = raw['steps'];
  if (!isArr(steps) || steps.length < 3 || steps.length > 6 || !steps.every(isStr)) {
    r.warnings.push(`question ${id}: orderSteps needs a 'steps' array of 3-6 non-empty strings — skipped`);
  }
}
```

(Use the existing `isArr`/`isStr` helpers. Same warn-and-skip philosophy as the other formats.)

- [ ] **Step 3 — `QuizAnswer` in `src/ui/QuizPanel.ts`:** add a field:

```ts
export interface QuizAnswer {
  index?: number;          // mcq selection 0..3
  widgetCoeffs?: number[]; // balanceEquation: one per term, [...reactants, ...products]
  widgetOrder?: number[];  // orderSteps: the player's order, as indices into the question's `steps` array
  fastAnswer: boolean;
}
```

- [ ] **Step 4 — `QuizEngine.checkAnswer` in `src/systems/QuizEngine.ts`:** widen the param type and add a branch:

```ts
checkAnswer(q: QuestionDef, answer: { index?: number; widgetCoeffs?: number[]; widgetOrder?: number[] }): boolean {
  if (q.format === 'mcq') return typeof answer.index === 'number' && answer.index === q.answerIndex;
  if (q.format === 'balanceEquation' && q.equation) {
    const expected = [...q.equation.reactants, ...q.equation.products].map(t => t.coeff);
    const got = answer.widgetCoeffs;
    return Array.isArray(got) && got.length === expected.length && expected.every((c, i) => got[i] === c);
  }
  if (q.format === 'orderSteps' && q.steps) {
    const got = answer.widgetOrder;
    // `steps` is stored in the correct order, so the correct answer is the identity permutation [0,1,2,...]
    return Array.isArray(got) && got.length === q.steps.length && got.every((v, i) => v === i);
  }
  return false;
}
```

- [ ] **Step 5 — write failing tests, then confirm they pass:**
  - `tests/systems/quizEngine.test.ts`: a `QuestionDef` with `format: 'orderSteps'`, `steps: ['a','b','c']` — `checkAnswer(q, { widgetOrder: [0,1,2] })` ⇒ `true`; `{ widgetOrder: [1,0,2] }` ⇒ `false`; `{ widgetOrder: [0,1] }` ⇒ `false`; `{ index: 0 }` ⇒ `false` (no `widgetOrder`).
  - `validateQuestion` test: a valid orderSteps item (3+ string steps) ⇒ `warnings` empty; one with 2 steps or a non-string step ⇒ a warning containing "orderSteps".
- [ ] **Step 6 — gates:** `npx tsc --noEmit && npm test && npm run build`. Commit: `feat(quiz): add orderSteps question format (types, schema, grading)`.

---

## Task 2 — `src/ui/OrderStepsWidget.ts` (the drag-and-drop widget)

**File:** create `src/ui/OrderStepsWidget.ts`. This is the only non-trivial piece. It's a `Phaser.GameObjects.Container` that `QuizPanel` will instantiate and add as a child. It draws N "step cards" stacked vertically in N fixed slots; the player drags a card and the others shift to make room; a `Submit` button (or `Enter`) calls back with the final order. Keyboard fallback: `↑/↓` move a focus highlight; `Shift+↑/Shift+↓` move the focused card up/down; `Enter` submits. No assets — rectangles + text, matching `QuizPanel`'s palette/font (`monospace`, bg `0x0d1b2a`, border `0x415a77`, text `#cdd6f4`, accent `#f9e2af`, ok `#a6e3a1`, dim `#8fa3c0`).

Design:

```ts
import Phaser from 'phaser';

const FONT = 'monospace';
const CARD_H = 56;        // height of one step card
const CARD_GAP = 12;      // vertical gap between cards
const SLOT_PITCH = CARD_H + CARD_GAP;

export interface OrderStepsWidgetOpts {
  /** called once when the player submits, with their order as indices into the original `steps` array */
  onSubmit: (order: number[]) => void;
  /** register a scene keyboard listener that the host (QuizPanel) will clean up via its own clearKeys() */
  registerKey: (event: string, fn: (e: KeyboardEvent) => void) => void;
}

/**
 * A "drag the steps into the right order" widget. Built once via the constructor; the host destroys it
 * (Phaser Container.destroy() tears down all child GameObjects) and separately cleans up the keyboard
 * listeners it registered through `registerKey`.
 *
 * Internal state: `order: number[]` — the original-step indices, in current top-to-bottom display order.
 * Slot i is the y-position `slotY(i)`; card for `order[i]` sits there (unless being dragged).
 */
export class OrderStepsWidget extends Phaser.GameObjects.Container {
  private readonly steps: string[];
  private readonly width: number;
  private readonly onSubmit: (order: number[]) => void;
  private order: number[];                 // display order -> original index
  private cards: Phaser.GameObjects.Container[] = []; // index by ORIGINAL step index
  private focus = 0;                        // which display slot the keyboard focus is on
  private dragging = -1;                    // display slot currently being dragged, or -1

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, steps: string[], opts: OrderStepsWidgetOpts) {
    super(scene, x, y);
    this.steps = steps;
    this.width = width;
    this.onSubmit = opts.onSubmit;
    this.order = OrderStepsWidget.shuffledIdentity(steps.length, () => Math.random());
    this.buildCards();
    this.layoutCards(true);
    this.buildSubmitButton();
    this.highlightFocus();
    this.attachKeys(opts.registerKey);
    scene.add.existing(this);
  }

  /** A random permutation of 0..n-1 that is NOT the identity (so the puzzle is never pre-solved). */
  static shuffledIdentity(n: number, rng: () => number): number[] {
    if (n <= 1) return [0];
    let a: number[];
    do {
      a = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    } while (a.every((v, i) => v === i));
    return a;
  }

  private slotY(slot: number): number { return slot * SLOT_PITCH; }

  private buildCards(): void {
    this.cards = this.steps.map((text, origIdx) => {
      const card = this.scene.add.container(0, 0);
      const bg = this.scene.add.rectangle(0, 0, this.width - 80, CARD_H, 0x1b2a3a, 1).setOrigin(0, 0).setStrokeStyle(2, 0x415a77);
      const grip = this.scene.add.text(14, CARD_H / 2, '≡', { fontFamily: FONT, fontSize: '26px', color: '#8fa3c0' }).setOrigin(0.5);
      const label = this.scene.add.text(44, CARD_H / 2, text, { fontFamily: FONT, fontSize: '24px', color: '#cdd6f4', wordWrap: { width: this.width - 140 } }).setOrigin(0, 0.5);
      card.add([bg, grip, label]);
      // make the whole card draggable
      bg.setInteractive({ useHandCursor: true, draggable: true });
      bg.on('dragstart', () => this.onDragStart(origIdx));
      bg.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.onDrag(origIdx, dy));
      bg.on('dragend', () => this.onDragEnd(origIdx));
      this.add(card);
      return card;
    });
    // (Note: 'drag' gives absolute drag x/y of the gameobject if you use the 3-arg signature on the
    //  *interactive object*; simplest is to track the card's slot and reposition on each 'drag' event
    //  using pointer.y relative to this container. Use whichever Phaser drag API is cleanest — see
    //  the existing balance-widget for the project's interaction style. The key behaviours are below.)
  }

  // --- drag behaviour ---------------------------------------------------------------------------
  // dragStart(orig): remember which display slot this card is in (`this.dragging = slotOf(orig)`),
  //   bring its container to top (this.bringToTop(card)), tint it slightly.
  // drag(orig, dy or pointerY): move the card's container.y to follow the pointer, clamped to
  //   [slotY(0) - CARD_H/2, slotY(n-1) + CARD_H/2]. Compute which slot the card's CENTRE is over:
  //   targetSlot = clamp(round((cardCentreY) / SLOT_PITCH), 0, n-1). If targetSlot !== this.dragging,
  //   splice the dragged card's orig index out of `this.order` and insert it at `targetSlot`, set
  //   this.dragging = targetSlot, and re-layout all the *other* cards to their slot positions
  //   (tween or instant — instant is fine) WITHOUT moving the dragged one.
  // dragEnd(orig): snap the dragged card's container.y to slotY(this.dragging), clear tint,
  //   this.dragging = -1, re-layout everything.

  private slotOf(origIdx: number): number { return this.order.indexOf(origIdx); }

  private onDragStart(origIdx: number): void { this.dragging = this.slotOf(origIdx); this.bringToTop(this.cards[origIdx]!); /* tint */ }
  private onDrag(origIdx: number, pointerYInContainer: number): void { /* see comment block above */ }
  private onDragEnd(origIdx: number): void { /* see comment block above */ this.dragging = -1; this.layoutCards(true); }

  /** Position every card at its slot's y (skip the one being dragged if `includeDragged` is false). */
  private layoutCards(includeDragged: boolean): void {
    this.order.forEach((origIdx, slot) => {
      if (!includeDragged && slot === this.dragging) return;
      this.cards[origIdx]!.setPosition(40, this.slotY(slot));
    });
    this.redrawSlotNumbers();
  }

  private redrawSlotNumbers(): void { /* draw "1." "2." ... at x≈10, y=slotY(i)+CARD_H/2 — fixed labels, one per slot */ }

  // --- submit + keyboard ------------------------------------------------------------------------
  private buildSubmitButton(): void {
    const y = this.slotY(this.steps.length) + 8;
    const btn = this.scene.add.text((this.width - 80) / 2, y, '[ Submit ⏎ ]', { fontFamily: FONT, fontSize: '28px', color: '#a6e3a1' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#a6e3a1'));
    btn.on('pointerdown', () => this.submit());
    this.add(btn);
  }

  private attachKeys(register: (event: string, fn: (e: KeyboardEvent) => void) => void): void {
    register('keydown-UP', (e) => { if (e.shiftKey) this.moveFocused(-1); else { this.focus = Math.max(0, this.focus - 1); this.highlightFocus(); } });
    register('keydown-DOWN', (e) => { if (e.shiftKey) this.moveFocused(+1); else { this.focus = Math.min(this.steps.length - 1, this.focus + 1); this.highlightFocus(); } });
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
    // give the card at display slot `this.focus` a brighter border / accent; reset the others.
    this.order.forEach((origIdx, slot) => { /* set the bg rect strokeStyle: focused -> 3px 0xf9e2af, else 2px 0x415a77 */ });
  }

  private submit(): void { this.onSubmit([...this.order]); }
}
```

- [ ] **Step 1:** create the file with a working implementation (fill in the `onDrag`/`onDragEnd` bodies, the slot-number drawing, the highlight). Keep it self-contained; no new external deps. Use the project's Phaser drag idiom (look at how nothing else in the repo uses `draggable` yet — `QuizPanel.buildBalance` uses `setInteractive({ useHandCursor: true })` + `pointerdown`; for drag you'll use `setInteractive({ draggable: true })` and the scene's `'drag'` events; make sure the scene has dragging enabled — `setInteractive({ draggable: true })` on the gameobject is sufficient in Phaser 3).
- [ ] **Step 2 — keep `npx tsc --noEmit` green** as you go (strict mode; the repo uses `!` non-null assertions liberally — match that style; no `any`).
- [ ] **Step 3 — commit:** `feat(ui): OrderStepsWidget — drag-to-reorder step puzzle widget`. (No unit test for the widget itself — consistent with the repo, which doesn't unit-test `QuizPanel`'s rendering; the gradeable logic is in `QuizEngine`/`validateQuestion`, already tested in Task 1. Do `npm run build` to confirm it bundles.)

---

## Task 3 — wire `orderSteps` into `QuizPanel`

**File:** `src/ui/QuizPanel.ts`.

- [ ] **Step 1 — `ask()`:** in the `if (question.format === 'balanceEquation' ...) {...} else {...}` block, add an `else if` for orderSteps BEFORE the mcq fallback:

```ts
if (question.format === 'balanceEquation' && question.equation) {
  this.buildBalance(question.equation);
  this.controlsText.setText('▲▼ buttons (or ←/→ pick a term, ↑/↓ change it) · Enter to submit').setVisible(true);
} else if (question.format === 'orderSteps' && question.steps && question.steps.length >= 2) {
  this.buildOrderSteps(question.steps);
  this.controlsText.setText('Drag a step to reorder — or ↑/↓ to pick a step, Shift+↑/↓ to move it · Enter to submit').setVisible(true);
} else {
  this.buildMcq(question.options ?? ['(error)', '(error)', '(error)', '(error)']);
  this.controlsText.setText('Click an answer — or press A · B · C · D  (or 1 · 2 · 3 · 4)').setVisible(true);
}
```

- [ ] **Step 2 — add `buildOrderSteps`:**

```ts
private buildOrderSteps(steps: string[]): void {
  const w = new OrderStepsWidget(this.scene, 40, this.contentTop(), this.panelW - 80, steps, {
    onSubmit: (order) => this.choose({ widgetOrder: order, fastAnswer: this.snapFast() }),
    registerKey: (event, fn) => this.onKey(event, fn as AnyHandler),
  });
  this.add(w);
  this.widgets.push(w); // clearWidgets() will .destroy() it; clearKeys() handles the keys it registered
}
```

(Import `OrderStepsWidget` at the top. `this.contentTop()` already exists — it's the Y just below the rendered prompt. `AnyHandler` is the existing `(...args: unknown[]) => void` type; the cast is fine since Phaser passes the `KeyboardEvent` as the first arg.)

- [ ] **Step 3 — `showCorrection()`:** add an `else if` branch to the `answerStr` computation:

```ts
} else if (question.format === 'orderSteps' && question.steps) {
  answerStr = '\n' + question.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
}
```

and ensure the heading reads sensibly — for orderSteps the wrong-answer heading should be `✗ The correct order was:` (currently it's `✗ The answer was ${answerStr}`; either special-case the heading text for orderSteps, or just let `answerStr` start with a newline so it renders as `✗ The answer was:` then the list — pick whichever reads better; a tiny `const heading = correct ? '✓ Correct!' : (question.format === 'orderSteps' ? '✗ The correct order was:' : \`✗ The answer was ${answerStr}\`);` is cleanest, with `answerStr` not appended for orderSteps but printed on the next lines).

- [ ] **Step 4 — `reset()` / lifecycle:** confirm nothing new is needed — the widget is in `this.widgets`, so `clearWidgets()` destroys it; its keys went through `this.onKey`, so `clearKeys()` removes them. `reset()`, `choose()`, and `showCorrection()` all already call `clearKeys()` + `clearWidgets()` + `stopTimer()` together, so no change. (Double-check by reading those three methods.)

- [ ] **Step 5 — gates + manual smoke:** `npx tsc --noEmit && npm test && npm run build`. Then `npm run dev`, start a battle, and verify: an `orderSteps` question (you'll have content after Task 4 — or temporarily hard-code one to test) renders, drags, the keyboard fallback works, Submit grades correctly, `showCorrection` shows the numbered list, and the panel cleans up for the next question. Commit: `feat(ui): render orderSteps questions in QuizPanel`.

---

## Task 4 — author ~28 `orderSteps` puzzles + tests + check-script awareness

**Files:** the 7 `src/content/data/questions/<topic>.json` files; `scripts/check-question-bank.mjs`; `tests/content/realContent.test.ts`.

- [ ] **Step 1 — add `orderSteps` awareness to `scripts/check-question-bank.mjs`:** in the per-item loop, add an `else if (q.format === 'orderSteps')` branch that checks `Array.isArray(q.steps) && q.steps.length >= 3 && q.steps.length <= 6 && q.steps.every(s => typeof s === 'string' && s.length)`; push to `fmt` like the others; don't break the existing mcq/balanceEquation checks. The answerIndex-spread and balanceEquation-balance checks already filter by format, so they're unaffected.

- [ ] **Step 2 — author ~4 `orderSteps` items per bank** (continue the prefix numbering — e.g. atomic-structure currently ends at `as-297`, so `as-298`…`as-301`; check the actual max id in each file first). All `difficulty` 2 or 3. Every item gets a `hint` (a nudge, never the order itself) and a one-line `explanation` (the reasoning; never reference step positions since the display is shuffled). NSW Stage-5 reading level, Australian spelling. Each `steps` array must be 3–6 items, written in the **correct** order. Suggested puzzles (use these or equivalents):
  - **atomic-structure** (`as-`): (a) order electron sub-shells/shells by filling order — "shell 1 (up to 2 e⁻)" → "shell 2 (up to 8)" → "shell 3 (up to 8)" → "shell 4"; (b) sequence the atomic model history — "Dalton: tiny solid spheres" → "Thomson: plum-pudding (electrons in a positive blob)" → "Rutherford: tiny dense positive nucleus" → "Bohr: electrons in fixed shells"; (c) order C, Na, Cl, K by atomic number (smallest first); (d) the steps of working out an ion's charge from its group / electron change.
  - **bonding** (`b-`): (a) how an ionic bond forms — "the metal atom loses its outer electron(s)" → "it becomes a positive ion (cation)" → "the non-metal atom gains those electron(s), becoming a negative ion (anion)" → "the oppositely charged ions attract and pack into a giant lattice"; (b) order substance types by typical melting point — "simple molecular" → "metallic" → "ionic" → "giant covalent"; (c) steps of writing an ionic formula — "find each ion's charge" → "swap the charges to use as subscripts" → "simplify the ratio to lowest whole numbers" → "add brackets if a polyatomic ion is multiplied".
  - **reaction-types** (`rt-`): (a) order metals most→least reactive — "potassium" → "magnesium" → "zinc" → "iron" → "copper"; (b) steps of a precipitation test — "mix the two clear solutions" → "an insoluble solid (precipitate) forms" → "the mixture turns cloudy" → "filter to collect the precipitate"; (c) classify a reaction — "write the word equation" → "identify what's reacting (e.g. a fuel + oxygen)" → "name the type (combustion)".
  - **balancing-equations** (`be-`): (a) the steps of balancing — "write the unbalanced equation with correct formulae" → "count the atoms of each element on both sides" → "add coefficients in front of formulae (never change subscripts)" → "re-count to check both sides match" → "simplify the coefficients to lowest whole numbers"; (b) steps of going from a description to a balanced equation; (c) order the work: "balance the metal" → "balance the non-metal" → "balance oxygen" → "balance hydrogen last".
  - **reaction-rates** (`rr-`): (a) a "measure the rate" experiment — "set up the apparatus (e.g. flask + gas syringe)" → "add the reactants and start the timer" → "record the gas volume at regular time intervals" → "plot volume against time" → "find the rate from the steepest part of the graph"; (b) events on a rate–time graph — "the reaction is fastest at the start" → "the rate slows as reactants are used up" → "the graph levels off when a reactant runs out" → "the reaction has finished"; (c) steps of a fair test for the effect of concentration.
  - **acids-bases** (`ab-`): (a) order by pH (lowest first) — "lemon juice" → "vinegar" → "pure water" → "baking-soda solution" → "household ammonia" → "oven cleaner"; (b) steps of a neutralisation titration — "measure a known volume of acid into a flask and add indicator" → "add base slowly from the burette, swirling" → "stop at the colour change (the end point)" → "record the volume of base used"; (c) steps of making a soluble salt from an acid + insoluble base; (d) what happens as you add base to acid — "pH starts below 7 (acidic)" → "pH rises toward 7 as the acid is neutralised" → "pH = 7 when exactly enough base is added" → "pH goes above 7 if you add excess base".
  - **energy-changes** (`ec-`): (a) the exothermic energy story (the worked example at the top of this doc); (b) points on a reaction profile, low→high→low for exothermic — "reactants energy level" → "activation-energy peak (bonds breaking)" → "products energy level (lower than reactants)"; (c) steps of comparing two fuels by calorimetry — "measure out the same volume of water in a metal can" → "record the starting water temperature" → "burn a measured mass of the fuel under the can" → "record the highest water temperature" → "the fuel that raised the temperature most released the most energy per gram"; (d) the bond-energy account — "energy is put in to break the bonds in the reactants" → "energy is released when the bonds in the products form" → "compare the two: more out than in → exothermic; more in than out → endothermic".

- [ ] **Step 3 — tests in `tests/content/realContent.test.ts`** ("expanded question banks" describe block): add an `it` — "every orderSteps question has 3–6 non-empty string steps" (loop all banks, filter `format === 'orderSteps'`, assert `Array.isArray(q.steps) && q.steps.length >= 3 && q.steps.length <= 6 && q.steps.every(s => typeof s === 'string' && s.trim().length > 0)`); and an `it` — "every bank has at least one orderSteps question". The existing assertions (count ≥250, ≥30 per difficulty, hint+explanation on every item) automatically cover the new items; the mcq-answerIndex-spread and balanceEquation-balance ones filter by format and stay green. Also: `tests/content/realContent.test.ts`'s top assertion `expect(warnings).toEqual([])` from `loadGameContent()` will catch any malformed orderSteps item — so make sure they all validate.

- [ ] **Step 4 — gates:** `node scripts/check-question-bank.mjs --all` (all OK), then `npx tsc --noEmit && npm test && npm run build`. Commit: `feat(content): ~28 orderSteps puzzles across all 7 banks + tests`.

---

## Task 5 — finish

- [ ] All three gates green; `git status` clean.
- [ ] Update the project memory note at `/Users/<owner>/.claude/projects/-Users-<owner>/memory/equilibrium-lost-project.md` if you have access (note: `orderSteps` is now a third question format; new file `src/ui/OrderStepsWidget.ts`; ~28 orderSteps puzzles across the banks; test count up). If you don't have access to that path, skip it and mention it in your handoff summary.
- [ ] **Do NOT merge to `main` automatically.** Push the branch (`git push -u origin feat/ordersteps-puzzle`) and report: commits made, final test count, what was verified manually (the drag widget behaviour — note if anything felt janky), and anything left for the repo owner to review/playtest. The owner will review and merge/tag (`v0.10.0-ordersteps` is the likely tag, but leave tagging to them).

## Out of scope (do not build)

- The other drag-and-drop puzzle types (`sortBuckets` drop-zones, `assembleFormula` ion tiles, `matchPairs` lines) — separate future milestones.
- Any combat/region/skill/enemy changes; Region 8; the Skill Progression milestone.
- Refactoring `QuizPanel`'s existing mcq/balance widgets (leave them inline as they are).
