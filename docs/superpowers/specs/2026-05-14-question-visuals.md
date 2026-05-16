# Question Visuals — Spec (v0.16.0-question-visuals)

**Date:** 2026-05-14
**Status:** Approved — execute and deploy.
**Author:** Claude (main session)

## Goal

Add **optional, procedural diagrams** to quiz questions so Year-10 students can *see* the chemistry, not just read it. No new image assets — every diagram is drawn with Phaser Graphics from a small structured payload on the question itself.

## Why

The existing question banks are text-only. Concepts like Bohr atoms, valence dots, pH scales, reaction-energy profiles, and atom-count balance are dramatically clearer with a picture. The goal isn't to add a visual to every question — it's to **selectively** add visuals to the questions where pictorial reasoning helps most.

## Scope

**In scope:**
- New optional `visual?` field on `QuestionDef`
- 5 visual renderers (v1): `bohrAtom`, `lewisDot`, `pHScale`, `reactionEnergyProfile`, `balanceScale`
- Schema validation + tests
- A `VisualRenderer` Phaser module
- Integration into `QuizPanel` so any question with a `visual` field renders the diagram above/beside the prompt
- ~30–50 hand-picked questions across the 7 relevant banks get visuals added

**Out of scope:**
- 3D molecular models
- Interactive diagrams (drag-an-electron, etc.) — visuals are display-only
- Auto-generating visuals from question text via heuristics
- Modifying the existing question text or answers (visuals augment, don't replace)
- Visuals on `balanceEquation` or `orderSteps` widget questions (those already have their own widgets; visuals are for `mcq` only in v1)

## Architecture

### 1. Schema additions (`src/content/types.ts`)

```ts
export type QuestionVisual =
  | { type: 'bohrAtom'; symbol: string; protons: number; neutrons?: number; shells: number[] }
  | { type: 'lewisDot'; symbol: string; valenceElectrons: number }
  | { type: 'pHScale'; value: number; label?: string }
  | { type: 'reactionEnergyProfile'; deltaH: number; activationEnergy: number; label?: string }
  | { type: 'balanceScale'; left: Array<{ symbol: string; count: number }>; right: Array<{ symbol: string; count: number }> };

export interface QuestionDef {
  // ...existing fields...
  visual?: QuestionVisual;
}
```

**Constraints:**
- `bohrAtom.shells`: array of electron counts per shell, max length 4, each ≤ shell capacity (2/8/18/32). Sum ≤ 36 for sanity.
- `lewisDot.valenceElectrons`: 0–8.
- `pHScale.value`: 0–14 (clamped if out of range during render).
- `reactionEnergyProfile.deltaH`: any number (positive = endothermic, negative = exothermic). `activationEnergy`: ≥ 0.
- `balanceScale.left/right`: 1–6 entries each, `count` 1–9.

### 2. Validation (`src/content/schema.ts`)

Add `validateQuestionVisual(v: unknown): asserts v is QuestionVisual` and call it from `validateQuestion` when `visual` is present. Reject unknown `type`, out-of-range numerics, missing required fields. Throw with a clear path like `question[atom-007].visual.shells[2] out of range`.

### 3. Renderer (`src/ui/VisualRenderer.ts`)

```ts
export interface VisualBounds { x: number; y: number; width: number; height: number; }

export function renderQuestionVisual(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: QuestionVisual,
  bounds: VisualBounds
): void;
```

One pure function. Switches on `visual.type`. Each renderer draws into a fresh `scene.add.graphics()` parented to `container`, positioned within `bounds`. No state, no caching — easy to teardown by destroying the container.

**Renderer specs:**

- **`bohrAtom`** — central circle (nucleus) labelled `${symbol}` with `${protons}p ${neutrons ?? 0}n` below. Concentric circles for shells (radius scales with shell index). Electron dots placed evenly around each shell (small filled circles). Colours: nucleus gold/red, shells thin white strokes, electrons cyan.

- **`lewisDot`** — element symbol centred in a `Math.min(bounds.w, bounds.h) * 0.4` box; valence electrons rendered as dots placed in canonical Lewis positions (N, E, S, W first, then doubling up). Pairs side-by-side.

- **`pHScale`** — horizontal bar bounds.width wide, 32px tall. Gradient from red (left, pH 0) through yellow/green (pH 7) to blue/purple (pH 14). Vertical marker (triangle + line) at the value's position. Numeric labels 0, 7, 14 below. Optional `label` text below marker.

- **`reactionEnergyProfile`** — XY axes (Energy vertical, Reaction progress horizontal). Curve: flat reactant line → smooth arc up to peak (transition state) → flat product line. Peak height = activation energy; product line = reactant line + deltaH. Label "Ea" with a vertical arrow at peak. Label "ΔH" with a vertical arrow between reactant and product baselines. Use `Graphics.lineTo` with multiple points for the arc.

- **`balanceScale`** — two pans connected by a beam. Each pan shows reagent symbols with counts (e.g., `2 H₂` rendered as text). If left.atomCount === right.atomCount the beam is level; otherwise it tilts toward the heavier side. (Tilt is a hint, not a literal physics sim — just a visual cue.)

All renderers must:
- Stay within their `bounds` (clip text size, scale shells if too cramped)
- Use the project's existing UI font (check `BattleScene` / `QuizPanel` for the font key)
- Render at consistent scale even when bounds are small (graceful degradation)

### 4. QuizPanel integration (`src/ui/QuizPanel.ts`)

Read the file first. When `question.visual` is defined, allocate a visual panel above (or beside) the question prompt. Suggested layout:

- Visual panel: rectangular region ~360×220 anchored at the top of the question card, centred horizontally. Question prompt + options shift down to accommodate.
- If `question.visual` is undefined, layout is unchanged (back-compat).

Wrap the visual in a faint bordered window (matching the FF-menu chrome style from `MenuScene` — thin gold border, dark inner fill) for visual cohesion.

### 5. Content additions

**Add ~5–8 visuals per relevant bank.** Pick existing questions where a visual genuinely helps; don't invent new questions in this pass. Banks and example targets:

- **atomic-structure** (8 visuals): `bohrAtom` for ~6 valency/electron-config questions; `lewisDot` for ~2 valence-electron questions.
- **bonding** (8 visuals): `lewisDot` for ionic/covalent valence questions (~5); `bohrAtom` for ion-formation questions (~3).
- **reaction-types** (4 visuals): `balanceScale` for ~2 synthesis/decomposition questions; `reactionEnergyProfile` for ~2 exo/endo questions.
- **balancing-equations** (5 visuals): `balanceScale` for ~5 mass-conservation questions.
- **reaction-rates** (4 visuals): `reactionEnergyProfile` for ~4 activation-energy/catalyst questions.
- **acids-bases** (8 visuals): `pHScale` for ~8 pH-value questions.
- **energy-changes** (6 visuals): `reactionEnergyProfile` for ~6 exo/endo/Ea questions.
- **equilibrium** (0): skip in v1 — equilibrium visuals (Le Châtelier shifts) need a 6th visual type; defer to v2.

**Total: ~43 questions get visuals.** This is enough to feel impactful without bloating the bank files.

**Heuristic for picking:** read each bank, find difficulty-1 and difficulty-2 questions where the answer hinges on counting electrons / matching atom counts / reading pH / reading an energy diagram. Skip d3 questions (they're abstract reasoning, less helped by pictures).

### 6. Save schema

**No save changes.** `visual` is content-only, no runtime state. `SaveData` version stays at v4.

## Testing

### Unit tests

- **`tests/ui/visualRenderer.test.ts`** (new) — for each visual type, build a sample payload, render into a headless scene-stub container, assert renderer doesn't throw and adds the expected number of game objects (e.g., bohrAtom for `[2,8,1]` adds 1 nucleus + 3 shell circles + 11 electron dots = 15 objects). Use a minimal Phaser scene mock.
- **`tests/content/schema.test.ts`** — add cases for each `validateQuestionVisual` branch: valid passes, each invalid (bad type, out-of-range shell count, lewisDot.valenceElectrons > 8, etc.) throws.
- **`tests/content/realContent.test.ts`** — add a check that every question's `visual` (if present) validates without throwing.

### Smoke

After implementation, `npm run build` must succeed; the dev page should render a question with a visual without console errors.

## Implementation order

1. Types (`QuestionVisual` discriminated union)
2. Schema validator + tests
3. VisualRenderer module + unit tests
4. QuizPanel integration (wire visual panel in)
5. Add visuals to bank files (43 questions across 7 banks)
6. RealContent test update
7. Manual smoke via `npm run dev` would be ideal but not blocking; visual regressions can ride to the next playtest
8. Commit batches:
   - `feat(types): QuestionVisual discriminated union`
   - `feat(schema): validateQuestionVisual + tests`
   - `feat(ui): VisualRenderer with 5 diagram types`
   - `feat(ui): QuizPanel renders question.visual above prompt`
   - `feat(content): add ~43 visuals across 7 question banks`
   - `test(content): verify all question visuals validate`
9. Tag `v0.16.0-question-visuals` and push.

## Acceptance criteria

- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ (test count up by ~15–25 from new visual/schema tests)
- `npm run build` ✅
- At least one question in each of the 7 relevant banks has a `visual` field that validates
- Visiting a question with a visual at runtime shows a rendered diagram (no console errors)
- Questions without a `visual` field render exactly as before (zero regression for the 1,950+ visual-less questions)

## Out of scope (deferred to future passes)

- Equilibrium-specific visuals (Le Châtelier shift diagrams) — needs a 6th visual type, defer
- Interactive diagrams (player tweaks pH, watches dots move, etc.)
- Auto-generating visuals via NLP heuristics on question text
- Visuals on `balanceEquation` / `orderSteps` widget questions
- Animated visuals (electrons orbiting, etc.) — v1 is static
- Visual variants for darkmode/colourblind — v1 uses fixed palettes
