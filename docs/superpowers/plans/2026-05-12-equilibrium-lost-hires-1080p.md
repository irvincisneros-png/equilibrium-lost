# Hi-res 1920×1080 Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the game at a true edge-to-edge 1920×1080 with smooth (non-pixel-art) graphics, by mechanically scaling every scene's existing layout up ~×4. Not a redesign — a "pragmatic now" pass (see `docs/superpowers/specs/2026-05-12-equilibrium-lost-hires-conversion-design.md`).

**Architecture:** Bump the Phaser canvas to 1920×1080 with `pixelArt: false`; every scene was authored at 480×320, so 4× the absolute pixel positions / box sizes and bump fonts via the ladder below; the placeholder-art sizes (a data table in `assetManifest.json`) get ×4 too; the overworld renders tiles at a fixed 64px. No new logic, no new tests — the 139-test suite is layout-agnostic and must stay green.

**Tech stack:** TypeScript, Phaser 3.90, Vite, Vitest.

---

## Shared conventions (used by every task below)

**Scale factor:** roughly **×4** for absolute pixel positions, box/panel dimensions, displaySizes, and offsets that were tuned for the old 480×320 canvas. (480→1920 is exactly ×4; 320→1080 is ×3.375 — when something is positioned relative to the *bottom* of the screen, base it on the new `H = 1080`, e.g. old `H - 80` becomes new `H - 320`.)

**Font ladder** (old px → new px):
| old | new | | old | new |
|----|----|--|----|----|
| 7  | 24 | | 11 | 40 |
| 8  | 28 | | 12 | 44 |
| 9  | 32 | | 13 | 48 |
| 10 | 36 | | 14 | 52 |
Anything in between: interpolate (e.g. there isn't one — these are the only sizes used).

**`strokeThickness` / `lineSpacing` / `padding`** in text styles: ×4 (rounded).

**Per-task verification:** after each task, run `npx tsc --noEmit` — expect clean. After the *last* code task, also run `npm test` (expect 139/139) and `npm run build` (expect success). Commit after each task.

---

### Task 1: `gameConfig.ts` — 1920×1080, pixelArt off

**Files:**
- Modify: `src/gameConfig.ts`

- [ ] **Step 1: Rewrite the dimension constants and config**

```ts
import type Phaser from 'phaser';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// Phaser constant values — avoids importing Phaser (with its DOM side-effects) in non-browser contexts.
const PHASER_AUTO = 0;          // Phaser.AUTO
const SCALE_FIT = 3;            // Phaser.Scale.FIT
const CENTER_BOTH = 1;          // Phaser.Scale.CENTER_BOTH

export function makeGameConfig(scenes: Phaser.Types.Scenes.SettingsConfig[]): Phaser.Types.Core.GameConfig {
  return {
    type: PHASER_AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: false,
    backgroundColor: '#0b0f17',
    scale: { mode: SCALE_FIT, autoCenter: CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: scenes as unknown as Phaser.Types.Scenes.SceneType[]
  };
}
```

(Removes `GBA_WIDTH`, `GBA_HEIGHT`, `SCALE`. Keeps `GAME_WIDTH`/`GAME_HEIGHT`.)

- [ ] **Step 2: Find dangling references**

Run: `grep -rn "GBA_WIDTH\|GBA_HEIGHT\b\|\bSCALE\b" src/`
Expected: no hits in `src/` outside `gameConfig.ts` (the scenes hard-code their own `W`/`H`). If there are hits, note the file — it'll be fixed in that file's task below.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/gameConfig.ts
git commit -m "feat(config): 1920x1080 canvas, pixelArt off (hi-res conversion)"
```

---

### Task 2: Placeholder art ×4

**Files:**
- Modify: `src/content/data/assetManifest.json`
- Modify: `src/ui/placeholderTextures.ts`

- [ ] **Step 1: ×4 every placeholder size**

In `assetManifest.json`, for every object in the `placeholders` array, multiply `w` and `h` by 4. Concretely the result is:
- `worldmap` 480×320 → 1920×1280, `title_art` 480×200 → 1920×800
- every `hero_*_overworld` 16×24 → 64×96, every `hero_*_battle` 48×48 → 192×192
- `enemy_protium`/`enemy_electrid`/`enemy_ionized_drift` 32×32 → 128×128, `enemy_shellfracture` 40×40 → 160×160, `enemy_shellfracture_half` 24×24 → 96×96, `enemy_unstable_deuteride` 48×48 → 192×192, `enemy_unstable_isotope` 64×64 → 256×256
- `npc_*` 16×24 → 64×96
- `tiles_elemental_reaches` 16×16 → 64×64
- `bg_battle_elemental_reaches` 480×224 → 1920×896
- `ui_textbox`/`ui_chainmeter` 16×16 → 64×64
- every `icon_status_*` 12×12 → 48×48

Leave `color`, `label`, `shape` and the `images`/`tilemaps`/`audio` maps untouched.

- [ ] **Step 2: Bump the placeholder-label font**

In `src/ui/placeholderTextures.ts`, `addPlaceholderLabel`: change `fontSize: '7px'` → `fontSize: '24px'`.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expect clean. Run: `npm test` — `tests/scenes/bootAssets.test.ts` and `tests/content/realContent.test.ts` should still pass (they assert key presence, not sizes).
```bash
git add src/content/data/assetManifest.json src/ui/placeholderTextures.ts
git commit -m "feat(assets): scale placeholder art + label font ×4 for hi-res"
```

---

### Task 3: `HealthBar` + `EnergyBar` internal constants ×4

**Files:**
- Modify: `src/ui/HealthBar.ts`, `src/ui/EnergyBar.ts`

- [ ] **Step 1: ×4 the module constants in both files**

In each file, change: `BAR_H = 8 → 32`, `LABEL_W = 32 → 128`, `BAR_PADDING = 4 → 16`. In the text style, `fontSize: '8px' → '28px'`. In `setValue`, the tween `duration: 200` may stay. (HealthBar accidentally creates the label `Text` twice — leave that quirk; just bump both font sizes.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/ui/HealthBar.ts src/ui/EnergyBar.ts
git commit -m "feat(ui): scale HealthBar/EnergyBar ×4 for hi-res"
```

---

### Task 4: `ChainMeter` + `Textbox` internal constants ×4

**Files:**
- Modify: `src/ui/ChainMeter.ts`, `src/ui/Textbox.ts`

- [ ] **Step 1: `ChainMeter`** — `SEG_W = 12 → 48`, `SEG_H = 8 → 32`, `GAP = 2 → 8`; label `fontSize: '9px' → '32px'`; the `+ 6` x-offset on the label → `+ 24`.

- [ ] **Step 2: `Textbox`** — defaults `charsPerLine ?? 36` and `linesPerPage ?? 3` stay (callers pass explicit values, which their own scenes' tasks will scale); `speedMs ?? 40` stays. Text style `fontSize: '12px' → '44px'`; `wordWrap.width: this.opts.w - 16 → this.opts.w - 64`; the content text offset `(8, 8) → (32, 32)`; the caret offset `(opts.w - 16, opts.h - 16) → (opts.w - 64, opts.h - 64)`; caret `fontSize: '10px' → '36px'`; border `setStrokeStyle(1, …) → setStrokeStyle(4, …)`.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/ui/ChainMeter.ts src/ui/Textbox.ts
git commit -m "feat(ui): scale ChainMeter/Textbox ×4 for hi-res"
```

---

### Task 5: `QuizPanel` internal constants ×4

**Files:**
- Modify: `src/ui/QuizPanel.ts`

- [ ] **Step 1: ×4 the layout**

`TIMER_MS`/`CORRECTION_MS` stay. In the constructor: prompt text `(8, 8) → (32, 32)`, `wordWrap.width w - 16 → w - 64`, `fontSize '10px' → '36px'`; hint text `(8, h - 8) → (32, h - 32)`, `wordWrap.width w - 16 → w - 64`, `fontSize '8px' → '28px'`; timer bar `(0, h - 2, w, 2) → (0, h - 8, w, 8)`; bg `setStrokeStyle(1, …) → setStrokeStyle(4, …)`.
In `buildMcq`: `startY = 24 → 96`, row stride `i * 14 → i * 56`, x `12 → 48`, `wordWrap.width w - 24 → w - 96`, `fontSize '9px' → '32px'`.
In `buildBalance`: `midY = 38 → 152`, initial `x = 12 → 48`, the `±14` y-offsets for ▲/▼ → `±56`, the `+4`/`+16`/`+6` x-offsets → `+16`/`+64`/`+24`, ▲/▼ `fontSize '8px' → '28px'`, coeff `fontSize '11px' → '40px'`, formula/sep `fontSize '10px' → '36px'`, Submit `(w - 12, midY) → (w - 48, midY)`, Submit `fontSize '9px' → '32px'`.
In `showCorrection`: box `(8, 28) → (32, 112)`, `wordWrap.width w - 16 → w - 64`, `fontSize '9px' → '32px'`, `lineSpacing 2 → 8`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/ui/QuizPanel.ts
git commit -m "feat(ui): scale QuizPanel ×4 for hi-res"
```

---

### Task 6: `TitleScene` ×4

**Files:**
- Modify: `src/scenes/TitleScene.ts`

- [ ] **Step 1:** Change `const W = 480 → 1920`, `const H = 320 → 1080`. Walk every `this.add.text(...)` / `this.add.rectangle(...)` / `this.add.image(...)`: keep `W/2`-style centring as-is; ×4 every absolute x/y, every panel/box width/height, every `padding`/`offset`; apply the font ladder to every `fontSize`. Apply the same to any tween offsets. (The "corrupt save" notice, the New Game / Continue / Settings buttons, the settings sub-panel — all get the ×4 + ladder treatment.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/TitleScene.ts
git commit -m "feat(scenes): TitleScene ×4 hi-res layout"
```

---

### Task 7: `ClassSelectScene` ×4

**Files:**
- Modify: `src/scenes/ClassSelectScene.ts`

- [ ] **Step 1:** `W = 480 → 1920`, `H = 320 → 1080`. The three class panels: `panelW = 136 → 544`, `panelH = 230 → 920`, `panelY = 55 → 220`, the `+ 10` inter-panel gap → `+ 40`, `startX` recompute follows the new numbers automatically. Every per-panel text offset (`+ 10`, `+ 26`, `+ 56`, `+ 110`, `+ 126`, `panelH - 24`, etc.) ×4; `wordWrap.width` values ×4; `lineSpacing` ×4. All `fontSize` via the ladder (`7→24, 8→28, 11→40, 13→48`). Bottom instruction text `H - 10 → H - 40`. `setStrokeStyle(1, …) → setStrokeStyle(4, …)`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/ClassSelectScene.ts
git commit -m "feat(scenes): ClassSelectScene ×4 hi-res layout"
```

---

### Task 8: `WorldMapScene` ×4

**Files:**
- Modify: `src/scenes/WorldMapScene.ts`

- [ ] **Step 1:** `W = 480 → 1920`, `H = 320 → 1080`. The worldmap image `setDisplaySize(W, H)` stays (it's the full canvas now). Title text `(W/2, 8) → (W/2, 32)`, `fontSize '10px' → '36px'`. Node layout: `nodeW = 140 → 560`, `nodeH = 26 → 104`, `colLeft = 60 → 240`, `colRight = W - 60 - nodeW`, `startY = 30 → 120`, `stepY` recompute follows. Node label `(+ 6, nodeH/2) → (+ 24, nodeH/2)`, `fontSize '8px' → '28px'`; the ✓ / ▶ markers `(nodeW - 6, …) → (nodeW - 24, …)`, `fontSize '9px' → '32px'`; connector `lineStyle(1, …) → lineStyle(4, …)`. Completion banner `(W/2, H - 36) → (W/2, H - 144)`, `(W - 20, 24) → (W - 80, 96)`, `setStrokeStyle(1, …) → setStrokeStyle(4, …)`, `fontSize '8px' → '28px'`. Menu button `(W - 8, 8) → (W - 32, 32)`, `fontSize '9px' → '32px'`. Toast `(W/2, H/2 - 20) → (W/2, H/2 - 80)`, `fontSize '9px' → '32px'`, `padding {x:8,y:4} → {x:32,y:16}`. `setStrokeStyle(1, …)` on the node rects → `setStrokeStyle(4, …)`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/WorldMapScene.ts
git commit -m "feat(scenes): WorldMapScene ×4 hi-res layout"
```

---

### Task 9: `ErrorScene` ×4

**Files:**
- Modify: `src/scenes/ErrorScene.ts`

- [ ] **Step 1:** Wherever it positions its message/heading text — ×4 the absolute positions, apply the font ladder, ×4 any `wordWrap.width`/`padding`/`lineSpacing`. (Small file; ~5 numbers.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/ErrorScene.ts
git commit -m "feat(scenes): ErrorScene ×4 hi-res layout"
```

---

### Task 10: `DialogueScene` ×4

**Files:**
- Modify: `src/scenes/DialogueScene.ts`

- [ ] **Step 1:** The overlay `this.add.rectangle(0, 0, width, height, …)` uses `this.scale` — fine. `textboxY = height - 80 → height - 320`. Speaker tag `(8, textboxY - 16) → (32, textboxY - 64)`, `fontSize '9px' → '32px'`, `padding {x:4,y:2} → {x:16,y:8}`. Textbox config `{ x: 0, y: textboxY, w: width, h: 76, charsPerLine: 52, linesPerPage: 3, speedMs: 30 }` → `h: 304`, `charsPerLine: 52` (keep — Textbox now renders at 44px font in a `width`-wide box, 52 chars still fits a 1920-wide box; if it overflows in the manual check, drop to ~64), `speedMs: 30` (keep). Choice list: `startY = height - 100 - labels.length * 18 → height - 400 - labels.length * 72`, choice text x `16 → 64`, row stride `i * 18 → i * 72`, prefix `'▷ '` stays, `fontSize '10px' → '36px'`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/DialogueScene.ts
git commit -m "feat(scenes): DialogueScene ×4 hi-res layout"
```

---

### Task 11: `MenuScene` ×4

**Files:**
- Modify: `src/scenes/MenuScene.ts`

- [ ] **Step 1:** `W = 480 → 1920`, `H = 1080` (it already uses `H` only in a couple of spots — was `320`; set `H = 1080` if a constant exists, else use `1080` where `320` appeared). Overlay rect stays full-canvas. Title `(W/2, 8) → (W/2, 32)`, `fontSize '11px' → '40px'`. Hint/toast lines at `H - 26`/`H - 14` → `H - 104`/`H - 56`, `fontSize '7px'/'8px' → '24px'/'28px'`. Tab headers: `startX = 24 → 96`, `gap = (W - 48)/TABS.length` follows, `y = 24 → 96`, `fontSize '9px' → '32px'`. Content rows (`addObj`/`addRow`): the `40` left margin → `160`, the `y` bases (`40`, `42`, `54`, `56`, `70`) ×4, the `rowH = 12 → 48` stride, `fontSize '8px' → '28px'`, `lineSpacing 3 → 12`. Status-tab text block: `(40, 42) → (160, 168)`, `fontSize '8px' → '28px'`, `lineSpacing 3 → 12`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/MenuScene.ts
git commit -m "feat(scenes): MenuScene ×4 hi-res layout"
```

---

### Task 12: `ChallengeShrineScene` ×4

**Files:**
- Modify: `src/scenes/ChallengeShrineScene.ts`

- [ ] **Step 1:** `W = 480 → 1920`, `H = 320 → 1080`. Title `(W/2, 14) → (W/2, 56)`, `fontSize '12px' → '44px'`; sub-line `(W/2, 28) → (W/2, 112)`, `fontSize '8px' → '28px'`; progress text `(W/2, 222) → (W/2, 888)`, `fontSize '9px' → '32px'`. QuizPanel `(20, 40, W - 40, 170) → (80, 160, W - 160, 680)`. Banner `(W/2, 110) → (W/2, 440)`, `fontSize '10px' → '36px'`, `padding {x:8,y:4} → {x:32,y:16}`, `wordWrap.width W - 40 → W - 160`.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/ChallengeShrineScene.ts
git commit -m "feat(scenes): ChallengeShrineScene ×4 hi-res layout"
```

---

### Task 13: `BattleScene` ×4

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: Constants** — `W = 480 → 1920`, `H = 320 → 1080`, `ENEMY_X = 360 → 1440`, `ENEMY_GROUND_Y = 150 → 600`, `PLAYER_X = 110 → 440`, `PLAYER_GROUND_Y = 222 → 888`.

- [ ] **Step 2: `create()` layout** — bg image `this.add.image(W/2, 118, …).setDisplaySize(W, 236)` → `this.add.image(W/2, 472, bgKey).setDisplaySize(W, 944)`; the bottom panel rect `this.add.rectangle(0, 236, W, H - 236, …)` → `this.add.rectangle(0, 944, W, H - 944, …).setStrokeStyle(4, …)`. Enemy name `(8, 8) → (32, 32)`, `fontSize '9px' → '32px'`; enemy HP bar `new HealthBar(this, 8, 22, 180, 'HP') → (this, 32, 88, 720, 'HP')`. Player name `(8, 244) → (32, 976)`, `fontSize '9px' → '32px'`; player HP bar `(this, 8, 258, 180, 'HP') → (this, 32, 1032, 720, 'HP')`; player energy bar `(this, 8, 270, 180, 'EN') → (this, 32, 1080−... )` — hmm, 270 ×4 = 1080 which is the edge; instead lay the bottom panel out as: name at `y=920`, HP bar at `y=952`, EN bar at `y=1000`, ChainMeter at `y=1040`, log line at `y=1064` — i.e. compress to fit `[944, 1080]`. So: player name `(32, 920)`, HP bar `(this, 32, 952, 720, 'HP')`, EN bar `(this, 32, 1000, 720, 'EN')`, `ChainMeter(this, 32, 1040)`, study-mode text `(32, 1032)` `fontSize '7px' → '24px'` (move to `(900, 920)` so it doesn't collide), log line `(32, 1064)` `fontSize '8px' → '28px'` `wordWrap.width W - 200 → W - 800`. Action menu `(W - 110, 246 + i*16) → (W - 440, 920 + i*48)`, `fontSize '10px' → '36px'`. Burst button `(W/2, 230) → (W/2, 880)`, `fontSize '11px' → '40px'`, `padding {x:6,y:3} → {x:24,y:12}`. Status icons: enemy `(8, 33) → (140, 32)` (move right of the enemy name so it doesn't overlap the HP bar; actually keep `(32, 130)` below the enemy HP bar), player `(8, 281) → (760, 920)` (right side of the bottom panel). Icon `setDisplaySize(10, 10) → setDisplaySize(40, 40)`, the `+11` x-step → `+44`, the `+8` gap → `+32`, number `fontSize '7px' → '24px'`. QuizPanel `new QuizPanel(this, 20, 34, W - 40, 176) → (this, 80, 136, W - 160, 700)`. HUD/banner: `showBanner` text `(W/2, 96) → (W/2, 384)`, `fontSize '12px' → '44px'`, `padding {x:8,y:4} → {x:32,y:16}`, `wordWrap.width W - 40 → W - 160`. `floatText` default `'13px' → '48px'`, the crit tag `'7px' → '24px'`, the y-rise `-26 → -104`; `floatText` callers passing `'8px'` → `'28px'`. The skill/item submenu rectangles & rows in `openSkillMenu`/`openItemMenu`: `x = 150 → 600`, `y = 240 → 952`, `rowH = 12 → 48`, the `- 4` bg offset → `- 16`, `fontSize '8px' → '28px'`, the `+ 6` text inset → `+ 24`. The miniboss confirm modal in `OverworldScene` is separate (Task 14).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene ×4 hi-res layout"
```

---

### Task 14: `OverworldScene` — `RENDER_TILE = 64` + ×4 UI

**Files:**
- Modify: `src/scenes/OverworldScene.ts`

- [ ] **Step 1: Tiles & camera** — add `const RENDER_TILE = 64;` near the top. In `create()`, replace `const ts = this.map.tileSize;` with `const ts = RENDER_TILE;` (everything downstream — the ground `Graphics` fillRect grid, NPC/marker positions, `Player`/`Npc` constructors, `worldW`/`worldH`, `cameras.main.setBounds`, `physics.world.setBounds` — already derives from `ts`, so this one line cascades). The data grid (`this.map.width/height`, the `ground[y][x]` ids) is unchanged — only the on-screen tile size grows.

- [ ] **Step 2: UI ×4** — HUD bar text `(4, 4) → (16, 16)`, `fontSize '8px' → '28px'`, `padding {x:3,y:2} → {x:12,y:8}`. Markers: rect `ts - 2 → ts - 8`, `setStrokeStyle(1, …) → setStrokeStyle(4, …)`; marker glyph `fontSize '10px' → '36px'`. Confirm modal: dim rect stays full-canvas; panel `Math.min(width - 40, 320) → Math.min(width - 160, 1280)`, panel height `70 → 280`, `setStrokeStyle(1, …) → setStrokeStyle(4, …)`; message text y `height/2 - 14 → height/2 - 56`, `fontSize '9px' → '32px'`, `wordWrap.width panel.width - 16 → panel.width - 64`; hint text y `height/2 + 16 → height/2 + 64`, `fontSize '8px' → '28px'`. Toast `(width/2, height/2 - 24) → (width/2, height/2 - 96)`, `fontSize '9px' → '32px'`, `padding {x:8,y:4} → {x:32,y:16}`.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expect clean.
```bash
git add src/scenes/OverworldScene.ts
git commit -m "feat(scenes): OverworldScene hi-res — 64px tiles + ×4 UI"
```

---

### Task 15: Full verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1:** `npx tsc --noEmit` — expect clean.
- [ ] **Step 2:** `npm test` — expect 139/139 passing.
- [ ] **Step 3:** `npm run build` — expect success; `dist/index.html` still references `/equilibrium-lost/assets/…`.
- [ ] **Step 4:** `npm run dev` — open the previewed URL. Check: TitleScene fills 1920×1080 with crisp text; New Game → ClassSelect panels are large and legible; WorldMap nodes are big; entering Region 1 shows a large tilemap with the camera following the (now 64px-tile) player; a battle shows the bg/sprites/bars/menu/ChainMeter/log all legibly placed; a quiz panel is readable; the shrine and the Esc menu are legible. Note any element that's clipped or overlapping → fix it in that scene's file and re-commit.
- [ ] **Step 5: Tag the conversion**

```bash
git tag -a v0.2.0-hires -m "1920x1080 hi-res conversion (pragmatic pass)"
git push origin main --tags   # if the GitHub remote is set up; otherwise skip and push later
```

---

## Self-review notes

- **Spec coverage:** gameConfig (Task 1), placeholder art (Task 2), UI components (Tasks 3–5), all 8 scenes including ErrorScene (Tasks 6–14), verification + the "drop GBA constants" cleanup (Tasks 1, 15). The "HD UI redesign later" backlog note is already in the spec doc. ✓
- **Known judgement calls left to the implementer's eye (resolved in Task 15's manual pass):** the BattleScene bottom panel is only 136px tall after ×4 of the old 84px region (944→1080) — Task 13 Step 2 compresses the name/HP/EN/ChainMeter/log into it; if it's cramped, raise the bg/panel split (e.g. bg `setDisplaySize(W, 820)`, panel from `y=820`). The Dialogue `charsPerLine: 52` at 44px font in a 1920-wide box should fit (~52×26px ≈ 1352px < 1856 inner) but bump it down if it wraps oddly.
- **No new tests:** layout-only; the 139-test suite is screen-dimension-agnostic and is the regression guard.
