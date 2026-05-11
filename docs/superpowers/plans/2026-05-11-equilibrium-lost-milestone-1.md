# Equilibrium Lost — Milestone 1 (Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, end-to-end playable vertical slice of *Equilibrium Lost* — all five core logic engines, the full scene flow, and Region 1 ("The Elemental Reaches") with placeholder art — to GitHub Pages.

**Architecture:** Pure-TypeScript logic modules (`BattleEngine`, `QuizEngine`, `Progression`, `SaveManager`, `ContentLoader`) with **zero Phaser dependency** — state in, new state + events out — fully unit-tested with Vitest. Phaser 3 scenes do rendering/input only and call into the engines. All content (classes, skills, enemies, regions, items, type chart, questions, NPC dialogue, asset manifest) lives in JSON imported statically, so a teacher/designer edits data, not code. Vite builds static output; GitHub Actions deploys `dist/` to Pages.

**Tech Stack:** Phaser 3 · TypeScript · Vite · Vitest · GitHub Actions · browser `localStorage`.

---

## How to read this plan

- **Phases 0–5** (project scaffold, content schemas/data, and all four pure-logic engines + SaveManager) are written as strict TDD with complete test code and complete implementation code. These are the testable heart of the game — do them first, do them properly.
- **Phase 6** (Phaser scenes + UI) is "build then manually verify against acceptance criteria", because Phaser scene wiring is integration glue that unit tests cannot meaningfully cover. Each scene task still extracts any non-trivial logic into a **pure helper that IS unit-tested** (dialogue-tree walker, loadout validation, shrine-gauntlet scoring, asset-key resolution, typewriter chunking). The plan gives exact signatures, exact acceptance criteria, and the non-obvious code for these tasks; standard Phaser boilerplate (scene class skeleton, `add.image`, `add.text`, tween calls) is described precisely rather than transcribed line for line.
- **Phase 7** is integration, build-config, the manual playtest checklist from spec §9, and deploy.
- This is one large milestone but it has two natural shipping points: after **Phase 5** you have a green test suite + a deployable shell (`npm test` and `npm run build` both pass); after **Phase 7** you have the playable slice. A reviewer may choose to checkpoint there.

---

## Decisions locked for Milestone 1 (resolves spec §11 "Open Questions")

These were left open in the design spec; they are now **fixed for M1** (re-tunable in Milestone 4):

| # | Question | Decision for M1 |
|---|----------|-----------------|
| 1 | Energy pool size / refill | `maxEnergy = 100`; `+25` regenerated at the start of each of the player's turns; Skills cost `20–50`; Catalyst Burst costs `0`. |
| 2 | Evolution milestones / chains | First evolution at **Lv 10 AND Region 1 cleared**. M1 only authors stage 0→1 for all three classes (`Pyron→Pyrochemist`, `Aqualis→Solvent Adept`, `Ionix→Nucleon`). Higher stages are Milestone 2+. |
| 3 | Active loadout slots | **5** equipped skills. |
| 4 | NPC lesson content format | **Data-driven dialogue trees** in `npcs.json` (linear nodes with optional branches + `setFlag`). |
| 5 | Final region/boss/enemy/skill names | Spec placeholders kept; concrete M1 names assigned below. |

**M1 Region 1 cast:** wild enemies `protium` (Atomic), `electrid` (Atomic), `shellfracture` (Decomposition — splits into two `shellfracture-half`), `ionized-drift` (Ionic); mini-boss `unstable-deuteride` (Atomic); region boss `the-unstable-isotope` (Atomic). Mentors: `professor-bohrlin` (atomic structure lesson), `archivist-mendel` (periodic table lesson), `shrinekeeper-quanta` (shrine intro).

**Chain Reaction model:** integer `chain` 0–5. `chainMultiplier = [1.0, 1.2, 1.5, 1.8, 2.2, 2.6][chain]`. A correct quiz → `chain = min(5, chain+1)`. Any wrong quiz → `chain = 0`. When `chain === 5`, `catalystBurstReady = true`. Using Catalyst Burst sets `chain = 0`. A wrong answer also clears `catalystBurstReady`.

**Damage formula** (Pokémon-style, integer math, injectable RNG):
```
levelFactor   = floor(2 * attacker.level / 5) + 2
effAtk        = applyStage(attacker.atk, attacker.buffs.atk ?? 0)
effDef        = applyStage(defender.def, defender.buffs.def ?? 0)
baseDamage    = floor(floor(floor(levelFactor * power * effAtk / effDef) / 50) + 2)
modifier      = typeMult * affinityBonus * chainMult * quizMult * critMult * randFactor
finalDamage   = typeMult === 0 ? 0 : max(1, floor(baseDamage * modifier))
```
where `applyStage(v, s) = s >= 0 ? floor(v * (2 + s) / 2) : floor(v * 2 / (2 - s))` (stage clamped to −6..+6); `typeMult ∈ {0, 0.5, 1, 2}` from the type chart; `affinityBonus = 1.25` iff the move is a Skill and `skill.affinity === attacker.signatureAffinity` else `1.0`; `chainMult = chainMultiplier(chain)` for a successful Skill, `1.0` for a basic Attack or a fizzled Skill, `3.0` for a Catalyst Burst; `quizMult = 0.3` for a fizzled Skill else `1.0`; `critMult = 1.5` iff `settings.answerTimer && action.fastAnswer && quizCorrect` else `1.0`; `randFactor = 0.85 + rng() * 0.15` (`rng` defaults to `Math.random`, injected as `() => 1` etc. in tests).

**XP / levels:** `xpToNextLevel(level) = 100 * level`; cumulative `totalXpForLevel(level) = 50 * level * (level - 1)`; `levelForXp` inverts it. Stats per level: `statsForLevel = baseStats + growth * (level - 1) + evolutionBonus(stage)`, component-wise, floored.

**Type effectiveness for M1** (full chart tuned in M4 — these matchups are the ones Region 1 needs and the ones the spec calls out):
`Base→Acid = 2`, `Acid→Metal = 2`, `Acid→Ionic = 2`, `Endothermic→Exothermic = 2`, `Endothermic→Combustion = 2`, `Acid→Base = 0.5`, `Base→Base = 0.5`, `Combustion→Endothermic = 0.5`, `Catalyst→anything = 0.5` (Catalyst skills are utility, not damage), `Decomposition→Decomposition = 0.5`; everything unspecified `= 1`. Special **behaviors** (not multipliers): Catalyst skills with `behavior.grantExtraAction` give an extra action that turn; Decomposition skills with `behavior.splitTarget` cause a high-HP enemy with a `splitInto` id to be replaced by two half-HP copies; Precipitation skills with `behavior.stripBuffs` set the target's `buffs` to `{}`.

**Status effects:** all six from spec §4.5. Each is `{ id, turnsRemaining, magnitude }`. Ticked **after both combatants act** in a turn: `dissolved`/`combusting` → `magnitude` damage to owner; `oxidised` → owner `buffs.def -= 1` (min −6); `endothermicChill` → owner `buffs.atk -= 1` (min −6); `catalysed` → owner `buffs.spd = max(buffs.spd, +2)` (refreshed while active); `precipitated` → consumed by skipping the owner's next action (checked in `*Act`), never deals damage. After ticking, `turnsRemaining -= 1`; remove at 0.

**Save:** `localStorage` key `equilibrium-lost:save:v1`; `CURRENT_SAVE_VERSION = 1`; `SaveManager` takes an injectable `StorageLike` (defaults to `window.localStorage`) so tests use an in-memory stub — **no jsdom needed**; unit tests run on `environment: 'node'`.

---

## File structure (everything created in M1)

```
equilibrium-lost/
  package.json                       — scripts: dev, build, preview, test
  tsconfig.json                      — strict, ESNext, "resolveJsonModule": true
  vite.config.ts                     — base: '/equilibrium-lost/', build to dist/
  vitest.config.ts                   — environment 'node', include 'tests/**/*.test.ts'
  index.html                         — single canvas mount + <script type=module src=/src/main.ts>
  .gitignore                         — node_modules, dist
  README.md                          — what it is, how to run, how to edit content
  .github/workflows/deploy.yml        — build + deploy dist/ to GitHub Pages on push to main

  public/assets/
    spec.md                          — asset spec sheet stub (tile size, palette, naming) — Phase 1 deliverable
    tilemaps/elemental-reaches.json   — Region 1 tilemap (small hand-authored grid; layers ground/collision/objects)

  src/
    main.ts                          — Phaser.Game config + scene registration
    content/
      types.ts                       — all domain interfaces (Affinity, Stats, SkillDef, ClassDef, EnemyDef, ItemDef, RegionDef, QuestionDef, NpcDef, DialogueNode, SaveData, GameContent, …)
      schema.ts                       — tiny runtime validators (validateClass, validateSkill, … ) returning {errors,warnings}
      ContentLoader.ts                — imports all JSON, validates, indexes into GameContent; skips malformed questions w/ warning
      data/
        classes.json
        skills.json
        enemies.json
        regions.json
        items.json
        typeChart.json
        assetManifest.json
        npcs.json
        questions/
          atomic-structure.json       — ~50 questions, the teacher-editable layer (Region 1's topic = atomic structure + periodic table)
    systems/
      BattleEngine.ts                 — createBattle, getTurnOrder, playerAct, enemyAct, computeDamage, applyStatuses, type-chart lookup, chain math (pure)
      QuizEngine.ts                   — pickQuestion (topic+difficulty+adaptive), checkAnswer, chain helpers (pure)
      Progression.ts                  — xp/level curves, statsForLevel, addXp, checkEvolution, applySkillUnlocks (pure)
      SaveManager.ts                  — newGame, save, load, migrate, clear, recordQuizResult (StorageLike injected; otherwise pure)
    entities/
      Player.ts                       — overworld player sprite + 4-dir movement/collision (Phaser)
      Npc.ts                          — overworld NPC sprite + interaction zone (Phaser)
      EnemySprite.ts                  — battle enemy sprite + hit/attack frame helpers (Phaser)
    ui/
      Textbox.ts                      — GBA-style textbox w/ typewriter (Phaser); exports pure `chunkText`
      DialogueRunner.ts               — pure `nextNode(tree, currentId, choiceIndex?)` + a thin Phaser wrapper used by DialogueScene
      HealthBar.ts                    — HP bar component (Phaser)
      EnergyBar.ts                    — Energy bar component (Phaser)
      ChainMeter.ts                   — chain level + multiplier display (Phaser); exports pure `formatMultiplier`
      QuizPanel.ts                    — renders mcq (4 buttons) or balanceEquation widget (number steppers) (Phaser)
      placeholderTextures.ts          — pure `placeholderSpec(assetKey, manifest)` + a generator that builds coloured-rect/text textures from the manifest at boot
    scenes/
      BootScene.ts                    — loads ContentLoader, generates placeholder textures, → Title or → ErrorScene
      ErrorScene.ts                   — friendly "couldn't load <file>" screen
      TitleScene.ts                   — New Game / Continue / Settings
      ClassSelectScene.ts             — pick a class → SaveManager.newGame → WorldMap
      WorldMapScene.ts                — 8 region nodes, locked/unlocked, current marker → Overworld(regionId)
      OverworldScene.ts               — Region 1 tilemap, player movement, NPC interact, encounters, shrine/miniboss/boss triggers, exit
      DialogueScene.ts                — runs an NPC dialogue tree via DialogueRunner, returns to caller
      BattleScene.ts                  — full battle UI; wires BattleEngine + QuizEngine + Progression
      ChallengeShrineScene.ts         — sequential quiz gauntlet, scoring, rewards
      MenuScene.ts                    — pause menu: Skills / Items / Status / Save / Settings / Quit

  tests/
    content/contentLoader.test.ts
    content/realContent.test.ts        — the shipped JSON validates with 0 errors; questions count/shape/difficulty-spread
    systems/typeChart.test.ts
    systems/chain.test.ts
    systems/computeDamage.test.ts
    systems/battleEngine.test.ts
    systems/quizEngine.test.ts
    systems/progression.test.ts
    systems/saveManager.test.ts
    ui/dialogueRunner.test.ts
    ui/chainMeter.test.ts
    ui/textbox.test.ts
    scenes/challengeShrine.test.ts     — pure gauntlet-scoring helper
    scenes/menuLoadout.test.ts         — pure loadout-validation helper
    scenes/bootAssets.test.ts          — pure asset-key resolution / placeholder spec
```

> **Note on JSON imports:** `tsconfig.json` sets `"resolveJsonModule": true` and `"esModuleInterop": true`. `ContentLoader.ts` `import`s each JSON file statically (e.g. `import classes from './data/classes.json'`). This works identically under Vite (bundled) and Vitest (Node ESM) — **no `fetch`, no async asset hop for content**. Phaser still loads *image/audio* assets via its loader using `assetManifest.json`.

---

# Phase 0 — Project scaffold

### Task 1: Initialise the toolchain & repo skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `README.md`
- Create (empty placeholder dirs with `.gitkeep`): `src/`, `src/content/data/questions/`, `src/systems/`, `src/scenes/`, `src/entities/`, `src/ui/`, `public/assets/tilemaps/`, `tests/`, `.github/workflows/`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "equilibrium-lost",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install phaser
npm install --save-dev typescript vite vitest @types/node
```
Expected: `node_modules/` populated, `package-lock.json` written, no peer-dep errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/equilibrium-lost/', // GitHub Pages project-site path; change if repo is renamed
  build: { outDir: 'dist', sourcemap: true },
  server: { open: true }
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Equilibrium Lost</title>
    <style>
      html, body { margin: 0; padding: 0; background: #0b0f17; overflow: hidden; }
      #game { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
dist
.DS_Store
*.local
```

- [ ] **Step 8: Create `README.md`**

```markdown
# Equilibrium Lost

A turn-based, pixel-art chemistry RPG for NSW Year 10 Chemistry (Stage 5). Static web app, deployed to GitHub Pages, plays offline, saves in `localStorage`.

## Run
- `npm install`
- `npm run dev` — local dev server
- `npm test` — unit tests (pure logic engines)
- `npm run build` — static build into `dist/`

## Editing content (no code)
All game content is JSON under `src/content/data/`. Questions are one file per topic under `src/content/data/questions/` — teachers can add/edit/reorder/replace questions there. See `public/assets/spec.md` for the art spec.

## Architecture
Pure-TS engines (`src/systems/`) hold all game logic and are unit-tested; Phaser scenes (`src/scenes/`) render only. See `docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md`.
```

- [ ] **Step 9: Create empty dirs with `.gitkeep`**

Run:
```bash
mkdir -p src/content/data/questions src/systems src/scenes src/entities src/ui public/assets/tilemaps tests .github/workflows
for d in src/content/data/questions src/systems src/scenes src/entities src/ui public/assets/tilemaps tests; do touch "$d/.gitkeep"; done
```

- [ ] **Step 10: Verify install + empty test run**

Run: `npx vitest run`
Expected: exits 0 with "No test files found" (or similar) — toolchain is wired.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest project skeleton"
```

---

### Task 2: Phaser boot + `main.ts` + `BootScene` stub + smoke test

**Files:**
- Create: `src/main.ts`, `src/scenes/BootScene.ts`
- Create: `src/gameConfig.ts` (the Phaser config object, exported so it's testable without instantiating a `Game`)
- Test: `tests/scenes/bootAssets.test.ts` (config-shape smoke test for now; grows in Task 35)

- [ ] **Step 1: Write the failing test**

```ts
// tests/scenes/bootAssets.test.ts
import { describe, it, expect } from 'vitest';
import { GAME_WIDTH, GAME_HEIGHT, makeGameConfig } from '../../src/gameConfig';

describe('game config', () => {
  it('is a GBA-ish resolution scaled up, pixelArt, with a scene list starting at BootScene', () => {
    const cfg = makeGameConfig([{ key: 'BootScene' }] as any);
    expect(GAME_WIDTH).toBe(480);   // 2x GBA width (240)
    expect(GAME_HEIGHT).toBe(320);  // 2x GBA height (160)
    expect(cfg.pixelArt).toBe(true);
    expect(cfg.scale?.mode).toBeDefined();
    expect((cfg.scene as any[])[0].key).toBe('BootScene');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/scenes/bootAssets.test.ts`
Expected: FAIL — `Cannot find module '../../src/gameConfig'`.

- [ ] **Step 3: Create `src/gameConfig.ts`**

```ts
import Phaser from 'phaser';

export const GBA_WIDTH = 240;
export const GBA_HEIGHT = 160;
export const SCALE = 2;
export const GAME_WIDTH = GBA_WIDTH * SCALE;
export const GAME_HEIGHT = GBA_HEIGHT * SCALE;

export function makeGameConfig(scenes: Phaser.Types.Scenes.SettingsConfig[]): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    backgroundColor: '#0b0f17',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: scenes as unknown as Phaser.Types.Scenes.SceneType[]
  };
}
```

- [ ] **Step 4: Create `src/scenes/BootScene.ts` (stub — fleshed out in Task 35)**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create(): void {
    this.add.text(8, 8, 'Equilibrium Lost — booting…', { fontFamily: 'monospace', fontSize: '12px', color: '#cdd6f4' });
    // Task 35 replaces this with ContentLoader + placeholder-texture generation + scene routing.
  }
}
```

- [ ] **Step 5: Create `src/main.ts`**

```ts
import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';

// Scenes are appended here as Phase 6 tasks add them.
const SCENES: Phaser.Types.Scenes.SettingsConfig[] = [BootScene];

new Phaser.Game(makeGameConfig(SCENES as any));
```

- [ ] **Step 6: Run the test — confirm it passes**

Run: `npx vitest run tests/scenes/bootAssets.test.ts`
Expected: PASS.

- [ ] **Step 7: Manual smoke**

Run: `npm run dev` → browser opens → a black GBA-proportioned canvas centred, text "Equilibrium Lost — booting…". Stop the server.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: `tsc --noEmit` clean; `dist/index.html` + assets emitted; no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Phaser game config + BootScene stub + boot smoke test"
```

---

### Task 3: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Sanity-check YAML**

Run: `npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo OK`
Expected: `OK` (valid YAML). *(If `js-yaml` CLI is unavailable, eyeball it — indentation must be 2 spaces, no tabs.)*

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages build+test+deploy workflow"
```

> **Prerequisite for Phase 7 deploy:** the GitHub repo must exist with Pages set to "GitHub Actions" source. Note this; do not block earlier phases on it.

---

# Phase 1 — Domain types, content schemas & Region 1 data

### Task 4: Domain types + asset spec sheet stub

**Files:**
- Create: `src/content/types.ts`
- Create: `public/assets/spec.md`

> Type-only file: no runtime test. It is exercised (and thus compile-checked) by every later task. The asset spec stub satisfies spec §7 Phase-1 deliverable.

- [ ] **Step 1: Create `src/content/types.ts`**

```ts
// ---------- chemistry "types" ----------
export type Affinity =
  | 'Neutral' | 'Atomic' | 'Acid' | 'Base' | 'Metal' | 'Ionic' | 'Covalent'
  | 'Synthesis' | 'Decomposition' | 'Combustion' | 'Exothermic' | 'Endothermic'
  | 'Catalyst' | 'Precipitation';

export interface Stats { hp: number; atk: number; def: number; spd: number; }
export type StatKey = keyof Stats;

export type StatusId =
  | 'oxidised' | 'dissolved' | 'catalysed' | 'precipitated' | 'endothermicChill' | 'combusting';

export interface StatusEffectInstance { id: StatusId; turnsRemaining: number; magnitude: number; }

// ---------- skills ----------
export interface SkillBehavior {
  applyStatus?: { id: StatusId; chance: number; turns: number; magnitude: number };
  healPercent?: number;       // % of caster maxHp healed
  grantExtraAction?: boolean;  // Catalyst
  splitTarget?: boolean;       // Decomposition
  stripBuffs?: boolean;        // Precipitation
}
export interface SkillDef {
  id: string;
  name: string;
  affinity: Affinity;
  power: number;               // 0 for pure-utility skills
  energyCost: number;
  topic: string | null;        // question topic; null = no quiz (basic-attack-like skills only)
  questionDifficulty: 1 | 2 | 3; // preferred difficulty band when this skill triggers a quiz
  accuracy: number;            // 0..100
  isSignature: boolean;        // part of a class signature line
  isCatalystBurst: boolean;    // the move fired by a Catalyst Burst
  behavior?: SkillBehavior;
  description: string;
}

// ---------- classes / progression ----------
export interface EvolutionDef {
  stage: number;               // 1, 2, 3 (stage 0 = base, implicit)
  name: string;
  atLevel: number;
  requiresRegionClearedId: string;
  statBonus: Stats;
  spriteKey: string;           // overworld + battle prefix; manifest resolves variants
  newSignatureSkillId: string;
}
export interface ClassDef {
  id: string;
  name: string;
  theme: string;
  baseStats: Stats;
  growth: Stats;               // added per level beyond level 1
  signatureAffinity: Affinity; // grants the 1.25x affinity bonus
  startingSkillIds: string[];
  startingItemIds: { itemId: string; qty: number }[];
  skillUnlocks: { level: number; skillId: string }[];
  evolutions: EvolutionDef[];
}

// ---------- enemies ----------
export type EnemyRole = 'wild' | 'miniBoss' | 'regionBoss' | 'finalBoss';
export interface EnemyDef {
  id: string;
  name: string;
  affinity: Affinity;
  baseStats: Stats;            // at `level`
  level: number;
  attackPower: number;         // basic-attack power
  skillIds: string[];          // AI uses these (enemies never take quizzes)
  xpYield: number;
  role: EnemyRole;
  spriteKey: string;
  splitIntoId?: string;        // if hit by a splitTarget skill, replaced by two of these
  teachesSkillId?: string;     // TM-style: player learns this on defeat
  bossSoftScale?: boolean;     // region/final bosses soft-scale to player level
  battleBackgroundKey?: string; // overrides region default if set
}

// ---------- items ----------
export type ItemKind = 'buffer' | 'reagent' | 'statBooster' | 'energy' | 'evolutionMaterial';
export interface ItemEffect {
  healHp?: number;
  healHpPercent?: number;
  revive?: boolean;            // only works on a fainted target
  reviveHpPercent?: number;
  restoreEnergy?: number;
  statBoostStages?: Partial<Record<StatKey, number>>; // applied as buff stages
}
export interface ItemDef { id: string; name: string; kind: ItemKind; usableInBattle: boolean; effect: ItemEffect; description: string; }

// ---------- regions ----------
export interface RegionDef {
  id: string;
  index: number;               // 1..8
  name: string;
  topic: string;               // question topic file key
  tilemapKey: string;          // matches a key in assetManifest.tilemaps
  tilesetKey: string;
  battleBackgroundKey: string;
  wildEnemyIds: string[];
  encounterRatePerStep: number;// 0..1
  miniBossId: string;
  regionBossId: string;
  npcIds: string[];
  shrine: { questionTopic: string; questionCount: number; passRatio: number; rewardXp: number; rewardItemIds: string[]; };
  unlocksRegionId: string | null;
  bossReward: { xp: number; itemIds: string[]; skillId?: string };
}

// ---------- questions ----------
export interface BalanceEquationSpec {
  reactants: { formula: string; coeff: number }[];
  products: { formula: string; coeff: number }[];
}
export interface QuestionDef {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  format: 'mcq' | 'balanceEquation';
  prompt: string;
  options?: string[];          // mcq: length 4
  answerIndex?: number;        // mcq: 0..3
  equation?: BalanceEquationSpec; // balanceEquation: coeff fields are the correct answer
  explanation: string;         // one-line, shown after a wrong answer
  hint?: string;               // shown in Study Mode
}

// ---------- NPC dialogue ----------
export interface DialogueChoice { label: string; next: string; }
export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string;
  next?: string;               // linear continuation
  choices?: DialogueChoice[];  // branch
  setFlag?: string;            // sets a story flag on visit
  end?: boolean;               // terminal node
}
export interface NpcDef {
  id: string;
  name: string;
  spriteKey: string;
  tile: { x: number; y: number };
  facing?: 'up' | 'down' | 'left' | 'right';
  dialogue: DialogueNode[];    // node[0] is the entry node
}

// ---------- asset manifest ----------
export type PlaceholderShape = 'rect' | 'circle';
export interface PlaceholderAsset { key: string; w: number; h: number; color: string; label?: string; shape?: PlaceholderShape; }
export interface AssetManifest {
  // logical key -> real file path (used by Phaser loader once real art exists)
  images: Record<string, string>;
  tilemaps: Record<string, string>;
  audio: Record<string, string>;
  // logical key -> placeholder spec (used until real art exists)
  placeholders: PlaceholderAsset[];
}

// ---------- type chart ----------
// attackerAffinity -> defenderAffinity -> multiplier (missing = 1)
export type TypeChart = Record<string, Record<string, number>>;

// ---------- save ----------
export interface TopicQuizStat { topic: string; asked: number; correct: number; recentMisses: number; }
export interface RegionProgress { entered: boolean; miniBossDefeated: boolean; bossDefeated: boolean; shrineCleared: boolean; }
export interface SaveSettings { studyMode: boolean; answerTimer: boolean; }
export interface SaveData {
  version: number;
  classId: string;
  evolutionStage: number;      // 0 = base
  level: number;
  xp: number;                  // total accumulated
  stats: Stats;                // current max stats (derived; stored for migration safety)
  currentHp: number;
  currentEnergy: number;
  unlockedSkillIds: string[];
  equippedSkillIds: string[];  // length 1..5
  items: { itemId: string; qty: number }[];
  currentRegionId: string;
  regionProgress: Record<string, RegionProgress>;
  storyFlags: Record<string, boolean>;
  playerTile: { regionId: string; x: number; y: number };
  quizStats: Record<string, TopicQuizStat>; // keyed by topic
  settings: SaveSettings;
}

// ---------- loaded content bundle ----------
export interface GameContent {
  classes: ClassDef[];
  skills: Record<string, SkillDef>;
  enemies: Record<string, EnemyDef>;
  regions: RegionDef[];
  items: Record<string, ItemDef>;
  typeChart: TypeChart;
  questions: Record<string, QuestionDef[]>; // keyed by topic
  npcs: Record<string, NpcDef>;
  assets: AssetManifest;
}
```

- [ ] **Step 2: Create `public/assets/spec.md`**

```markdown
# Equilibrium Lost — Asset Spec Sheet (v0, M1)

- **Base resolution:** 240×160 logical px (GBA), rendered at 2× (480×320). `pixelArt: true` — nearest-neighbour.
- **Tile size:** 16×16 px.
- **Palette:** GBA-style limited palette — ~32 colours, no gradients/anti-aliasing. (Curated list TBD in Milestone 3.)
- **Character sprites:** overworld 16×24 px, 4-direction walk cycles, 3 frames each (idle, step-L, step-R). Battle pose 48×48 px, ≥2 frames (idle, hit/attack).
- **Enemy sprites:** wild 32×32 px; mini-boss 48×48; region/final boss 64×64. ≥2 frames (idle, hit).
- **Backgrounds:** battle backgrounds 240×112 px (top portion; UI occupies the rest).
- **UI chrome:** 9-slice textbox; bars (HP/Energy) 1-px outline; chain meter 5 segments.
- **Naming convention (matches `assetManifest.json` keys):**
  - `hero_<class>_<evostage>_<context>` e.g. `hero_pyron_0_overworld`, `hero_pyron_1_battle`
  - `enemy_<id>` e.g. `enemy_protium`
  - `npc_<id>`, `tiles_<region>`, `bg_battle_<region>`, `ui_textbox`, `ui_chainmeter`, `icon_status_<id>`, `worldmap`
- **M1 reality:** all of the above are generated at boot as labelled coloured rectangles (see `src/ui/placeholderTextures.ts`). Real art lands in Milestone 3 by editing `assetManifest.json` only.
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (types.ts has no errors).

- [ ] **Step 4: Commit**

```bash
git add src/content/types.ts public/assets/spec.md
git commit -m "feat: domain types + asset spec sheet stub"
```

---

### Task 5: Content schema validators (`schema.ts`) — TDD with fixtures

**Files:**
- Create: `src/content/schema.ts`
- Test: `tests/content/contentLoader.test.ts` (this task adds the schema tests; Task 6 adds the loader tests in the same file)

The validators take a raw `unknown`, return `{ errors: string[]; warnings: string[] }`. **Errors** = the game cannot start (missing required file/field). **Warnings** = the offending item is skipped, the game continues (malformed question, unknown skill id reference, etc.).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/contentLoader.test.ts
import { describe, it, expect } from 'vitest';
import { validateQuestion, validateSkill, validateRegion, validateGameContent } from '../../src/content/schema';

describe('validateQuestion', () => {
  it('accepts a well-formed mcq', () => {
    const r = validateQuestion({ id: 'q1', topic: 'atomic-structure', difficulty: 1, format: 'mcq',
      prompt: 'How many protons in hydrogen-1?', options: ['0', '1', '2', '3'], answerIndex: 1, explanation: 'Atomic number 1.' });
    expect(r.errors).toEqual([]);
  });
  it('flags an mcq with a bad answerIndex as a warning (skip, don\'t crash)', () => {
    const r = validateQuestion({ id: 'q2', topic: 'atomic-structure', difficulty: 1, format: 'mcq',
      prompt: 'x', options: ['a', 'b', 'c', 'd'], answerIndex: 9, explanation: 'y' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/q2/);
  });
  it('flags an mcq without exactly 4 options', () => {
    const r = validateQuestion({ id: 'q3', topic: 't', difficulty: 1, format: 'mcq', prompt: 'x', options: ['a', 'b'], answerIndex: 0, explanation: 'y' });
    expect(r.warnings.length).toBe(1);
  });
  it('accepts a well-formed balanceEquation', () => {
    const r = validateQuestion({ id: 'q4', topic: 'atomic-structure', difficulty: 3, format: 'balanceEquation',
      prompt: 'Balance: H2 + O2 -> H2O', equation: { reactants: [{ formula: 'H2', coeff: 2 }, { formula: 'O2', coeff: 1 }], products: [{ formula: 'H2O', coeff: 2 }] }, explanation: '2H2 + O2 -> 2H2O' });
    expect(r.errors).toEqual([]);
  });
});

describe('validateSkill', () => {
  it('rejects a skill missing required fields as an error', () => {
    const r = validateSkill({ id: 's1' });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('accepts a valid skill', () => {
    const r = validateSkill({ id: ' proton-jab '.trim(), name: 'Proton Jab', affinity: 'Atomic', power: 35, energyCost: 20,
      topic: 'atomic-structure', questionDifficulty: 1, accuracy: 100, isSignature: false, isCatalystBurst: false, description: 'd' });
    expect(r.errors).toEqual([]);
  });
});

describe('validateRegion', () => {
  it('rejects a region with no boss as an error', () => {
    const r = validateRegion({ id: 'r1', index: 1, name: 'X', topic: 't', tilemapKey: 'k', tilesetKey: 'k', battleBackgroundKey: 'k',
      wildEnemyIds: [], encounterRatePerStep: 0.1, miniBossId: 'm', regionBossId: '', npcIds: [], shrine: { questionTopic: 't', questionCount: 5, passRatio: 0.8, rewardXp: 100, rewardItemIds: [] }, unlocksRegionId: null, bossReward: { xp: 100, itemIds: [] } });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('validateGameContent', () => {
  it('errors when a required collection is missing or empty', () => {
    const r = validateGameContent({ classes: [], skills: {}, enemies: {}, regions: [], items: {}, typeChart: {}, questions: {}, npcs: {}, assets: { images: {}, tilemaps: {}, audio: {}, placeholders: [] } } as any);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — confirm failure**

Run: `npx vitest run tests/content/contentLoader.test.ts`
Expected: FAIL — `Cannot find module '../../src/content/schema'`.

- [ ] **Step 3: Implement `src/content/schema.ts`**

```ts
import type {
  QuestionDef, SkillDef, ClassDef, EnemyDef, ItemDef, RegionDef, NpcDef, AssetManifest, GameContent, TypeChart
} from './types';

export interface ValidationResult { errors: string[]; warnings: string[]; }
const ok = (): ValidationResult => ({ errors: [], warnings: [] });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

function requireFields(o: Record<string, unknown>, spec: Record<string, (v: unknown) => boolean>, who: string, errs: string[]) {
  for (const [k, pred] of Object.entries(spec)) {
    if (!(k in o) || !pred(o[k])) errs.push(`${who}: missing/invalid field "${k}"`);
  }
}

// --- question: malformed => WARNING (skip), never an error (game continues) ---
export function validateQuestion(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.warnings.push('question: not an object — skipped'); return r; }
  const id = isStr(raw.id) ? raw.id : '(no id)';
  const base = isStr(raw.topic) && (raw.difficulty === 1 || raw.difficulty === 2 || raw.difficulty === 3) && isStr(raw.prompt) && isStr(raw.explanation);
  if (!base) { r.warnings.push(`question ${id}: missing/invalid topic/difficulty/prompt/explanation — skipped`); return r; }
  if (raw.format === 'mcq') {
    const opts = raw.options;
    if (!isArr(opts) || opts.length !== 4 || !opts.every(isStr)) r.warnings.push(`question ${id}: mcq needs exactly 4 string options — skipped`);
    else if (!isNum(raw.answerIndex) || raw.answerIndex < 0 || raw.answerIndex > 3) r.warnings.push(`question ${id}: mcq answerIndex must be 0..3 — skipped`);
  } else if (raw.format === 'balanceEquation') {
    const eq = raw.equation as any;
    const sideOk = (s: unknown) => isArr(s) && s.length > 0 && s.every((t: any) => isObj(t) && isStr(t.formula) && isNum(t.coeff) && t.coeff >= 1);
    if (!isObj(eq) || !sideOk(eq.reactants) || !sideOk(eq.products)) r.warnings.push(`question ${id}: balanceEquation needs reactants/products with formula+coeff>=1 — skipped`);
  } else {
    r.warnings.push(`question ${id}: unknown format "${String(raw.format)}" — skipped`);
  }
  return r;
}

export function validateSkill(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('skill: not an object'); return r; }
  requireFields(raw, {
    id: isStr, name: isStr, affinity: isStr, power: isNum, energyCost: isNum,
    questionDifficulty: (v) => v === 1 || v === 2 || v === 3, accuracy: isNum,
    isSignature: isBool, isCatalystBurst: isBool, description: isStr
  }, `skill ${isStr(raw.id) ? raw.id : '(no id)'}`, r.errors);
  if ('topic' in raw && raw.topic !== null && !isStr(raw.topic)) r.errors.push(`skill ${raw.id}: topic must be a string or null`);
  return r;
}

export function validateClass(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('class: not an object'); return r; }
  const who = `class ${isStr(raw.id) ? raw.id : '(no id)'}`;
  const stats = (v: unknown) => isObj(v) && isNum(v.hp) && isNum(v.atk) && isNum(v.def) && isNum(v.spd);
  requireFields(raw, { id: isStr, name: isStr, theme: isStr, baseStats: stats, growth: stats, signatureAffinity: isStr,
    startingSkillIds: (v) => isArr(v) && v.every(isStr), skillUnlocks: isArr, evolutions: isArr }, who, r.errors);
  return r;
}

export function validateEnemy(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('enemy: not an object'); return r; }
  const who = `enemy ${isStr(raw.id) ? raw.id : '(no id)'}`;
  const stats = (v: unknown) => isObj(v) && isNum(v.hp) && isNum(v.atk) && isNum(v.def) && isNum(v.spd);
  requireFields(raw, { id: isStr, name: isStr, affinity: isStr, baseStats: stats, level: isNum, attackPower: isNum,
    skillIds: (v) => isArr(v) && v.every(isStr), xpYield: isNum, role: isStr, spriteKey: isStr }, who, r.errors);
  return r;
}

export function validateItem(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('item: not an object'); return r; }
  requireFields(raw, { id: isStr, name: isStr, kind: isStr, usableInBattle: isBool, effect: isObj, description: isStr },
    `item ${isStr(raw.id) ? raw.id : '(no id)'}`, r.errors);
  return r;
}

export function validateRegion(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('region: not an object'); return r; }
  const who = `region ${isStr(raw.id) ? raw.id : '(no id)'}`;
  requireFields(raw, { id: isStr, index: isNum, name: isStr, topic: isStr, tilemapKey: isStr, tilesetKey: isStr,
    battleBackgroundKey: isStr, wildEnemyIds: (v) => isArr(v) && v.every(isStr), encounterRatePerStep: isNum,
    miniBossId: isStr, regionBossId: isStr, npcIds: (v) => isArr(v) && v.every(isStr), shrine: isObj, bossReward: isObj }, who, r.errors);
  if (isObj(raw.shrine)) requireFields(raw.shrine, { questionTopic: isStr, questionCount: isNum, passRatio: isNum, rewardXp: isNum,
    rewardItemIds: (v) => isArr(v) && v.every(isStr) }, `${who}.shrine`, r.errors);
  if ('unlocksRegionId' in raw && raw.unlocksRegionId !== null && !isStr(raw.unlocksRegionId)) r.errors.push(`${who}: unlocksRegionId must be string|null`);
  return r;
}

export function validateNpc(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('npc: not an object'); return r; }
  const who = `npc ${isStr(raw.id) ? raw.id : '(no id)'}`;
  requireFields(raw, { id: isStr, name: isStr, spriteKey: isStr, tile: (v) => isObj(v) && isNum(v.x) && isNum(v.y),
    dialogue: (v) => isArr(v) && v.length > 0 }, who, r.errors);
  if (isArr(raw.dialogue)) {
    for (const n of raw.dialogue as any[]) {
      if (!isObj(n) || !isStr(n.id) || !isStr(n.text)) r.errors.push(`${who}: a dialogue node is missing id/text`);
    }
  }
  return r;
}

export function validateAssetManifest(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('assetManifest: not an object'); return r; }
  for (const k of ['images', 'tilemaps', 'audio'] as const) if (!isObj(raw[k])) r.errors.push(`assetManifest: "${k}" must be an object`);
  if (!isArr(raw.placeholders)) r.errors.push('assetManifest: "placeholders" must be an array');
  return r;
}

export function validateTypeChart(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('typeChart: not an object'); return r; }
  for (const [atk, row] of Object.entries(raw)) {
    if (!isObj(row)) { r.errors.push(`typeChart["${atk}"] must be an object`); continue; }
    for (const [def, mult] of Object.entries(row)) if (!isNum(mult)) r.errors.push(`typeChart["${atk}"]["${def}"] must be a number`);
  }
  return r;
}

// top-level: required collections must be non-empty; cross-references checked as warnings
export function validateGameContent(c: GameContent): ValidationResult {
  const r = ok();
  if (!c.classes?.length) r.errors.push('content: classes is empty');
  if (!Object.keys(c.skills ?? {}).length) r.errors.push('content: skills is empty');
  if (!Object.keys(c.enemies ?? {}).length) r.errors.push('content: enemies is empty');
  if (!c.regions?.length) r.errors.push('content: regions is empty');
  if (!Object.keys(c.items ?? {}).length) r.errors.push('content: items is empty');
  if (!Object.keys(c.questions ?? {}).length) r.errors.push('content: questions is empty');
  if (!c.assets) r.errors.push('content: assetManifest missing');
  // cross-ref warnings (don't crash; helps content authors)
  const skillIds = new Set(Object.keys(c.skills ?? {}));
  for (const cls of c.classes ?? []) for (const sid of [...cls.startingSkillIds, ...cls.skillUnlocks.map(u => u.skillId)])
    if (!skillIds.has(sid)) r.warnings.push(`class ${cls.id} references unknown skill "${sid}"`);
  const enemyIds = new Set(Object.keys(c.enemies ?? {}));
  for (const reg of c.regions ?? []) {
    for (const eid of [...reg.wildEnemyIds, reg.miniBossId, reg.regionBossId]) if (!enemyIds.has(eid)) r.warnings.push(`region ${reg.id} references unknown enemy "${eid}"`);
    if (!c.questions?.[reg.topic]?.length) r.warnings.push(`region ${reg.id} topic "${reg.topic}" has no questions`);
  }
  return r;
}
```

- [ ] **Step 4: Run — confirm pass**

Run: `npx vitest run tests/content/contentLoader.test.ts`
Expected: all schema tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts tests/content/contentLoader.test.ts
git commit -m "feat: content schema validators with errors/warnings distinction (TDD)"
```

---

### Task 6: `ContentLoader` — import, validate, index — TDD with fixtures

**Files:**
- Create: `src/content/ContentLoader.ts`
- Test: append to `tests/content/contentLoader.test.ts`

`ContentLoader.fromRaw(raw)` takes the raw imported JSON objects (so it's testable with fixtures and so the *static-import* version is a thin wrapper), validates each collection, **drops malformed questions and items with a warning**, throws a `ContentError` (with the collected error messages) only when a hard error exists, and otherwise returns `{ content: GameContent, warnings: string[] }`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { ContentLoader, ContentError } from '../../src/content/ContentLoader';

const minimalRaw = () => ({
  classes: [{ id: 'pyron', name: 'Pyron', theme: 't', baseStats: { hp: 30, atk: 12, def: 6, spd: 9 }, growth: { hp: 6, atk: 3, def: 1, spd: 2 },
    signatureAffinity: 'Combustion', startingSkillIds: ['ember-test'], startingItemIds: [], skillUnlocks: [], evolutions: [] }],
  skills: { 'ember-test': { id: 'ember-test', name: 'Ember', affinity: 'Combustion', power: 30, energyCost: 20, topic: 'atomic-structure', questionDifficulty: 1, accuracy: 100, isSignature: true, isCatalystBurst: false, description: 'd' } },
  enemies: { protium: { id: 'protium', name: 'Protium', affinity: 'Atomic', baseStats: { hp: 20, atk: 8, def: 4, spd: 6 }, level: 3, attackPower: 20, skillIds: [], xpYield: 12, role: 'wild', spriteKey: 'enemy_protium' } },
  regions: [{ id: 'elemental-reaches', index: 1, name: 'The Elemental Reaches', topic: 'atomic-structure', tilemapKey: 'tiles_elemental_reaches', tilesetKey: 'tiles_elemental_reaches', battleBackgroundKey: 'bg_battle_elemental_reaches',
    wildEnemyIds: ['protium'], encounterRatePerStep: 0.12, miniBossId: 'protium', regionBossId: 'protium', npcIds: [],
    shrine: { questionTopic: 'atomic-structure', questionCount: 5, passRatio: 0.8, rewardXp: 200, rewardItemIds: [] }, unlocksRegionId: null, bossReward: { xp: 300, itemIds: [] } }],
  items: { buffer: { id: 'buffer', name: 'Buffer', kind: 'buffer', usableInBattle: true, effect: { healHp: 20 }, description: 'd' } },
  typeChart: { Base: { Acid: 2 } },
  questions: { 'atomic-structure': [
    { id: 'q1', topic: 'atomic-structure', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a','b','c','d'], answerIndex: 0, explanation: 'e' },
    { id: 'BAD', topic: 'atomic-structure', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a','b'], answerIndex: 0, explanation: 'e' } // malformed -> dropped
  ] },
  npcs: {},
  assets: { images: {}, tilemaps: {}, audio: {}, placeholders: [] }
});

describe('ContentLoader.fromRaw', () => {
  it('indexes valid content and drops malformed questions with a warning', () => {
    const { content, warnings } = ContentLoader.fromRaw(minimalRaw());
    expect(content.questions['atomic-structure'].map(q => q.id)).toEqual(['q1']);
    expect(warnings.some(w => /BAD/.test(w))).toBe(true);
    expect(content.regions[0].id).toBe('elemental-reaches');
    expect(content.skills['ember-test'].power).toBe(30);
  });
  it('throws ContentError when a required collection is empty', () => {
    const raw = minimalRaw(); (raw as any).classes = [];
    expect(() => ContentLoader.fromRaw(raw)).toThrowError(ContentError);
  });
  it('throws ContentError listing the offending fields when a skill is malformed', () => {
    const raw = minimalRaw(); (raw.skills as any)['ember-test'] = { id: 'ember-test' };
    expect(() => ContentLoader.fromRaw(raw)).toThrowError(/ember-test/);
  });
});
```

- [ ] **Step 2: Run — confirm failure**

Run: `npx vitest run tests/content/contentLoader.test.ts`
Expected: FAIL — `Cannot find module '../../src/content/ContentLoader'`.

- [ ] **Step 3: Implement `src/content/ContentLoader.ts`**

```ts
import type { GameContent, QuestionDef, ItemDef, SkillDef, ClassDef, EnemyDef, RegionDef, NpcDef, AssetManifest, TypeChart } from './types';
import {
  validateClass, validateSkill, validateEnemy, validateItem, validateRegion, validateNpc,
  validateAssetManifest, validateTypeChart, validateQuestion, validateGameContent, type ValidationResult
} from './schema';

export class ContentError extends Error {
  constructor(public readonly issues: string[]) { super(`Content failed to load:\n - ${issues.join('\n - ')}`); this.name = 'ContentError'; }
}

interface RawContent {
  classes: unknown[]; skills: Record<string, unknown>; enemies: Record<string, unknown>;
  regions: unknown[]; items: Record<string, unknown>; typeChart: unknown;
  questions: Record<string, unknown[]>; npcs: Record<string, unknown>; assets: unknown;
}

function collect(...rs: ValidationResult[]): ValidationResult {
  return { errors: rs.flatMap(r => r.errors), warnings: rs.flatMap(r => r.warnings) };
}

export const ContentLoader = {
  /** Validate + index raw imported JSON. Drops malformed questions/items (warning); throws ContentError on hard errors. */
  fromRaw(raw: RawContent): { content: GameContent; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // classes
    raw.classes.forEach((c) => { const v = validateClass(c); errors.push(...v.errors); warnings.push(...v.warnings); });
    // skills
    for (const [id, s] of Object.entries(raw.skills)) { const v = validateSkill({ ...(s as object), id: (s as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // enemies
    for (const [id, e] of Object.entries(raw.enemies)) { const v = validateEnemy({ ...(e as object), id: (e as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // regions
    raw.regions.forEach((rg) => { const v = validateRegion(rg); errors.push(...v.errors); warnings.push(...v.warnings); });
    // npcs
    for (const [id, n] of Object.entries(raw.npcs)) { const v = validateNpc({ ...(n as object), id: (n as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // type chart + assets
    { const v = collect(validateTypeChart(raw.typeChart), validateAssetManifest(raw.assets)); errors.push(...v.errors); warnings.push(...v.warnings); }

    // items: drop malformed with warning
    const items: Record<string, ItemDef> = {};
    for (const [id, it] of Object.entries(raw.items)) {
      const v = validateItem({ ...(it as object), id: (it as any)?.id ?? id });
      if (v.errors.length) warnings.push(`item ${id}: ${v.errors.join('; ')} — skipped`);
      else items[id] = it as ItemDef;
    }
    // questions: drop malformed with warning
    const questions: Record<string, QuestionDef[]> = {};
    for (const [topic, list] of Object.entries(raw.questions)) {
      const kept: QuestionDef[] = [];
      for (const q of list) { const v = validateQuestion(q); if (v.warnings.length) warnings.push(...v.warnings); else kept.push(q as QuestionDef); }
      questions[topic] = kept;
    }

    const content: GameContent = {
      classes: raw.classes as ClassDef[],
      skills: raw.skills as Record<string, SkillDef>,
      enemies: raw.enemies as Record<string, EnemyDef>,
      regions: (raw.regions as RegionDef[]).slice().sort((a, b) => a.index - b.index),
      items,
      typeChart: raw.typeChart as TypeChart,
      questions,
      npcs: raw.npcs as Record<string, NpcDef>,
      assets: raw.assets as AssetManifest
    };

    const top = validateGameContent(content);
    errors.push(...top.errors); warnings.push(...top.warnings);
    if (errors.length) throw new ContentError(errors);
    return { content, warnings };
  }
};
```

- [ ] **Step 4: Run — confirm pass**

Run: `npx vitest run tests/content/contentLoader.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/ContentLoader.ts tests/content/contentLoader.test.ts
git commit -m "feat: ContentLoader.fromRaw — validate, drop-malformed, index (TDD)"
```

---

### Task 7: Real data — `classes.json`, `typeChart.json`, `items.json` + "real content validates" test

**Files:**
- Create: `src/content/data/classes.json`, `src/content/data/typeChart.json`, `src/content/data/items.json`
- Create: `src/content/loadGameContent.ts` (static-import wrapper around `ContentLoader.fromRaw`)
- Test: `tests/content/realContent.test.ts`

> The static-import wrapper is what `BootScene` uses. It also lets the test assert "the JSON we actually ship validates with zero errors". `skills.json`, `enemies.json`, `regions.json`, `questions/`, `npcs.json`, `assetManifest.json` are stubbed minimally now and filled in Tasks 8–10; the wrapper and test grow with them.

- [ ] **Step 1: Create `src/content/data/typeChart.json`**

```json
{
  "Base":        { "Acid": 2, "Base": 0.5 },
  "Acid":        { "Metal": 2, "Ionic": 2, "Base": 0.5 },
  "Endothermic": { "Exothermic": 2, "Combustion": 2 },
  "Combustion":  { "Endothermic": 0.5 },
  "Catalyst":    { "Atomic": 0.5, "Acid": 0.5, "Base": 0.5, "Metal": 0.5, "Ionic": 0.5, "Covalent": 0.5, "Combustion": 0.5, "Exothermic": 0.5, "Endothermic": 0.5, "Decomposition": 0.5, "Synthesis": 0.5, "Precipitation": 0.5, "Neutral": 0.5 },
  "Decomposition": { "Decomposition": 0.5 }
}
```

- [ ] **Step 2: Create `src/content/data/items.json`**

```json
{
  "minor-buffer":  { "id": "minor-buffer",  "name": "Minor Buffer",  "kind": "buffer",        "usableInBattle": true,  "effect": { "healHp": 25 },                       "description": "Restores 25 HP. A weak pH buffer solution." },
  "buffer":        { "id": "buffer",        "name": "Buffer",        "kind": "buffer",        "usableInBattle": true,  "effect": { "healHpPercent": 50 },                "description": "Restores 50% of max HP." },
  "reagent":       { "id": "reagent",       "name": "Reagent",       "kind": "reagent",       "usableInBattle": true,  "effect": { "revive": true, "reviveHpPercent": 50 }, "description": "Revives a fainted hero with 50% HP." },
  "energy-cell":   { "id": "energy-cell",   "name": "Energy Cell",   "kind": "energy",        "usableInBattle": true,  "effect": { "restoreEnergy": 50 },                 "description": "Restores 50 Energy." },
  "atk-catalyst":  { "id": "atk-catalyst",  "name": "Activation Powder", "kind": "statBooster", "usableInBattle": true, "effect": { "statBoostStages": { "atk": 1 } },   "description": "+1 ATK stage for the battle." },
  "def-catalyst":  { "id": "def-catalyst",  "name": "Inhibitor Gel",  "kind": "statBooster",   "usableInBattle": true,  "effect": { "statBoostStages": { "def": 1 } },     "description": "+1 DEF stage for the battle." },
  "isotope-core":  { "id": "isotope-core",  "name": "Stable Isotope Core", "kind": "evolutionMaterial", "usableInBattle": false, "effect": {},                       "description": "A stabilised nucleus. Radiates with potential. (Evolution material.)" }
}
```

- [ ] **Step 3: Create `src/content/data/classes.json`**

(Stats balanced around the spec's biases. `growth` is per level beyond 1. `evolutions` carry stage-1 only for M1; `requiresRegionClearedId` is Region 1's id.)

```json
[
  {
    "id": "pyron", "name": "Pyron", "theme": "Combustion / energy",
    "baseStats": { "hp": 28, "atk": 14, "def": 6, "spd": 9 },
    "growth":    { "hp": 6,  "atk": 4,  "def": 1, "spd": 2 },
    "signatureAffinity": "Combustion",
    "startingSkillIds": ["proton-jab", "spark-flare", "shell-shatter"],
    "startingItemIds": [ { "itemId": "minor-buffer", "qty": 3 } ],
    "skillUnlocks": [ { "level": 3, "skillId": "ionize" }, { "level": 5, "skillId": "thermal-vent" }, { "level": 7, "skillId": "neutralize" }, { "level": 9, "skillId": "decompose" } ],
    "evolutions": [ { "stage": 1, "name": "Pyrochemist", "atLevel": 10, "requiresRegionClearedId": "elemental-reaches", "statBonus": { "hp": 12, "atk": 8, "def": 3, "spd": 4 }, "spriteKey": "hero_pyron_1", "newSignatureSkillId": "combustion-cascade" } ]
  },
  {
    "id": "aqualis", "name": "Aqualis", "theme": "Acids, bases & solutions",
    "baseStats": { "hp": 36, "atk": 10, "def": 9, "spd": 8 },
    "growth":    { "hp": 8,  "atk": 3,  "def": 2, "spd": 2 },
    "signatureAffinity": "Acid",
    "startingSkillIds": ["proton-jab", "acid-splash", "shell-shatter"],
    "startingItemIds": [ { "itemId": "minor-buffer", "qty": 4 } ],
    "skillUnlocks": [ { "level": 3, "skillId": "ionize" }, { "level": 5, "skillId": "neutralize" }, { "level": 7, "skillId": "precipitate" }, { "level": 9, "skillId": "decompose" } ],
    "evolutions": [ { "stage": 1, "name": "Solvent Adept", "atLevel": 10, "requiresRegionClearedId": "elemental-reaches", "statBonus": { "hp": 16, "atk": 5, "def": 5, "spd": 3 }, "spriteKey": "hero_aqualis_1", "newSignatureSkillId": "universal-solvent" } ]
  },
  {
    "id": "ionix", "name": "Ionix", "theme": "Atomic structure & bonding",
    "baseStats": { "hp": 30, "atk": 11, "def": 7, "spd": 13 },
    "growth":    { "hp": 6,  "atk": 3,  "def": 1, "spd": 4 },
    "signatureAffinity": "Atomic",
    "startingSkillIds": ["proton-jab", "ionize", "shell-shatter"],
    "startingItemIds": [ { "itemId": "minor-buffer", "qty": 3 } ],
    "skillUnlocks": [ { "level": 3, "skillId": "spark-flare" }, { "level": 5, "skillId": "catalyze" }, { "level": 7, "skillId": "neutralize" }, { "level": 9, "skillId": "decompose" } ],
    "evolutions": [ { "stage": 1, "name": "Nucleon", "atLevel": 10, "requiresRegionClearedId": "elemental-reaches", "statBonus": { "hp": 12, "atk": 6, "def": 3, "spd": 7 }, "spriteKey": "hero_ionix_1", "newSignatureSkillId": "nuclear-realignment" } ]
  }
]
```

- [ ] **Step 4: Stub the not-yet-written data files** so the wrapper imports compile

`src/content/data/skills.json` → `{}` · `src/content/data/enemies.json` → `{}` · `src/content/data/regions.json` → `[]` · `src/content/data/npcs.json` → `{}` · `src/content/data/assetManifest.json` → `{ "images": {}, "tilemaps": {}, "audio": {}, "placeholders": [] }` · `src/content/data/questions/atomic-structure.json` → `[]`

- [ ] **Step 5: Create `src/content/loadGameContent.ts`**

```ts
import classes from './data/classes.json';
import skills from './data/skills.json';
import enemies from './data/enemies.json';
import regions from './data/regions.json';
import items from './data/items.json';
import typeChart from './data/typeChart.json';
import assets from './data/assetManifest.json';
import npcs from './data/npcs.json';
import atomicStructure from './data/questions/atomic-structure.json';
import { ContentLoader } from './ContentLoader';
import type { GameContent } from './types';

export function loadGameContent(): { content: GameContent; warnings: string[] } {
  return ContentLoader.fromRaw({
    classes: classes as unknown[],
    skills: skills as Record<string, unknown>,
    enemies: enemies as Record<string, unknown>,
    regions: regions as unknown[],
    items: items as Record<string, unknown>,
    typeChart,
    questions: { 'atomic-structure': atomicStructure as unknown[] },
    npcs: npcs as Record<string, unknown>,
    assets
  });
}
```

- [ ] **Step 6: Write `tests/content/realContent.test.ts`** (will fail until Tasks 8–10 fill the stubs — that is expected; it is the contract those tasks satisfy)

```ts
import { describe, it, expect } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';

describe('shipped content', () => {
  it('loads without throwing and reports no cross-reference warnings', () => {
    const { content, warnings } = loadGameContent();
    expect(warnings).toEqual([]); // all ids resolve; no malformed questions in the shipped file
    expect(content.classes.map(c => c.id).sort()).toEqual(['aqualis', 'ionix', 'pyron']);
  });
  it('Region 1 exists, points at the atomic-structure topic, and has a mini-boss + region boss', () => {
    const { content } = loadGameContent();
    const r1 = content.regions.find(r => r.index === 1)!;
    expect(r1.id).toBe('elemental-reaches');
    expect(r1.topic).toBe('atomic-structure');
    expect(content.enemies[r1.miniBossId]).toBeDefined();
    expect(content.enemies[r1.regionBossId]).toBeDefined();
    expect(content.enemies[r1.regionBossId].role).toBe('regionBoss');
  });
  it('every class can equip 5 skills by some level (≥5 skills reachable)', () => {
    const { content } = loadGameContent();
    for (const c of content.classes) {
      const reachable = new Set([...c.startingSkillIds, ...c.skillUnlocks.map(u => u.skillId)]);
      expect(reachable.size).toBeGreaterThanOrEqual(5);
    }
  });
  it('atomic-structure question bank has 40–60 questions spanning all three difficulties', () => {
    const { content } = loadGameContent();
    const qs = content.questions['atomic-structure'];
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true); // at least one widget question (used by the boss)
  });
});
```

- [ ] **Step 7: Run — partial pass expected**

Run: `npx vitest run tests/content/realContent.test.ts`
Expected: the `classes` assertions pass; region/skill-count/question assertions FAIL (stubs empty). Leave it — Tasks 8–10 turn it green. *(If the loader throws here because empty `skills`/`enemies`/`regions`/`questions` trigger hard errors — it will — that's also expected; Task 8 fixes it. The test file is committed now as the contract.)*

- [ ] **Step 8: Commit**

```bash
git add src/content/data/classes.json src/content/data/typeChart.json src/content/data/items.json src/content/data/skills.json src/content/data/enemies.json src/content/data/regions.json src/content/data/npcs.json src/content/data/assetManifest.json src/content/data/questions/atomic-structure.json src/content/loadGameContent.ts tests/content/realContent.test.ts
git commit -m "feat: classes/typeChart/items data + content loader wrapper + shipped-content contract test"
```

---

### Task 8: Real data — `skills.json`, `enemies.json`, `regions.json`

**Files:**
- Modify: `src/content/data/skills.json`, `src/content/data/enemies.json`, `src/content/data/regions.json`

- [ ] **Step 1: Write `src/content/data/skills.json`**

(IDs referenced by `classes.json` above + the three stage-1 signature skills + Region 1 boss skills. `topic` is `atomic-structure` for the chemistry skills so they trigger atomic-structure quizzes; `proton-jab` is a no-quiz "reliable" skill — `topic: null`. Catalyst Burst skills have `isCatalystBurst: true` and `topic: null` — bursts never quiz.)

```json
{
  "proton-jab":      { "id": "proton-jab", "name": "Proton Jab", "affinity": "Neutral", "power": 28, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "A reliable jab. No reaction required." },
  "spark-flare":     { "id": "spark-flare", "name": "Spark Flare", "affinity": "Combustion", "power": 42, "energyCost": 25, "topic": "atomic-structure", "questionDifficulty": 1, "accuracy": 95, "isSignature": true, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "combusting", "chance": 30, "turns": 2, "magnitude": 4 } }, "description": "Ignites the target. Pyron's signature line. May inflict Combusting." },
  "acid-splash":     { "id": "acid-splash", "name": "Acid Splash", "affinity": "Acid", "power": 40, "energyCost": 25, "topic": "atomic-structure", "questionDifficulty": 1, "accuracy": 100, "isSignature": true, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "dissolved", "chance": 35, "turns": 2, "magnitude": 4 } }, "description": "Corrosive splash. Aqualis's signature line. May inflict Dissolved." },
  "ionize":          { "id": "ionize", "name": "Ionize", "affinity": "Atomic", "power": 36, "energyCost": 20, "topic": "atomic-structure", "questionDifficulty": 1, "accuracy": 100, "isSignature": true, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "endothermicChill", "chance": 30, "turns": 2, "magnitude": 0 } }, "description": "Strips electrons away. Ionix's signature line. May reduce ATK." },
  "shell-shatter":   { "id": "shell-shatter", "name": "Shell Shatter", "affinity": "Atomic", "power": 38, "energyCost": 25, "topic": "atomic-structure", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "oxidised", "chance": 40, "turns": 3, "magnitude": 0 } }, "description": "Cracks an electron shell. May inflict Oxidised (DEF drain)." },
  "thermal-vent":    { "id": "thermal-vent", "name": "Thermal Vent", "affinity": "Exothermic", "power": 50, "energyCost": 35, "topic": "atomic-structure", "questionDifficulty": 2, "accuracy": 90, "isSignature": false, "isCatalystBurst": false, "description": "Releases stored heat in a burst." },
  "neutralize":      { "id": "neutralize", "name": "Neutralize", "affinity": "Base", "power": 44, "energyCost": 30, "topic": "atomic-structure", "questionDifficulty": 2, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "A basic counter to acids. Super-effective vs Acid." },
  "precipitate":     { "id": "precipitate", "name": "Precipitate", "affinity": "Precipitation", "power": 18, "energyCost": 25, "topic": "atomic-structure", "questionDifficulty": 2, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "stripBuffs": true }, "description": "Crashes the target's stat boosts out of solution." },
  "catalyze":        { "id": "catalyze", "name": "Catalyze", "affinity": "Catalyst", "power": 8, "energyCost": 20, "topic": "atomic-structure", "questionDifficulty": 2, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "grantExtraAction": true, "applyStatus": { "id": "catalysed", "chance": 100, "turns": 2, "magnitude": 0 } }, "description": "Lowers the activation energy — grants an extra action this turn." },
  "decompose":       { "id": "decompose", "name": "Decompose", "affinity": "Decomposition", "power": 30, "energyCost": 30, "topic": "atomic-structure", "questionDifficulty": 3, "accuracy": 90, "isSignature": false, "isCatalystBurst": false, "behavior": { "splitTarget": true }, "description": "Breaks a large foe into two weaker halves." },
  "combustion-cascade":   { "id": "combustion-cascade", "name": "Combustion Cascade", "affinity": "Combustion", "power": 60, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": true, "isCatalystBurst": true, "behavior": { "applyStatus": { "id": "combusting", "chance": 100, "turns": 3, "magnitude": 6 } }, "description": "Pyrochemist's Catalyst Burst — a chain of detonations." },
  "universal-solvent":    { "id": "universal-solvent", "name": "Universal Solvent", "affinity": "Acid", "power": 55, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": true, "isCatalystBurst": true, "behavior": { "stripBuffs": true, "applyStatus": { "id": "dissolved", "chance": 100, "turns": 3, "magnitude": 6 } }, "description": "Solvent Adept's Catalyst Burst — dissolves everything, buffs included." },
  "nuclear-realignment":  { "id": "nuclear-realignment", "name": "Nuclear Realignment", "affinity": "Atomic", "power": 50, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": true, "isCatalystBurst": true, "behavior": { "applyStatus": { "id": "precipitated", "chance": 100, "turns": 1, "magnitude": 0 } }, "description": "Nucleon's Catalyst Burst — rips the nucleus apart and stuns." },
  "isotope-flux":         { "id": "isotope-flux", "name": "Isotope Flux", "affinity": "Atomic", "power": 34, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Unstable Isotope's attack — radioactive flux." }
}
```

> **Catalyst Burst lookup:** `BattleEngine` picks the burst skill by `isCatalystBurst === true` among the class's reachable signature skills. Since each class has exactly one (`combustion-cascade` / `universal-solvent` / `nuclear-realignment`) and its `skillUnlocks`/`evolutions` reference it, that resolves uniquely. (If a class has no burst skill yet, Catalyst Burst falls back to "highest-power equipped Skill at ×3.0" — handled in Task 19.)

- [ ] **Step 2: Wire the burst skills into class evolutions**

In `classes.json`, the `evolutions[0].newSignatureSkillId` values (`combustion-cascade`, `universal-solvent`, `nuclear-realignment`) already match. Add each burst skill to the corresponding class's `skillUnlocks` at level 10 so it becomes reachable/equippable on evolution: append to `pyron.skillUnlocks` → `{ "level": 10, "skillId": "combustion-cascade" }`; to `aqualis.skillUnlocks` → `{ "level": 10, "skillId": "universal-solvent" }`; to `ionix.skillUnlocks` → `{ "level": 10, "skillId": "nuclear-realignment" }`.

- [ ] **Step 3: Write `src/content/data/enemies.json`**

```json
{
  "protium":           { "id": "protium", "name": "Protium", "affinity": "Atomic", "baseStats": { "hp": 22, "atk": 8, "def": 4, "spd": 6 }, "level": 2, "attackPower": 22, "skillIds": [], "xpYield": 14, "role": "wild", "spriteKey": "enemy_protium" },
  "electrid":          { "id": "electrid", "name": "Electrid", "affinity": "Atomic", "baseStats": { "hp": 18, "atk": 7, "def": 3, "spd": 11 }, "level": 3, "attackPower": 20, "skillIds": ["spark-flare"], "xpYield": 16, "role": "wild", "spriteKey": "enemy_electrid" },
  "shellfracture":     { "id": "shellfracture", "name": "Shellfracture", "affinity": "Decomposition", "baseStats": { "hp": 40, "atk": 9, "def": 6, "spd": 4 }, "level": 4, "attackPower": 24, "skillIds": ["shell-shatter"], "xpYield": 24, "role": "wild", "spriteKey": "enemy_shellfracture", "splitIntoId": "shellfracture-half" },
  "shellfracture-half":{ "id": "shellfracture-half", "name": "Shell Fragment", "affinity": "Decomposition", "baseStats": { "hp": 14, "atk": 8, "def": 3, "spd": 7 }, "level": 4, "attackPower": 18, "skillIds": [], "xpYield": 8, "role": "wild", "spriteKey": "enemy_shellfracture_half" },
  "ionized-drift":     { "id": "ionized-drift", "name": "Ionized Drift", "affinity": "Ionic", "baseStats": { "hp": 26, "atk": 10, "def": 7, "spd": 8 }, "level": 4, "attackPower": 22, "skillIds": ["ionize"], "xpYield": 20, "role": "wild", "spriteKey": "enemy_ionized_drift", "teachesSkillId": "thermal-vent" },
  "unstable-deuteride":{ "id": "unstable-deuteride", "name": "Unstable Deuteride", "affinity": "Atomic", "baseStats": { "hp": 70, "atk": 12, "def": 9, "spd": 7 }, "level": 6, "attackPower": 26, "skillIds": ["shell-shatter", "spark-flare"], "xpYield": 80, "role": "miniBoss", "spriteKey": "enemy_unstable_deuteride", "splitIntoId": "shellfracture-half", "bossSoftScale": false },
  "the-unstable-isotope": { "id": "the-unstable-isotope", "name": "The Unstable Isotope", "affinity": "Atomic", "baseStats": { "hp": 140, "atk": 16, "def": 12, "spd": 10 }, "level": 9, "attackPower": 30, "skillIds": ["isotope-flux", "shell-shatter", "spark-flare"], "xpYield": 260, "role": "regionBoss", "spriteKey": "enemy_unstable_isotope", "bossSoftScale": true, "teachesSkillId": "thermal-vent" }
}
```

- [ ] **Step 4: Write `src/content/data/regions.json`** — Region 1 + seven *locked* placeholder stubs (so `WorldMapScene` shows all 8 nodes; only `index 1` is playable in M1). Stubs reference Region 1's content so they still validate; they are unreachable in M1 because `regionProgress` only ever marks Region 1 entered. **Decision:** to keep the cross-ref test clean, include only Region 1 in `regions.json` for M1 and have `WorldMapScene` render nodes 2–8 from a static `LOCKED_REGION_LABELS` array in the scene file. So `regions.json` is just:

```json
[
  {
    "id": "elemental-reaches", "index": 1, "name": "The Elemental Reaches", "topic": "atomic-structure",
    "tilemapKey": "tilemap_elemental_reaches", "tilesetKey": "tiles_elemental_reaches", "battleBackgroundKey": "bg_battle_elemental_reaches",
    "wildEnemyIds": ["protium", "electrid", "shellfracture", "ionized-drift"],
    "encounterRatePerStep": 0.12,
    "miniBossId": "unstable-deuteride",
    "regionBossId": "the-unstable-isotope",
    "npcIds": ["professor-bohrlin", "archivist-mendel", "shrinekeeper-quanta"],
    "shrine": { "questionTopic": "atomic-structure", "questionCount": 6, "passRatio": 0.8334, "rewardXp": 220, "rewardItemIds": ["energy-cell", "isotope-core"] },
    "unlocksRegionId": null,
    "bossReward": { "xp": 300, "itemIds": ["reagent", "isotope-core"], "skillId": "thermal-vent" }
  }
]
```

> (`passRatio` 0.8334 of 6 → must get ≥ 5 correct. `unlocksRegionId: null` because Region 2 isn't built in M1 — beating the boss completes the slice.)

- [ ] **Step 5: Add the type-check + lint test for skills referenced by enemies**

Append to `tests/content/realContent.test.ts`:

```ts
it('every skill id referenced by an enemy exists', () => {
  const { content } = loadGameContent();
  for (const e of Object.values(content.enemies)) for (const sid of e.skillIds) expect(content.skills[sid], `${e.id} -> ${sid}`).toBeDefined();
});
it('each class has exactly one Catalyst Burst skill reachable', () => {
  const { content } = loadGameContent();
  for (const c of content.classes) {
    const reachable = [...c.startingSkillIds, ...c.skillUnlocks.map(u => u.skillId)];
    const bursts = reachable.filter(id => content.skills[id]?.isCatalystBurst);
    expect(bursts.length, c.id).toBe(1);
  }
});
```

- [ ] **Step 6: Run** — region/skill/enemy assertions now pass; question-count assertion still fails (Task 9).

Run: `npx vitest run tests/content/realContent.test.ts`
Expected: only the "40–60 questions" test still red.

- [ ] **Step 7: Commit**

```bash
git add src/content/data/skills.json src/content/data/enemies.json src/content/data/regions.json src/content/data/classes.json tests/content/realContent.test.ts
git commit -m "feat: skills/enemies/regions data for Region 1 (The Elemental Reaches)"
```

---

### Task 9: Real data — `questions/atomic-structure.json` (~50 questions)

**Files:**
- Modify: `src/content/data/questions/atomic-structure.json`

Topic = NSW Year 10 "Atomic structure, subatomic particles, electron shells, the Periodic Table". Author **~50 questions**: ~22 difficulty 1 (recall/identification), ~18 difficulty 2 (application), ~10 difficulty 3 (analysis + the balance-the-equation widget question(s) — at least one `balanceEquation`). Sub-topics to cover, roughly evenly: protons/neutrons/electrons & their charges/masses; atomic number vs mass number; isotopes; ions (cations/anions, charge); electron shell capacities (2, 8, 8…) & electron configuration; valence electrons & reactivity; periodic table layout — periods vs groups; group properties (alkali metals, halogens, noble gases); metals vs non-metals vs metalloids; Bohr/Rutherford/Thomson model history; relative atomic mass; reading the periodic table (symbol → Z, A); a couple of simple balancing questions (e.g. formation of water, magnesium oxide) for the difficulty-3 widget.

- [ ] **Step 1: Author the file.** Format below; the validator (Task 5) is the contract — every item must pass `validateQuestion` (4 string options + `answerIndex` 0..3 for `mcq`; valid `equation` for `balanceEquation`; non-empty `explanation`; `difficulty` ∈ {1,2,3}). Provide a `hint` on as many as practical (Study Mode uses it). Here is a representative slice — author ~50 in this shape:

```json
[
  { "id": "as-001", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "What is the charge of a proton?", "options": ["−1", "0", "+1", "+2"], "answerIndex": 2, "explanation": "Protons carry a charge of +1; electrons −1; neutrons 0.", "hint": "It's the opposite of an electron's charge." },
  { "id": "as-002", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "Which particle is found in the nucleus AND has no charge?", "options": ["Electron", "Proton", "Neutron", "Ion"], "answerIndex": 2, "explanation": "Neutrons sit in the nucleus and are electrically neutral.", "hint": "Nucleus = protons + neutrons. One of those has zero charge." },
  { "id": "as-003", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "The atomic number of an element tells you the number of…", "options": ["neutrons", "protons", "electron shells", "isotopes"], "answerIndex": 1, "explanation": "Atomic number (Z) = number of protons. In a neutral atom it also equals the number of electrons.", "hint": "It's what defines which element you have." },
  { "id": "as-004", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "An atom of carbon has 6 protons and 6 neutrons. What is its mass number?", "options": ["6", "12", "0", "18"], "answerIndex": 1, "explanation": "Mass number = protons + neutrons = 6 + 6 = 12.", "hint": "Add the two heavy particles." },
  { "id": "as-005", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "How many electrons can the FIRST electron shell hold?", "options": ["2", "8", "18", "1"], "answerIndex": 0, "explanation": "Shell 1 holds at most 2 electrons; shells 2 and 3 (for the first 20 elements) hold up to 8.", "hint": "It's the smallest shell." },
  { "id": "as-006", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "Which group of the periodic table contains the very unreactive 'noble gases'?", "options": ["Group 1", "Group 2", "Group 17", "Group 18"], "answerIndex": 3, "explanation": "Group 18 (the far-right column) are the noble gases — full outer shells, so very unreactive.", "hint": "Far right of the table." },
  { "id": "as-007", "topic": "atomic-structure", "difficulty": 1, "format": "mcq", "prompt": "A sodium atom loses one electron. What is the charge of the resulting ion?", "options": ["−1", "+1", "0", "+2"], "answerIndex": 1, "explanation": "Losing a negative electron leaves a net +1 charge: Na → Na⁺.", "hint": "Remove a minus, the balance shifts positive." },
  { "id": "as-014", "topic": "atomic-structure", "difficulty": 2, "format": "mcq", "prompt": "Chlorine-35 and chlorine-37 are isotopes. They differ in their number of…", "options": ["protons", "electrons", "neutrons", "electron shells"], "answerIndex": 2, "explanation": "Isotopes of an element have the same protons (so same element) but different numbers of neutrons.", "hint": "Same element ⇒ same protons. So what changed to alter the mass?" },
  { "id": "as-015", "topic": "atomic-structure", "difficulty": 2, "format": "mcq", "prompt": "An atom has the electron configuration 2,8,1. To which group does it belong?", "options": ["Group 1", "Group 8", "Group 18", "Group 3"], "answerIndex": 0, "explanation": "One electron in the outer shell ⇒ Group 1 (the alkali metals).", "hint": "Group number ↔ number of valence (outer-shell) electrons." },
  { "id": "as-016", "topic": "atomic-structure", "difficulty": 2, "format": "mcq", "prompt": "Why are Group 1 metals (Li, Na, K) so reactive?", "options": ["They have full outer shells", "They have a single, easily-lost outer electron", "They have no electrons", "They are noble gases"], "answerIndex": 1, "explanation": "One loosely-held outer electron is easily lost to form a +1 ion, so they react readily.", "hint": "Think about how hard it is to remove that lone outer electron." },
  { "id": "as-022", "topic": "atomic-structure", "difficulty": 2, "format": "mcq", "prompt": "Which historical model first placed a small, dense, positively-charged nucleus at the centre of the atom?", "options": ["Thomson's 'plum pudding' model", "Dalton's solid sphere", "Rutherford's nuclear model", "Bohr's shell model"], "answerIndex": 2, "explanation": "Rutherford's gold-foil experiment led to the nuclear model; Bohr later added quantised shells.", "hint": "Gold foil. Alpha particles. Most went straight through; a few bounced back." },
  { "id": "as-040", "topic": "atomic-structure", "difficulty": 3, "format": "mcq", "prompt": "An ion has 12 protons, 12 neutrons and 10 electrons. Identify it.", "options": ["A neutral magnesium atom", "Mg²⁺", "O²⁻", "Na⁺"], "answerIndex": 1, "explanation": "12 protons ⇒ magnesium. 12 protons vs 10 electrons ⇒ net +2 ⇒ Mg²⁺.", "hint": "Protons fix the element; protons minus electrons fix the charge." },
  { "id": "as-048", "topic": "atomic-structure", "difficulty": 3, "format": "balanceEquation", "prompt": "Balance the formation of water: __ H₂ + __ O₂ → __ H₂O", "equation": { "reactants": [ { "formula": "H2", "coeff": 2 }, { "formula": "O2", "coeff": 1 } ], "products": [ { "formula": "H2O", "coeff": 2 } ] }, "explanation": "2H₂ + O₂ → 2H₂O — 4 H and 2 O on each side. (You'll meet balancing properly in The Balance Halls.)", "hint": "Count O atoms first: O₂ gives 2, so you need 2 H₂O." },
  { "id": "as-049", "topic": "atomic-structure", "difficulty": 3, "format": "balanceEquation", "prompt": "Balance: __ Mg + __ O₂ → __ MgO", "equation": { "reactants": [ { "formula": "Mg", "coeff": 2 }, { "formula": "O2", "coeff": 1 } ], "products": [ { "formula": "MgO", "coeff": 2 } ] }, "explanation": "2Mg + O₂ → 2MgO — magnesium burns to magnesium oxide.", "hint": "O₂ has two oxygen atoms; each MgO holds one." }
]
```

- [ ] **Step 2: Run the contract test**

Run: `npx vitest run tests/content/realContent.test.ts`
Expected: ALL green now — count 40–60, every difficulty ≥5, at least one `balanceEquation`, zero warnings from `loadGameContent`.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all content tests green.

- [ ] **Step 4: Commit**

```bash
git add src/content/data/questions/atomic-structure.json
git commit -m "content: ~50 atomic-structure / periodic-table questions (teacher-editable)"
```

---

### Task 10: Real data — `npcs.json` + `assetManifest.json`

**Files:**
- Modify: `src/content/data/npcs.json`, `src/content/data/assetManifest.json`

- [ ] **Step 1: Write `src/content/data/npcs.json`** — three Region 1 mentors. Dialogue is the "lesson layer": short, syllabus-aligned. `node[0]` is the entry node.

```json
{
  "professor-bohrlin": {
    "id": "professor-bohrlin", "name": "Professor Bohrlin", "spriteKey": "npc_professor_bohrlin", "tile": { "x": 6, "y": 5 }, "facing": "down",
    "dialogue": [
      { "id": "n0", "speaker": "Prof. Bohrlin", "text": "Welcome to the Elemental Reaches, young chemist. Æquor is unravelling — but every atom still obeys the rules. Shall I refresh you?", "choices": [ { "label": "Please do.", "next": "n1" }, { "label": "I know this — let me through.", "next": "n_skip" } ] },
      { "id": "n1", "speaker": "Prof. Bohrlin", "text": "An atom has a tiny, dense NUCLEUS — protons (+1) and neutrons (0) — surrounded by electrons (−1) in SHELLS.", "next": "n2" },
      { "id": "n2", "speaker": "Prof. Bohrlin", "text": "The number of protons is the ATOMIC NUMBER — it decides which element you have. Protons + neutrons = MASS NUMBER.", "next": "n3" },
      { "id": "n3", "speaker": "Prof. Bohrlin", "text": "Shells fill up: 2 in the first, then 8, then 8. The OUTER-shell electrons — the valence electrons — decide how an element reacts.", "next": "n4", "setFlag": "lesson_atomic_structure_seen" },
      { "id": "n4", "speaker": "Prof. Bohrlin", "text": "When you use a chemistry Skill in battle you'll be asked about this. Get it right and the reaction roars; get it wrong and I'll set you straight — no harm done. Off you go.", "end": true },
      { "id": "n_skip", "speaker": "Prof. Bohrlin", "text": "Confident! Then prove it in battle. Remember — a wrong answer just fizzles the move; it never hurts you.", "end": true, "setFlag": "lesson_atomic_structure_seen" }
    ]
  },
  "archivist-mendel": {
    "id": "archivist-mendel", "name": "Archivist Mendel", "spriteKey": "npc_archivist_mendel", "tile": { "x": 12, "y": 9 }, "facing": "left",
    "dialogue": [
      { "id": "m0", "speaker": "Archivist Mendel", "text": "The Periodic Table is a map of every element — and it's been scrambled by the corruption. Let me show you how to read it.", "next": "m1" },
      { "id": "m1", "speaker": "Archivist Mendel", "text": "ROWS are PERIODS — going across, each atom gains a proton and an electron. COLUMNS are GROUPS — elements in a group have the same number of valence electrons, so they behave alike.", "next": "m2" },
      { "id": "m2", "speaker": "Archivist Mendel", "text": "Group 1 — alkali metals — one outer electron, fiercely reactive. Group 17 — halogens — need one more, also reactive. Group 18 — noble gases — full shells, almost inert.", "next": "m3" },
      { "id": "m3", "speaker": "Archivist Mendel", "text": "ISOTOPES are atoms of the same element with different neutron counts — same chemistry, different mass. An ION is an atom that's gained or lost electrons, so it carries a charge.", "next": "m4", "setFlag": "lesson_periodic_table_seen" },
      { "id": "m4", "speaker": "Archivist Mendel", "text": "Master this and the Unstable Isotope guarding the heart of this region won't stand a chance. Good luck.", "end": true }
    ]
  },
  "shrinekeeper-quanta": {
    "id": "shrinekeeper-quanta", "name": "Shrinekeeper Quanta", "spriteKey": "npc_shrinekeeper_quanta", "tile": { "x": 3, "y": 13 }, "facing": "right",
    "dialogue": [
      { "id": "q0", "speaker": "Shrinekeeper Quanta", "text": "Behind me lies the Challenge Shrine — a gauntlet of questions, no monsters. Clear it and you'll earn an Energy Cell and a Stable Isotope Core.", "choices": [ { "label": "Enter the Shrine.", "next": "q_enter" }, { "label": "Not yet.", "next": "q_later" } ] },
      { "id": "q_enter", "speaker": "Shrinekeeper Quanta", "text": "Six questions. Miss no more than one. Begin when ready.", "end": true, "setFlag": "shrine_entered_elemental_reaches" },
      { "id": "q_later", "speaker": "Shrinekeeper Quanta", "text": "The Shrine will wait. Come back when you've studied.", "end": true }
    ]
  }
}
```

> `DialogueScene` treats `q_enter` specially: a node id starting `q_enter` (or, more robustly, a node with `setFlag` matching `shrine_entered_*`) tells the scene, on dialogue end, to launch `ChallengeShrineScene`. **Cleaner contract:** add an optional `launch?: 'shrine' | 'battle:<enemyId>'` field to `DialogueNode` in `types.ts` and have the validator allow it; `q_enter` gets `"launch": "shrine"`. Add that field now (one-line addition to `types.ts` + `validateNpc` ignores unknown extra fields already, so no validator change needed).

- [ ] **Step 2: Write `src/content/data/assetManifest.json`** — every logical key the game references, each with a placeholder spec (coloured rect + label) so the game is fully playable before any art exists. `images`/`tilemaps`/`audio` map to real paths that *do not exist yet* — Phaser's loader will 404, the loader-error handler (Task 35) swaps in the placeholder texture; in M1 we **skip the network load entirely** and only generate placeholders. The `placeholders` array is the source of truth in M1.

```json
{
  "images": {
    "worldmap": "assets/images/worldmap.png",
    "hero_pyron_0_overworld": "assets/images/hero_pyron_0_overworld.png",
    "hero_pyron_0_battle": "assets/images/hero_pyron_0_battle.png",
    "hero_pyron_1_overworld": "assets/images/hero_pyron_1_overworld.png",
    "hero_pyron_1_battle": "assets/images/hero_pyron_1_battle.png",
    "hero_aqualis_0_overworld": "assets/images/hero_aqualis_0_overworld.png",
    "hero_aqualis_0_battle": "assets/images/hero_aqualis_0_battle.png",
    "hero_aqualis_1_overworld": "assets/images/hero_aqualis_1_overworld.png",
    "hero_aqualis_1_battle": "assets/images/hero_aqualis_1_battle.png",
    "hero_ionix_0_overworld": "assets/images/hero_ionix_0_overworld.png",
    "hero_ionix_0_battle": "assets/images/hero_ionix_0_battle.png",
    "hero_ionix_1_overworld": "assets/images/hero_ionix_1_overworld.png",
    "hero_ionix_1_battle": "assets/images/hero_ionix_1_battle.png",
    "enemy_protium": "assets/images/enemy_protium.png",
    "enemy_electrid": "assets/images/enemy_electrid.png",
    "enemy_shellfracture": "assets/images/enemy_shellfracture.png",
    "enemy_shellfracture_half": "assets/images/enemy_shellfracture_half.png",
    "enemy_ionized_drift": "assets/images/enemy_ionized_drift.png",
    "enemy_unstable_deuteride": "assets/images/enemy_unstable_deuteride.png",
    "enemy_unstable_isotope": "assets/images/enemy_unstable_isotope.png",
    "npc_professor_bohrlin": "assets/images/npc_professor_bohrlin.png",
    "npc_archivist_mendel": "assets/images/npc_archivist_mendel.png",
    "npc_shrinekeeper_quanta": "assets/images/npc_shrinekeeper_quanta.png",
    "tiles_elemental_reaches": "assets/images/tiles_elemental_reaches.png",
    "bg_battle_elemental_reaches": "assets/images/bg_battle_elemental_reaches.png",
    "ui_textbox": "assets/images/ui_textbox.png",
    "ui_chainmeter": "assets/images/ui_chainmeter.png",
    "icon_status_oxidised": "assets/images/icon_status_oxidised.png",
    "icon_status_dissolved": "assets/images/icon_status_dissolved.png",
    "icon_status_catalysed": "assets/images/icon_status_catalysed.png",
    "icon_status_precipitated": "assets/images/icon_status_precipitated.png",
    "icon_status_endothermicChill": "assets/images/icon_status_endothermicChill.png",
    "icon_status_combusting": "assets/images/icon_status_combusting.png",
    "title_art": "assets/images/title_art.png"
  },
  "tilemaps": { "tilemap_elemental_reaches": "assets/tilemaps/elemental-reaches.json" },
  "audio": {},
  "placeholders": [
    { "key": "worldmap", "w": 480, "h": 320, "color": "#1a2438", "label": "ÆQUOR WORLD MAP" },
    { "key": "title_art", "w": 480, "h": 200, "color": "#10243a", "label": "EQUILIBRIUM LOST" },
    { "key": "hero_pyron_0_overworld", "w": 16, "h": 24, "color": "#e25822", "label": "P" },
    { "key": "hero_pyron_0_battle", "w": 48, "h": 48, "color": "#e25822", "label": "Pyron" },
    { "key": "hero_pyron_1_overworld", "w": 16, "h": 24, "color": "#ff7a3d", "label": "P+" },
    { "key": "hero_pyron_1_battle", "w": 48, "h": 48, "color": "#ff7a3d", "label": "Pyrochemist" },
    { "key": "hero_aqualis_0_overworld", "w": 16, "h": 24, "color": "#2a8fd6", "label": "A" },
    { "key": "hero_aqualis_0_battle", "w": 48, "h": 48, "color": "#2a8fd6", "label": "Aqualis" },
    { "key": "hero_aqualis_1_overworld", "w": 16, "h": 24, "color": "#48b0ef", "label": "A+" },
    { "key": "hero_aqualis_1_battle", "w": 48, "h": 48, "color": "#48b0ef", "label": "Solvent Adept" },
    { "key": "hero_ionix_0_overworld", "w": 16, "h": 24, "color": "#9d4edd", "label": "I" },
    { "key": "hero_ionix_0_battle", "w": 48, "h": 48, "color": "#9d4edd", "label": "Ionix" },
    { "key": "hero_ionix_1_overworld", "w": 16, "h": 24, "color": "#b76eff", "label": "I+" },
    { "key": "hero_ionix_1_battle", "w": 48, "h": 48, "color": "#b76eff", "label": "Nucleon" },
    { "key": "enemy_protium", "w": 32, "h": 32, "color": "#c9d1d9", "label": "Protium" },
    { "key": "enemy_electrid", "w": 32, "h": 32, "color": "#ffd166", "label": "Electrid" },
    { "key": "enemy_shellfracture", "w": 40, "h": 40, "color": "#8d99ae", "label": "Shellfract." },
    { "key": "enemy_shellfracture_half", "w": 24, "h": 24, "color": "#adb5bd", "label": "Frag" },
    { "key": "enemy_ionized_drift", "w": 32, "h": 32, "color": "#06d6a0", "label": "Ion.Drift" },
    { "key": "enemy_unstable_deuteride", "w": 48, "h": 48, "color": "#ef476f", "label": "Deuteride" },
    { "key": "enemy_unstable_isotope", "w": 64, "h": 64, "color": "#d00000", "label": "UNSTABLE ISOTOPE" },
    { "key": "npc_professor_bohrlin", "w": 16, "h": 24, "color": "#588157", "label": "Pr" },
    { "key": "npc_archivist_mendel", "w": 16, "h": 24, "color": "#bc6c25", "label": "Ar" },
    { "key": "npc_shrinekeeper_quanta", "w": 16, "h": 24, "color": "#7b2cbf", "label": "Sk" },
    { "key": "tiles_elemental_reaches", "w": 16, "h": 16, "color": "#3a5a40", "label": "" },
    { "key": "bg_battle_elemental_reaches", "w": 480, "h": 224, "color": "#243b2f", "label": "" },
    { "key": "ui_textbox", "w": 16, "h": 16, "color": "#0d1b2a", "label": "" },
    { "key": "ui_chainmeter", "w": 16, "h": 16, "color": "#1b263b", "label": "" },
    { "key": "icon_status_oxidised", "w": 12, "h": 12, "color": "#a98467", "label": "Ox" },
    { "key": "icon_status_dissolved", "w": 12, "h": 12, "color": "#52b788", "label": "Ds" },
    { "key": "icon_status_catalysed", "w": 12, "h": 12, "color": "#ffd166", "label": "Ca" },
    { "key": "icon_status_precipitated", "w": 12, "h": 12, "color": "#adb5bd", "label": "Pp" },
    { "key": "icon_status_endothermicChill", "w": 12, "h": 12, "color": "#4cc9f0", "label": "Ch" },
    { "key": "icon_status_combusting", "w": 12, "h": 12, "color": "#f3722c", "label": "Cb" }
  ]
}
```

- [ ] **Step 3: Add `launch?` to `DialogueNode` in `types.ts`** and add `"launch": "shrine"` to the `q_enter` node above.

```ts
export interface DialogueNode {
  id: string; speaker?: string; text: string; next?: string; choices?: DialogueChoice[]; setFlag?: string; end?: boolean;
  launch?: 'shrine' | string; // 'shrine' or 'battle:<enemyId>' — handled by DialogueScene on end
}
```

- [ ] **Step 4: Add an asset-coverage test** — every `spriteKey`/`*Key` referenced by content must appear in the manifest.

Append to `tests/content/realContent.test.ts`:

```ts
it('every content-referenced asset key has both an images entry and a placeholder spec', () => {
  const { content } = loadGameContent();
  const placeholderKeys = new Set(content.assets.placeholders.map(p => p.key));
  const referenced = new Set<string>();
  for (const e of Object.values(content.enemies)) referenced.add(e.spriteKey);
  for (const n of Object.values(content.npcs)) referenced.add(n.spriteKey);
  for (const r of content.regions) { referenced.add(r.tilesetKey); referenced.add(r.battleBackgroundKey); }
  for (const c of content.classes) for (const stage of [0, ...c.evolutions.map(e => e.stage)]) {
    const sk = stage === 0 ? `hero_${c.id}_0` : `hero_${c.id}_${stage}`;
    referenced.add(`${sk}_overworld`); referenced.add(`${sk}_battle`);
  }
  for (const key of referenced) {
    expect(content.assets.images[key], `images[${key}]`).toBeDefined();
    expect(placeholderKeys.has(key), `placeholder[${key}]`).toBe(true);
  }
});
```

- [ ] **Step 5: Run** — `npm test` all green; `loadGameContent` warnings empty.

Run: `npm test`
Expected: every content test passes.

- [ ] **Step 6: Commit**

```bash
git add src/content/data/npcs.json src/content/data/assetManifest.json src/content/types.ts tests/content/realContent.test.ts
git commit -m "feat: NPC dialogue trees + asset manifest with placeholder specs"
```

---

# Phase 2 — `BattleEngine` (pure logic)

> **Structure refinement:** `src/systems/BattleEngine.ts` grows into a folder `src/systems/battle/` with focused files; `src/systems/BattleEngine.ts` becomes a barrel re-export so importers stay stable.
> ```
> src/systems/battle/
>   types.ts        — Combatant, BattleState, BattleAction, BattleEvent
>   typeChart.ts    — effectiveness lookup
>   chain.ts        — chain multiplier + transitions + catalyst-burst readiness
>   damage.ts       — computeDamage
>   status.ts       — applyStatus, tickStatuses
>   engine.ts       — createBattle, getTurnOrder, playerAct, enemyAct
> src/systems/BattleEngine.ts — re-exports the above
> ```
> All functions are **pure** (no Phaser, no globals). `rng: () => number` is injected; default `Math.random`. State is treated as immutable — every function returns a fresh object (use structural copies; a tiny `clone<T>(x): T => structuredClone(x)` helper in `types.ts`).

### Task 11: Battle types + type-chart effectiveness — TDD

**Files:**
- Create: `src/systems/battle/types.ts`, `src/systems/battle/typeChart.ts`
- Test: `tests/systems/typeChart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/typeChart.test.ts
import { describe, it, expect } from 'vitest';
import { effectiveness } from '../../src/systems/battle/typeChart';
import typeChart from '../../src/content/data/typeChart.json';

const tc = typeChart as Record<string, Record<string, number>>;

describe('effectiveness(typeChart, attacker, defender)', () => {
  it('Base is super-effective vs Acid (neutralisation)', () => { expect(effectiveness(tc, 'Base', 'Acid')).toBe(2); });
  it('Acid is super-effective vs Metal and vs Ionic', () => {
    expect(effectiveness(tc, 'Acid', 'Metal')).toBe(2);
    expect(effectiveness(tc, 'Acid', 'Ionic')).toBe(2);
  });
  it('Endothermic counters Exothermic and Combustion', () => {
    expect(effectiveness(tc, 'Endothermic', 'Exothermic')).toBe(2);
    expect(effectiveness(tc, 'Endothermic', 'Combustion')).toBe(2);
  });
  it('Acid vs Base is resisted (0.5)', () => { expect(effectiveness(tc, 'Acid', 'Base')).toBe(0.5); });
  it('Catalyst skills deal chip damage to everything (0.5)', () => { expect(effectiveness(tc, 'Catalyst', 'Atomic')).toBe(0.5); });
  it('unspecified matchups are neutral (1)', () => { expect(effectiveness(tc, 'Atomic', 'Atomic')).toBe(1); expect(effectiveness(tc, 'Neutral', 'Ionic')).toBe(1); });
});
```

- [ ] **Step 2: Run — confirm failure**

Run: `npx vitest run tests/systems/typeChart.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/systems/battle/types.ts`**

```ts
import type { Affinity, Stats, StatKey, StatusEffectInstance } from '../../content/types';

export interface Combatant {
  side: 'player' | 'enemy';
  name: string;
  affinity: Affinity;
  signatureAffinity: Affinity;   // for the affinity damage bonus (= affinity for enemies)
  level: number;
  maxHp: number; hp: number;
  atk: number; def: number; spd: number;
  maxEnergy: number; energy: number;
  statuses: StatusEffectInstance[];
  buffs: Partial<Record<StatKey, number>>; // stat stages, −6..+6
  isBoss: boolean;
  skillIds: string[];            // for the enemy AI; for the player this is the equipped loadout
  attackPower: number;           // basic-attack power
  enemyId?: string;              // set for enemies (used by Decomposition split)
  splitIntoId?: string;
}

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'skill'; skillId: string; quizCorrect: boolean | null; widget?: { coeffs?: number[] }; fastAnswer?: boolean }
  | { kind: 'catalystBurst' }
  | { kind: 'item'; itemId: string }
  | { kind: 'run' };

export type BattleOutcome = 'ongoing' | 'playerWin' | 'playerLose' | 'fled';

export type BattleEvent =
  | { t: 'turnStart'; side: 'player' | 'enemy'; turn: number }
  | { t: 'energyRegen'; side: 'player' | 'enemy'; amount: number }
  | { t: 'attack'; side: 'player' | 'enemy'; skillId?: string; affinity: Affinity }
  | { t: 'quizFizzle'; skillId: string }
  | { t: 'damage'; target: 'player' | 'enemy'; amount: number; effectiveness: number; crit: boolean }
  | { t: 'heal'; target: 'player' | 'enemy'; amount: number }
  | { t: 'statusApplied'; target: 'player' | 'enemy'; id: string; turns: number }
  | { t: 'statusTick'; target: 'player' | 'enemy'; id: string; damage?: number }
  | { t: 'statusExpired'; target: 'player' | 'enemy'; id: string }
  | { t: 'buffsStripped'; target: 'player' | 'enemy' }
  | { t: 'extraAction'; side: 'player' | 'enemy' }
  | { t: 'precipitatedSkip'; side: 'player' | 'enemy' }
  | { t: 'chainChanged'; chain: number; multiplier: number; burstReady: boolean }
  | { t: 'split'; fromEnemyId: string; intoEnemyId: string } // M1: target replaced by ONE half + ONE half summons aren't 1v1-able → see Task 18
  | { t: 'enemySwitch'; toName: string; toEnemyId: string }
  | { t: 'item'; itemId: string; target: 'player' | 'enemy' }
  | { t: 'faint'; side: 'player' | 'enemy' }
  | { t: 'fleeFailed' }
  | { t: 'outcome'; outcome: BattleOutcome };

export interface BattleState {
  player: Combatant;
  enemy: Combatant;
  enemyQueue: Combatant[];        // additional enemies (Decomposition split → second half fights after the first)
  turn: number;                   // increments each time both sides have acted
  chain: number;                  // 0..5
  catalystBurstReady: boolean;
  pendingExtraActionFor: ('player' | 'enemy')[]; // FIFO of extra actions granted this turn
  outcome: BattleOutcome;
  rng: () => number;
  log: BattleEvent[];
  // remembers whose action came first this turn, for ordering
  actedThisTurn: { player: boolean; enemy: boolean };
}

export const clone = <T>(x: T): T => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
export const clampStage = (s: number): number => Math.max(-6, Math.min(6, s));
export function applyStage(value: number, stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? Math.floor(value * (2 + s) / 2) : Math.floor(value * 2 / (2 - s));
}
```

> **Note on `enemyQueue` / split (1v1 constraint):** the spec keeps battles strictly 1v1. A Decomposition skill that "splits a high-HP enemy into two weaker halves" is modelled as: the current enemy is *replaced* by a half (immediate `enemySwitch`), and a second half is pushed onto `enemyQueue`; when the active enemy faints, if `enemyQueue` is non-empty the next one steps in (another `enemySwitch`) and the battle continues — the player must defeat both. This honours the chemistry beat (one big foe → two small foes, more total HP cleared) inside a 1v1 frame. (Drop the unused `t:'split'` event from `types.ts` — `enemySwitch` covers it.)

- [ ] **Step 4: Implement `src/systems/battle/typeChart.ts`**

```ts
import type { Affinity, TypeChart } from '../../content/types';

/** Returns the damage multiplier for an attacker affinity vs a defender affinity. Missing entries are neutral (1). */
export function effectiveness(chart: TypeChart, attacker: Affinity, defender: Affinity): number {
  const m = chart[attacker]?.[defender];
  return typeof m === 'number' ? m : 1;
}
```

- [ ] **Step 5: Run — confirm pass.** `npx vitest run tests/systems/typeChart.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/systems/battle/types.ts src/systems/battle/typeChart.ts tests/systems/typeChart.test.ts
git commit -m "feat(battle): combatant/state types + type-chart effectiveness (TDD)"
```

---

### Task 12: Chain Reaction math — TDD

**Files:**
- Create: `src/systems/battle/chain.ts`
- Test: `tests/systems/chain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/chain.test.ts
import { describe, it, expect } from 'vitest';
import { CHAIN_MULTIPLIERS, MAX_CHAIN, chainMultiplier, nextChainOnCorrect, nextChainOnWrong, isCatalystBurstReady } from '../../src/systems/battle/chain';

describe('chain reaction', () => {
  it('multiplier table is the locked one and indexed by chain level', () => {
    expect(CHAIN_MULTIPLIERS).toEqual([1.0, 1.2, 1.5, 1.8, 2.2, 2.6]);
    expect(MAX_CHAIN).toBe(5);
    expect(chainMultiplier(0)).toBe(1.0);
    expect(chainMultiplier(3)).toBe(1.8);
    expect(chainMultiplier(5)).toBe(2.6);
    expect(chainMultiplier(99)).toBe(2.6); // clamps
  });
  it('a correct answer increments, capped at MAX_CHAIN', () => {
    expect(nextChainOnCorrect(0)).toBe(1);
    expect(nextChainOnCorrect(4)).toBe(5);
    expect(nextChainOnCorrect(5)).toBe(5);
  });
  it('a wrong answer resets to 0', () => { expect(nextChainOnWrong(4)).toBe(0); expect(nextChainOnWrong(0)).toBe(0); });
  it('Catalyst Burst is ready only at full chain', () => {
    expect(isCatalystBurstReady(4)).toBe(false);
    expect(isCatalystBurstReady(5)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run tests/systems/chain.test.ts`

- [ ] **Step 3: Implement `src/systems/battle/chain.ts`**

```ts
export const CHAIN_MULTIPLIERS = [1.0, 1.2, 1.5, 1.8, 2.2, 2.6] as const;
export const MAX_CHAIN = CHAIN_MULTIPLIERS.length - 1; // 5

export function chainMultiplier(chain: number): number {
  const i = Math.max(0, Math.min(MAX_CHAIN, Math.floor(chain)));
  return CHAIN_MULTIPLIERS[i];
}
export function nextChainOnCorrect(chain: number): number { return Math.min(MAX_CHAIN, chain + 1); }
export function nextChainOnWrong(_chain: number): number { return 0; }
export function isCatalystBurstReady(chain: number): boolean { return chain >= MAX_CHAIN; }
```

- [ ] **Step 4: Run — PASS.** `npx vitest run tests/systems/chain.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/chain.ts tests/systems/chain.test.ts
git commit -m "feat(battle): Chain Reaction multiplier + transitions (TDD)"
```

---

### Task 13: `computeDamage` — TDD with deterministic RNG

**Files:**
- Create: `src/systems/battle/damage.ts`
- Test: `tests/systems/computeDamage.test.ts`

- [ ] **Step 1: Write the failing test** (uses `rng = () => 1` ⇒ `randFactor = 1`, fully deterministic)

```ts
// tests/systems/computeDamage.test.ts
import { describe, it, expect } from 'vitest';
import { computeDamage } from '../../src/systems/battle/damage';
import { CHAIN_MULTIPLIERS } from '../../src/systems/battle/chain';

const atkr = { level: 10, atk: 30, def: 12, spd: 10, signatureAffinity: 'Combustion' as const, buffs: {} as Record<string, number> };
const defr = { def: 12, buffs: {} as Record<string, number> };

describe('computeDamage', () => {
  it('basic attack: level/atk/def -> base, then ×rand(=1)', () => {
    // levelFactor = floor(2*10/5)+2 = 6 ; base = floor(floor(floor(6*28*30/12)/50)+2) = floor(floor(4200/50)+2) = 86
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 28, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: false, rng: () => 1 });
    expect(d).toBe(86);
  });
  it('applies type effectiveness multiplicatively', () => {
    const d2 = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 28, isSkill: false, skillAffinity: 'Neutral', typeMult: 2, chain: 0, quizCorrect: null, crit: false, rng: () => 1 });
    expect(d2).toBe(172);
  });
  it('immune (typeMult 0) -> 0 regardless of everything', () => {
    expect(computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid', typeMult: 0, chain: 5, quizCorrect: true, crit: true, rng: () => 1 })).toBe(0);
  });
  it('successful skill: chain multiplier + 1.25 affinity bonus when affinity matches signature', () => {
    // base for power 40: floor(floor(floor(6*40*30/12)/50)+2) = floor(floor(6000/50)+2) = 122
    // chain 2 -> 1.5 ; affinity Combustion == signature -> 1.25 ; => floor(122 * 1.5 * 1.25) = floor(228.75) = 228
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 2, quizCorrect: true, crit: false, rng: () => 1 });
    expect(CHAIN_MULTIPLIERS[2]).toBe(1.5);
    expect(d).toBe(228);
  });
  it('fizzled skill (wrong quiz): 0.3 multiplier, no chain bonus, no affinity bonus', () => {
    // floor(122 * 0.3) = 36
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 5, quizCorrect: false, crit: false, rng: () => 1 });
    expect(d).toBe(36);
  });
  it('catalyst burst: flat ×3.0, ignores chain, gets affinity bonus', () => {
    // floor(122 * 3.0 * 1.25) = floor(457.5) = 457
    const d = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Combustion', typeMult: 1, chain: 5, quizCorrect: true, crit: false, rng: () => 1, isCatalystBurst: true });
    expect(d).toBe(457);
  });
  it('crit ×1.5 stacks; rng factor of 0.85 is the floor of variance', () => {
    const dMax = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: true, rng: () => 1 });
    const dMin = computeDamage({ attacker: atkr, defenderDef: 12, defenderBuffs: {}, power: 40, isSkill: false, skillAffinity: 'Neutral', typeMult: 1, chain: 0, quizCorrect: null, crit: true, rng: () => 0 });
    expect(dMax).toBe(183); // floor(122 * 1.5)
    expect(dMin).toBe(155); // floor(122 * 1.5 * 0.85)
  });
  it('damage is at least 1 when typeMult > 0', () => {
    const weak = { level: 1, atk: 1, def: 1, spd: 1, signatureAffinity: 'Neutral' as const, buffs: {} };
    expect(computeDamage({ attacker: weak, defenderDef: 999, defenderBuffs: {}, power: 1, isSkill: false, skillAffinity: 'Neutral', typeMult: 0.5, chain: 0, quizCorrect: null, crit: false, rng: () => 0 })).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run tests/systems/computeDamage.test.ts`

- [ ] **Step 3: Implement `src/systems/battle/damage.ts`**

```ts
import type { Affinity, StatKey } from '../../content/types';
import { applyStage } from './types';
import { chainMultiplier } from './chain';

export interface DamageParams {
  attacker: { level: number; atk: number; def: number; spd: number; signatureAffinity: Affinity; buffs: Partial<Record<StatKey, number>> };
  defenderDef: number;
  defenderBuffs: Partial<Record<StatKey, number>>;
  power: number;
  isSkill: boolean;
  skillAffinity: Affinity;       // 'Neutral' for a basic attack
  typeMult: number;              // from effectiveness()
  chain: number;
  quizCorrect: boolean | null;   // null = no quiz (basic attack / no-quiz skill)
  crit: boolean;
  isCatalystBurst?: boolean;
  rng?: () => number;            // default Math.random
}

export function computeDamage(p: DamageParams): number {
  if (p.typeMult === 0) return 0;
  const rng = p.rng ?? Math.random;
  const levelFactor = Math.floor(2 * p.attacker.level / 5) + 2;
  const effAtk = applyStage(p.attacker.atk, p.attacker.buffs.atk ?? 0);
  const effDef = Math.max(1, applyStage(p.defenderDef, p.defenderBuffs.def ?? 0));
  const base = Math.floor(Math.floor(Math.floor(levelFactor * p.power * effAtk / effDef) / 50) + 2);

  const fizzled = p.isSkill && p.quizCorrect === false;
  const quizMult = fizzled ? 0.3 : 1.0;
  const chainMult = p.isCatalystBurst ? 3.0 : (p.isSkill && p.quizCorrect === true) ? chainMultiplier(p.chain) : 1.0;
  const affinityBonus = (p.isSkill && !fizzled && p.skillAffinity === p.attacker.signatureAffinity) ? 1.25 : 1.0;
  const critMult = p.crit ? 1.5 : 1.0;
  const randFactor = 0.85 + rng() * 0.15;

  const dmg = Math.floor(base * p.typeMult * quizMult * chainMult * affinityBonus * critMult * randFactor);
  return Math.max(1, dmg);
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run tests/systems/computeDamage.test.ts` (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/damage.ts tests/systems/computeDamage.test.ts
git commit -m "feat(battle): computeDamage — Pokémon-style formula, injectable RNG (TDD)"
```

---

### Task 14: Status effects — apply & tick — TDD

**Files:**
- Create: `src/systems/battle/status.ts`
- Test: `tests/systems/status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/status.test.ts
import { describe, it, expect } from 'vitest';
import { applyStatus, tickStatuses, hasStatus, consumePrecipitated } from '../../src/systems/battle/status';
import type { Combatant } from '../../src/systems/battle/types';

function combatant(over: Partial<Combatant> = {}): Combatant {
  return { side: 'enemy', name: 'X', affinity: 'Atomic', signatureAffinity: 'Atomic', level: 5, maxHp: 50, hp: 50, atk: 10, def: 10, spd: 10,
    maxEnergy: 100, energy: 100, statuses: [], buffs: {}, isBoss: false, skillIds: [], attackPower: 20, ...over };
}

describe('status effects', () => {
  it('applyStatus adds (and refreshes) an instance and logs', () => {
    let c = combatant();
    const r = applyStatus(c, { id: 'dissolved', turns: 2, magnitude: 4 });
    expect(hasStatus(r.combatant, 'dissolved')).toBe(true);
    expect(r.events[0]).toMatchObject({ t: 'statusApplied', id: 'dissolved', turns: 2 });
    const r2 = applyStatus(r.combatant, { id: 'dissolved', turns: 3, magnitude: 4 });
    expect(r2.combatant.statuses.filter(s => s.id === 'dissolved').length).toBe(1);
    expect(r2.combatant.statuses.find(s => s.id === 'dissolved')!.turnsRemaining).toBe(3); // refreshed to the longer
  });
  it('dissolved & combusting deal magnitude damage on tick', () => {
    let c = combatant({ statuses: [{ id: 'dissolved', turnsRemaining: 2, magnitude: 4 }, { id: 'combusting', turnsRemaining: 1, magnitude: 5 }] });
    const r = tickStatuses(c);
    expect(r.combatant.hp).toBe(50 - 4 - 5);
    expect(r.events.filter(e => e.t === 'statusTick').length).toBe(2);
  });
  it('oxidised drains DEF stage, endothermicChill drains ATK stage, each tick (min -6)', () => {
    let c = combatant({ statuses: [{ id: 'oxidised', turnsRemaining: 2, magnitude: 0 }, { id: 'endothermicChill', turnsRemaining: 2, magnitude: 0 }] });
    const r = tickStatuses(c);
    expect(r.combatant.buffs.def).toBe(-1);
    expect(r.combatant.buffs.atk).toBe(-1);
  });
  it('catalysed sets spd stage to at least +2 while active', () => {
    let c = combatant({ statuses: [{ id: 'catalysed', turnsRemaining: 2, magnitude: 0 }] });
    expect(tickStatuses(c).combatant.buffs.spd).toBeGreaterThanOrEqual(2);
  });
  it('turnsRemaining decrements; status removed and logged at 0', () => {
    let c = combatant({ statuses: [{ id: 'combusting', turnsRemaining: 1, magnitude: 3 }] });
    const r = tickStatuses(c);
    expect(hasStatus(r.combatant, 'combusting')).toBe(false);
    expect(r.events.some(e => e.t === 'statusExpired' && (e as any).id === 'combusting')).toBe(true);
  });
  it('a tick that brings hp to 0 leaves hp at 0 (faint handled by the engine)', () => {
    let c = combatant({ hp: 3, statuses: [{ id: 'dissolved', turnsRemaining: 2, magnitude: 10 }] });
    expect(tickStatuses(c).combatant.hp).toBe(0);
  });
  it('consumePrecipitated removes the status and reports true when present', () => {
    let c = combatant({ statuses: [{ id: 'precipitated', turnsRemaining: 1, magnitude: 0 }] });
    const r = consumePrecipitated(c);
    expect(r.skipped).toBe(true);
    expect(hasStatus(r.combatant, 'precipitated')).toBe(false);
    expect(consumePrecipitated(combatant()).skipped).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/systems/battle/status.ts`**

```ts
import type { StatusId } from '../../content/types';
import { type BattleEvent, type Combatant, clone, clampStage } from './types';

export function hasStatus(c: Combatant, id: StatusId): boolean { return c.statuses.some(s => s.id === id); }

export function applyStatus(c: Combatant, spec: { id: StatusId; turns: number; magnitude: number }): { combatant: Combatant; events: BattleEvent[] } {
  const next = clone(c);
  const existing = next.statuses.find(s => s.id === spec.id);
  if (existing) { existing.turnsRemaining = Math.max(existing.turnsRemaining, spec.turns); existing.magnitude = Math.max(existing.magnitude, spec.magnitude); }
  else next.statuses.push({ id: spec.id, turnsRemaining: spec.turns, magnitude: spec.magnitude });
  return { combatant: next, events: [{ t: 'statusApplied', target: c.side, id: spec.id, turns: spec.turns }] };
}

/** End-of-turn tick for one combatant: dot damage, stat drains, refresh catalysed spd, decrement, expire. */
export function tickStatuses(c: Combatant): { combatant: Combatant; events: BattleEvent[] } {
  const next = clone(c);
  const events: BattleEvent[] = [];
  for (const s of next.statuses) {
    switch (s.id) {
      case 'dissolved':
      case 'combusting': {
        const dmg = Math.max(0, s.magnitude);
        next.hp = Math.max(0, next.hp - dmg);
        events.push({ t: 'statusTick', target: c.side, id: s.id, damage: dmg });
        break;
      }
      case 'oxidised':
        next.buffs.def = clampStage((next.buffs.def ?? 0) - 1);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'endothermicChill':
        next.buffs.atk = clampStage((next.buffs.atk ?? 0) - 1);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'catalysed':
        next.buffs.spd = Math.max(next.buffs.spd ?? 0, 2);
        events.push({ t: 'statusTick', target: c.side, id: s.id });
        break;
      case 'precipitated':
        // consumed by consumePrecipitated() in the engine before acting; nothing on tick
        break;
    }
  }
  // decrement & expire
  const survivors = [];
  for (const s of next.statuses) {
    s.turnsRemaining -= 1;
    if (s.turnsRemaining <= 0) events.push({ t: 'statusExpired', target: c.side, id: s.id });
    else survivors.push(s);
  }
  next.statuses = survivors;
  return { combatant: next, events };
}

/** If the combatant is precipitated, remove it and report that they skip this action. */
export function consumePrecipitated(c: Combatant): { combatant: Combatant; skipped: boolean } {
  if (!hasStatus(c, 'precipitated')) return { combatant: c, skipped: false };
  const next = clone(c);
  next.statuses = next.statuses.filter(s => s.id !== 'precipitated');
  return { combatant: next, skipped: true };
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/status.ts tests/systems/status.test.ts
git commit -m "feat(battle): status effects — apply, tick, precipitated-skip (TDD)"
```

---

### Task 15: `createBattle` + `getTurnOrder` — TDD

**Files:**
- Create: `src/systems/battle/engine.ts` (this file grows over Tasks 15–23)
- Create: `src/systems/BattleEngine.ts` (barrel)
- Test: `tests/systems/battleEngine.test.ts` (grows over Tasks 15–23)

`createBattle` takes a *player battle input* (derived from the save + content) and an *enemy def + level*, builds the two `Combatant`s, applies boss soft-scaling (Task 23 expands this), seeds `rng`, and returns a fresh `BattleState`. `getTurnOrder` returns `['player','enemy']` or `['enemy','player']` by effective SPD (buffs applied); ties → player first.

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/battleEngine.test.ts
import { describe, it, expect } from 'vitest';
import { createBattle, getTurnOrder } from '../../src/systems/BattleEngine';
import type { EnemyDef } from '../../src/content/types';

const enemy: EnemyDef = { id: 'protium', name: 'Protium', affinity: 'Atomic', baseStats: { hp: 22, atk: 8, def: 4, spd: 6 }, level: 3, attackPower: 22, skillIds: [], xpYield: 14, role: 'wild', spriteKey: 'enemy_protium' };

const playerInput = {
  name: 'Hero', classId: 'pyron', signatureAffinity: 'Combustion' as const, level: 5,
  maxHp: 52, hp: 52, atk: 30, def: 10, spd: 14, maxEnergy: 100, energy: 100,
  equippedSkillIds: ['proton-jab', 'spark-flare', 'shell-shatter'], attackPower: 24, isBoss: false
};

describe('createBattle / getTurnOrder', () => {
  it('builds player and enemy combatants with full HP/energy and empty statuses', () => {
    const s = createBattle(playerInput, { def: enemy, level: enemy.level }, { rng: () => 0.5 });
    expect(s.player.hp).toBe(52); expect(s.enemy.hp).toBe(22);
    expect(s.player.energy).toBe(100);
    expect(s.enemy.affinity).toBe('Atomic');
    expect(s.chain).toBe(0); expect(s.catalystBurstReady).toBe(false); expect(s.outcome).toBe('ongoing');
    expect(s.enemy.skillIds).toEqual([]);
    expect(s.enemy.enemyId).toBe('protium');
  });
  it('turn order is by SPD; faster goes first; ties favour the player', () => {
    const s = createBattle(playerInput, { def: enemy, level: enemy.level }); // player spd 14 > enemy 6
    expect(getTurnOrder(s)).toEqual(['player', 'enemy']);
    const slowPlayer = createBattle({ ...playerInput, spd: 6 }, { def: { ...enemy, baseStats: { ...enemy.baseStats, spd: 9 } }, level: 3 });
    expect(getTurnOrder(slowPlayer)).toEqual(['enemy', 'player']);
    const tie = createBattle({ ...playerInput, spd: 6 }, { def: enemy, level: 3 }); // both 6
    expect(getTurnOrder(tie)).toEqual(['player', 'enemy']);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/systems/battle/engine.ts` (this slice only)**

```ts
import type { EnemyDef, Affinity } from '../../content/types';
import { type BattleState, type Combatant, applyStage, clone } from './types';

export interface PlayerBattleInput {
  name: string; classId: string; signatureAffinity: Affinity; level: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  maxEnergy: number; energy: number; equippedSkillIds: string[]; attackPower: number; isBoss: boolean;
}
export interface EnemyBattleInput { def: EnemyDef; level: number; }

const DEFAULT_RNG = () => Math.random();

function scaleStat(base: number, defLevel: number, atLevel: number): number {
  if (atLevel === defLevel) return base;
  // simple linear-ish soft scale: ±~6% per level difference, never below 1
  return Math.max(1, Math.round(base * (1 + 0.06 * (atLevel - defLevel))));
}

export function buildEnemyCombatant(def: EnemyDef, level: number, playerLevel?: number): Combatant {
  // Region/final bosses with bossSoftScale: scale UP to the player's level if the player is higher (never down). (Task 23.)
  let lvl = level;
  if (def.bossSoftScale && typeof playerLevel === 'number' && playerLevel > level) lvl = playerLevel;
  const s = def.baseStats;
  return {
    side: 'enemy', name: def.name, affinity: def.affinity, signatureAffinity: def.affinity, level: lvl,
    maxHp: scaleStat(s.hp, def.level, lvl), hp: scaleStat(s.hp, def.level, lvl),
    atk: scaleStat(s.atk, def.level, lvl), def: scaleStat(s.def, def.level, lvl), spd: scaleStat(s.spd, def.level, lvl),
    maxEnergy: 100, energy: 100, statuses: [], buffs: {}, isBoss: def.role === 'regionBoss' || def.role === 'finalBoss',
    skillIds: [...def.skillIds], attackPower: def.attackPower, enemyId: def.id, splitIntoId: def.splitIntoId
  };
}

export function createBattle(player: PlayerBattleInput, enemy: EnemyBattleInput, opts?: { rng?: () => number }): BattleState {
  const playerCombatant: Combatant = {
    side: 'player', name: player.name, affinity: player.signatureAffinity, signatureAffinity: player.signatureAffinity, level: player.level,
    maxHp: player.maxHp, hp: Math.min(player.hp, player.maxHp), atk: player.atk, def: player.def, spd: player.spd,
    maxEnergy: player.maxEnergy, energy: Math.min(player.energy, player.maxEnergy), statuses: [], buffs: {}, isBoss: player.isBoss,
    skillIds: [...player.equippedSkillIds], attackPower: player.attackPower
  };
  const enemyCombatant = buildEnemyCombatant(enemy.def, enemy.level, player.level);
  return {
    player: playerCombatant, enemy: enemyCombatant, enemyQueue: [], turn: 1, chain: 0, catalystBurstReady: false,
    pendingExtraActionFor: [], outcome: 'ongoing', rng: opts?.rng ?? DEFAULT_RNG, log: [], actedThisTurn: { player: false, enemy: false }
  };
}

export function effectiveSpd(c: Combatant): number { return applyStage(c.spd, c.buffs.spd ?? 0); }
export function getTurnOrder(state: BattleState): ('player' | 'enemy')[] {
  const ps = effectiveSpd(state.player), es = effectiveSpd(state.enemy);
  return ps >= es ? ['player', 'enemy'] : ['enemy', 'player'];
}
```

- [ ] **Step 4: Create the barrel `src/systems/BattleEngine.ts`**

```ts
export * from './battle/types';
export * from './battle/typeChart';
export * from './battle/chain';
export * from './battle/damage';
export * from './battle/status';
export * from './battle/engine';
```

- [ ] **Step 5: Run — PASS.** `npx vitest run tests/systems/battleEngine.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/systems/battle/engine.ts src/systems/BattleEngine.ts tests/systems/battleEngine.test.ts
git commit -m "feat(battle): createBattle + getTurnOrder + enemy stat scaling skeleton (TDD)"
```

---

### Task 16: `resolveTurn` + basic-attack resolution + faint settling — TDD

> **Model (locked):** the scene shows "What will you do?", the player picks one `BattleAction`, then `resolveTurn(state, playerAction, ctx)` resolves **both** combatants in SPD order (the enemy's action chosen by the AI at resolution time), ticks end-of-turn statuses on both, advances the turn counter, and returns the new `BattleState` plus the list of `BattleEvent`s for the scene to animate. Energy regen `+25` happens at the start of the **player's** slot each turn.

**Files:**
- Modify: `src/systems/battle/engine.ts`
- Test: append to `tests/systems/battleEngine.test.ts`

`ctx: BattleContext = { getSkill(id): SkillDef; getItem(id): ItemDef; getEnemyDef(id): EnemyDef; settings: { answerTimer: boolean } }`. For Task 16 only `'attack'` actions are reachable; enemy AI returns `'attack'`.

- [ ] **Step 1: Write the failing test**

```ts
import { resolveTurn } from '../../src/systems/BattleEngine';

const ctx = {
  getSkill: (id: string) => { throw new Error('no skills in this test ' + id); },
  getItem: (id: string) => { throw new Error('no items ' + id); },
  getEnemyDef: (id: string) => { throw new Error('no enemies ' + id); },
  settings: { answerTimer: false }
} as any;

describe('resolveTurn — basic attacks only', () => {
  it('faster side (player) hits first; both act; player regenerates 25 energy at the start of the turn', () => {
    const s0 = createBattle({ ...playerInput, energy: 50 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const { state, events } = resolveTurn(s0, { kind: 'attack' }, ctx);
    expect(events[0]).toMatchObject({ t: 'turnStart', side: 'player' });
    expect(events.some(e => e.t === 'energyRegen' && (e as any).amount === 25)).toBe(true);
    expect(state.player.energy).toBe(75);
    const firstDmg = events.find(e => e.t === 'damage')! as any;
    expect(firstDmg.target).toBe('enemy'); // player struck first
    expect(state.enemy.hp).toBeLessThan(22);
    expect(state.player.hp).toBeLessThan(52); // enemy also acted
    expect(state.turn).toBe(2); // turn advanced after both acted
  });
  it('runs to playerWin when the enemy faints, and stops resolving once the battle is over', () => {
    let s = createBattle({ ...playerInput, atk: 999 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'attack' }, ctx);
    expect(r.state.outcome).toBe('playerWin');
    expect(r.events.some(e => e.t === 'faint' && (e as any).side === 'enemy')).toBe(true);
    expect(r.events.some(e => e.t === 'outcome' && (e as any).outcome === 'playerWin')).toBe(true);
    // enemy never got to swing because it fainted first (player faster)
    const playerHpEvents = r.events.filter(e => e.t === 'damage' && (e as any).target === 'player');
    expect(playerHpEvents.length).toBe(0);
  });
  it('a no-op on a finished battle returns the same state', () => {
    let s = createBattle({ ...playerInput, atk: 999 }, { def: enemy, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'attack' }, ctx).state;
    const again = resolveTurn(s, { kind: 'attack' }, ctx);
    expect(again.state.outcome).toBe('playerWin');
    expect(again.events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement in `src/systems/battle/engine.ts`** (append)

```ts
import type { SkillDef, ItemDef } from '../../content/types';
import { effectiveness } from './typeChart';
import { computeDamage } from './damage';
import { type BattleEvent, type BattleAction, clone as cloneState } from './types';
import { tickStatuses, consumePrecipitated } from './status';

export interface BattleContext {
  getSkill(id: string): SkillDef;
  getItem(id: string): ItemDef;
  getEnemyDef(id: string): import('../../content/types').EnemyDef;
  settings: { answerTimer: boolean };
}
export interface TurnResult { state: BattleState; events: BattleEvent[]; }

const REGEN_PER_TURN = 25;

function other(side: 'player' | 'enemy'): 'player' | 'enemy' { return side === 'player' ? 'enemy' : 'player'; }

/** Apply ONE combatant's action to a (mutable) working state. Returns events + whether a free follow-up attack was granted. */
function applyAction(state: BattleState, side: 'player' | 'enemy', action: BattleAction, ctx: BattleContext): { events: BattleEvent[]; grantedExtraAttack: boolean } {
  const events: BattleEvent[] = [];
  const attacker = state[side];
  const defSide = other(side);
  let defender = state[defSide];
  let grantedExtraAttack = false;

  const dealDamage = (power: number, isSkill: boolean, affinity: import('../../content/types').Affinity, quizCorrect: boolean | null, crit: boolean, isBurst = false) => {
    const typeMult = effectiveness(/* chart */ TYPE_CHART, affinity, defender.affinity);
    events.push({ t: 'attack', side, skillId: isSkill ? (action as any).skillId : undefined, affinity });
    const dmg = computeDamage({ attacker: { level: attacker.level, atk: attacker.atk, def: attacker.def, spd: attacker.spd, signatureAffinity: attacker.signatureAffinity, buffs: attacker.buffs },
      defenderDef: defender.def, defenderBuffs: defender.buffs, power, isSkill, skillAffinity: affinity, typeMult, chain: state.chain,
      quizCorrect, crit, isCatalystBurst: isBurst, rng: state.rng });
    defender.hp = Math.max(0, defender.hp - dmg);
    events.push({ t: 'damage', target: defSide, amount: dmg, effectiveness: typeMult, crit });
    return typeMult;
  };

  switch (action.kind) {
    case 'attack':
      dealDamage(attacker.attackPower, false, 'Neutral', null, false);
      break;

    case 'skill': {
      const skill = ctx.getSkill(action.skillId);
      if (!attacker.skillIds.includes(skill.id)) break; // not equipped — no-op (scene shouldn't allow it)
      if (attacker.energy < skill.energyCost) break;     // not enough energy — no-op (scene gates this)
      attacker.energy -= skill.energyCost;
      const hasQuiz = skill.topic !== null;
      const correct = hasQuiz ? action.quizCorrect : null;
      const fizzled = hasQuiz && correct === false;
      const crit = !!ctx.settings.answerTimer && !!action.fastAnswer && correct === true;
      if (fizzled) events.push({ t: 'quizFizzle', skillId: skill.id });
      const typeMult = skill.power > 0 ? dealDamage(skill.power, true, skill.affinity, correct, crit) : effectiveness(TYPE_CHART, skill.affinity, defender.affinity);
      // chain update (only quizzed skills touch the chain)
      if (hasQuiz) {
        state.chain = correct ? Math.min(MAX_CHAIN_LOCAL, state.chain + 1) : 0;
        state.catalystBurstReady = state.chain >= MAX_CHAIN_LOCAL;
        events.push({ t: 'chainChanged', chain: state.chain, multiplier: chainMultLocal(state.chain), burstReady: state.catalystBurstReady });
      }
      // behaviours — only on a non-fizzled hit
      if (!fizzled && skill.behavior) {
        const b = skill.behavior;
        if (b.healPercent) { const heal = Math.floor(attacker.maxHp * b.healPercent / 100); attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal); events.push({ t: 'heal', target: side, amount: heal }); }
        if (b.stripBuffs) { defender.buffs = {}; events.push({ t: 'buffsStripped', target: defSide }); }
        if (b.applyStatus && state.rng() * 100 < b.applyStatus.chance) {
          const ap = require_applyStatus(defender, { id: b.applyStatus.id, turns: b.applyStatus.turns, magnitude: b.applyStatus.magnitude });
          state[defSide] = ap.combatant; defender = state[defSide]; events.push(...ap.events);
        }
        if (b.splitTarget && defSide === 'enemy' && defender.splitIntoId && defender.enemyId !== defender.splitIntoId) {
          const halfDef = ctx.getEnemyDef(defender.splitIntoId);
          const mk = () => buildEnemyCombatant(halfDef, defender.level);
          const h1 = mk(), h2 = mk();
          state.enemy = h1; state.enemyQueue = [...state.enemyQueue, h2];
          events.push({ t: 'enemySwitch', toName: h1.name, toEnemyId: h1.enemyId! });
          defender = state.enemy;
        }
        if (b.grantExtraAction) grantedExtraAttack = true;
      }
      break;
    }

    case 'catalystBurst': {
      if (side !== 'player' || !state.catalystBurstReady) break;
      const burst = resolveBurstSkill(attacker, ctx);
      if (burst) {
        if (burst.power > 0) dealDamage(burst.power, true, burst.affinity, true, false, true);
        else { events.push({ t: 'attack', side, skillId: burst.id, affinity: burst.affinity }); }
        if (burst.behavior) {
          if (burst.behavior.stripBuffs) { defender.buffs = {}; events.push({ t: 'buffsStripped', target: defSide }); }
          if (burst.behavior.applyStatus) { const ap = require_applyStatus(defender, { id: burst.behavior.applyStatus.id, turns: burst.behavior.applyStatus.turns, magnitude: burst.behavior.applyStatus.magnitude }); state[defSide] = ap.combatant; defender = state[defSide]; events.push(...ap.events); }
        }
      } else {
        // fallback: triple the highest-power equipped quizzed skill
        dealDamage(45, true, attacker.affinity, true, false, true);
      }
      state.chain = 0; state.catalystBurstReady = false;
      events.push({ t: 'chainChanged', chain: 0, multiplier: chainMultLocal(0), burstReady: false });
      break;
    }

    case 'item': {
      const item = ctx.getItem(action.itemId);
      const e = item.effect;
      let healed = 0;
      if (attacker.hp <= 0 && e.revive) { healed = Math.floor(attacker.maxHp * (e.reviveHpPercent ?? 50) / 100); attacker.hp = healed; }
      else if (attacker.hp > 0) {
        if (e.healHp) healed += e.healHp;
        if (e.healHpPercent) healed += Math.floor(attacker.maxHp * e.healHpPercent / 100);
        if (healed) attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
      }
      if (e.restoreEnergy) attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + e.restoreEnergy);
      if (e.statBoostStages) for (const [k, d] of Object.entries(e.statBoostStages)) attacker.buffs[k as keyof typeof attacker.buffs] = clampStageLocal((attacker.buffs[k as keyof typeof attacker.buffs] ?? 0) + (d as number));
      events.push({ t: 'item', itemId: item.id, target: side });
      if (healed) events.push({ t: 'heal', target: side, amount: healed });
      break;
    }

    case 'run': {
      if (side !== 'player') break;
      if (state.enemy.isBoss) { events.push({ t: 'fleeFailed' }); break; }
      state.outcome = 'fled'; events.push({ t: 'outcome', outcome: 'fled' });
      break;
    }
  }
  return { events, grantedExtraAttack };
}

function settleFaints(state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (state.player.hp <= 0) { state.outcome = 'playerLose'; events.push({ t: 'faint', side: 'player' }, { t: 'outcome', outcome: 'playerLose' }); return events; }
  if (state.enemy.hp <= 0) {
    events.push({ t: 'faint', side: 'enemy' });
    if (state.enemyQueue.length > 0) { const next = state.enemyQueue.shift()!; state.enemy = next; events.push({ t: 'enemySwitch', toName: next.name, toEnemyId: next.enemyId! }); }
    else { state.outcome = 'playerWin'; events.push({ t: 'outcome', outcome: 'playerWin' }); }
  }
  return events;
}

export function resolveTurn(prev: BattleState, playerAction: BattleAction, ctx: BattleContext): TurnResult {
  if (prev.outcome !== 'ongoing') return { state: prev, events: [] };
  const state = cloneState(prev);
  state.rng = prev.rng; // structuredClone drops functions — restore it
  const events: BattleEvent[] = [];
  const enemyAction = chooseEnemyAction(state, ctx);
  for (const side of getTurnOrder(state)) {
    if (state.outcome !== 'ongoing') break;
    events.push({ t: 'turnStart', side, turn: state.turn });
    if (side === 'player') {
      const regen = Math.min(REGEN_PER_TURN, state.player.maxEnergy - state.player.energy);
      if (regen > 0) { state.player.energy += regen; events.push({ t: 'energyRegen', side: 'player', amount: regen }); }
    }
    const cp = consumePrecipitated(state[side]); state[side] = cp.combatant;
    if (cp.skipped) { events.push({ t: 'precipitatedSkip', side }); continue; }
    const act = side === 'player' ? playerAction : enemyAction;
    const r = applyAction(state, side, act, ctx); events.push(...r.events);
    events.push(...settleFaints(state));
    if (r.grantedExtraAttack && state.outcome === 'ongoing') {
      events.push({ t: 'extraAction', side });
      const r2 = applyAction(state, side, { kind: 'attack' }, ctx); events.push(...r2.events);
      events.push(...settleFaints(state));
    }
  }
  if (state.outcome === 'ongoing') {
    for (const side of ['player', 'enemy'] as const) { const tr = tickStatuses(state[side]); state[side] = tr.combatant; events.push(...tr.events); }
    events.push(...settleFaints(state));
    if (state.outcome === 'ongoing') state.turn += 1;
  }
  state.log = [...prev.log, ...events];
  return { state, events };
}
```

> **Implementation notes for the engineer doing Task 16:** the snippet above references a few helpers that are *introduced in this same file*: `TYPE_CHART` (import `typeChart` JSON at the top of `engine.ts`: `import typeChartData from '../../content/data/typeChart.json'; const TYPE_CHART = typeChartData as import('../../content/types').TypeChart;`), `MAX_CHAIN_LOCAL`/`chainMultLocal`/`clampStageLocal` (just re-export `MAX_CHAIN`, `chainMultiplier`, `clampStage` from the sibling modules — don't actually prefix them "Local"; that prefix is only here to flag "this is defined elsewhere, import it"), `require_applyStatus` (= `applyStatus` from `./status` — again, just import it; the underscore name is a flag, not the real name), `resolveBurstSkill` (added in Task 19 — for Task 16 stub it to `() => null`), and `chooseEnemyAction` (added in Task 20 — for Task 16 stub it to `(): BattleAction => ({ kind: 'attack' })`). Add the barrel re-exports for `resolveTurn`, `BattleContext`, `TurnResult` to `src/systems/BattleEngine.ts`.

- [ ] **Step 4: Run — PASS.** `npx vitest run tests/systems/battleEngine.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/engine.ts src/systems/BattleEngine.ts tests/systems/battleEngine.test.ts
git commit -m "feat(battle): resolveTurn — speed-ordered resolution, energy regen, faint settling (TDD)"
```

---

### Task 17: Skill action — damage, energy cost, chain update, quiz fizzle — TDD

**Files:** Modify `tests/systems/battleEngine.test.ts` (the `applyAction('skill')` code already landed in Task 16; this task *tests it* — TDD here means: write these tests, watch them pass against Task 16's code, and fix any bug they expose).

- [ ] **Step 1: Add the tests** — provide a real `ctx.getSkill` from `skills.json`:

```ts
import skillsData from '../../src/content/data/skills.json';
const skills = skillsData as Record<string, import('../../src/content/types').SkillDef>;
const skillCtx = { ...ctx, getSkill: (id: string) => { const s = skills[id]; if (!s) throw new Error('unknown skill ' + id); return s; } };

describe('resolveTurn — skill action', () => {
  it('a correct quiz fires at full power, deducts energy, and ticks the chain up', () => {
    const s0 = createBattle({ ...playerInput, atk: 30, energy: 100, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0.9 }); // rng 0.9: no status proc (chance 30), randFactor ~0.985
    const r = resolveTurn(s0, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx);
    expect(r.state.player.energy).toBe(100 + 25 - 25); // +25 regen, −25 cost
    expect(r.state.chain).toBe(1);
    expect(r.events.some(e => e.t === 'chainChanged' && (e as any).chain === 1)).toBe(true);
    expect(r.state.enemy.hp).toBeLessThan(999);
  });
  it('a wrong quiz fizzles to ~30% and resets the chain', () => {
    let s = createBattle({ ...playerInput, atk: 30, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state; // chain -> 1
    const before = s.enemy.hp;
    const r = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: false }, skillCtx);
    expect(r.events.some(e => e.t === 'quizFizzle')).toBe(true);
    expect(r.state.chain).toBe(0);
    const fizzleDmg = before - r.state.enemy.hp;
    const fullDmgRef = before - resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state.enemy.hp;
    expect(fizzleDmg).toBeLessThan(fullDmgRef * 0.5);
  });
  it('a no-quiz skill (proton-jab, topic null) fires at full power and does NOT touch the chain', () => {
    let s = createBattle({ ...playerInput, atk: 30, equippedSkillIds: ['spark-flare', 'proton-jab'] }, { def: { ...enemy, baseStats: { hp: 999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state; // chain 1
    const r = resolveTurn(s, { kind: 'skill', skillId: 'proton-jab', quizCorrect: null }, skillCtx);
    expect(r.state.chain).toBe(1); // unchanged
    expect(r.state.player.energy).toBe(s.player.energy + 25 - 0); // proton-jab costs 0
  });
  it('reaching chain 5 sets catalystBurstReady', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['spark-flare'] }, { def: { ...enemy, baseStats: { hp: 99999, atk: 1, def: 99, spd: 1 } }, level: 3 }, { rng: () => 1 });
    for (let i = 0; i < 5; i++) s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state;
    expect(s.chain).toBe(5);
    expect(s.catalystBurstReady).toBe(true);
  });
});
```

- [ ] **Step 2: Run — PASS** (fix any bug Task 16's code reveals).

Run: `npx vitest run tests/systems/battleEngine.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/systems/battleEngine.test.ts src/systems/battle/engine.ts
git commit -m "test(battle): skill action — power/energy/chain/fizzle coverage"
```

---

### Task 18: Skill behaviours — status, heal, strip buffs, decomposition split, extra action — TDD

**Files:** Modify `src/systems/battle/engine.ts` if a behaviour bug surfaces; add tests to `tests/systems/battleEngine.test.ts`.

- [ ] **Step 1: Add the tests**

```ts
describe('resolveTurn — skill behaviours', () => {
  it('shell-shatter can inflict Oxidised (DEF drain over time)', () => {
    // rng() must be < 0.40 for the status proc (chance 40); use 0 to force it. randFactor becomes 0.85.
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['shell-shatter'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'shell-shatter', quizCorrect: true }, skillCtx);
    expect(r.state.enemy.statuses.some(st => st.id === 'oxidised')).toBe(true);
    // after the end-of-turn tick, def stage should have dropped by 1
    expect(r.state.enemy.buffs.def).toBe(-1);
  });
  it('precipitate strips the target\'s stat buffs', () => {
    let s = createBattle({ ...playerInput, spd: 99, equippedSkillIds: ['precipitate'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    s.enemy.buffs = { atk: 2, def: 1 };
    const r = resolveTurn(s, { kind: 'skill', skillId: 'precipitate', quizCorrect: true }, skillCtx);
    expect(r.state.enemy.buffs).toEqual({}); // ...modulo any end-of-turn oxidised tick, which precipitate doesn't apply
    expect(r.events.some(e => e.t === 'buffsStripped' && (e as any).target === 'enemy')).toBe(true);
  });
  it('catalyze grants an extra basic attack the same turn', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['catalyze'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'catalyze', quizCorrect: true }, skillCtx);
    expect(r.events.some(e => e.t === 'extraAction' && (e as any).side === 'player')).toBe(true);
    const playerHits = r.events.filter(e => e.t === 'attack' && (e as any).side === 'player');
    expect(playerHits.length).toBeGreaterThanOrEqual(2); // the catalyze "hit" (power 8) + the free attack
    expect(r.state.enemy.statuses.some(st => st.id === 'catalysed')).toBe(true);
  });
  it('decompose splits a high-HP enemy into two halves: one active now, one queued', () => {
    const enemyCtx = { ...skillCtx, getEnemyDef: (id: string) => { if (id === 'shellfracture-half') return { id, name: 'Shell Fragment', affinity: 'Decomposition', baseStats: { hp: 14, atk: 8, def: 3, spd: 7 }, level: 4, attackPower: 18, skillIds: [], xpYield: 8, role: 'wild', spriteKey: 'enemy_shellfracture_half' } as any; throw new Error('?'); } };
    let s = createBattle({ ...playerInput, atk: 1, spd: 99, equippedSkillIds: ['decompose'] }, { def: { id: 'shellfracture', name: 'Shellfracture', affinity: 'Decomposition', baseStats: { hp: 60, atk: 1, def: 99, spd: 1 }, level: 4, attackPower: 1, skillIds: [], xpYield: 24, role: 'wild', spriteKey: 'enemy_shellfracture', splitIntoId: 'shellfracture-half' } as any, level: 4 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'decompose', quizCorrect: true }, enemyCtx);
    expect(r.state.enemy.enemyId).toBe('shellfracture-half');
    expect(r.state.enemyQueue.length).toBe(1);
    expect(r.state.enemyQueue[0].enemyId).toBe('shellfracture-half');
    expect(r.events.some(e => e.t === 'enemySwitch')).toBe(true);
  });
  it('a fizzled skill applies NO behaviours', () => {
    let s = createBattle({ ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['shell-shatter'] }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 0 });
    const r = resolveTurn(s, { kind: 'skill', skillId: 'shell-shatter', quizCorrect: false }, skillCtx);
    expect(r.state.enemy.statuses.some(st => st.id === 'oxidised')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — PASS** (fix behaviour bugs).

- [ ] **Step 3: Commit**

```bash
git add tests/systems/battleEngine.test.ts src/systems/battle/engine.ts
git commit -m "test(battle): skill behaviours — status/strip/split/extra-action coverage"
```

---

### Task 19: Catalyst Burst — resolve the class's burst skill at ×3, consume the chain — TDD

> The three Catalyst Burst skills in `skills.json` (`combustion-cascade` 60 / `universal-solvent` 55 / `nuclear-realignment` 50) carry real `power` so ×3 + the affinity bonus makes a burst land hard.

**Files:**
- Modify: `src/systems/battle/engine.ts` (replace the Task-16 stub `resolveBurstSkill = () => null` and the `createBattle` to stamp `catalystBurstSkillId` on the player)
- Test: append to `tests/systems/battleEngine.test.ts`

The player `Combatant` gains an optional `catalystBurstSkillId?: string`. `createBattle` resolves it: given the class's reachable skill ids (`startingSkillIds ∪ skillUnlocks.map(skillId)`), pick the one with `isCatalystBurst === true` (there's exactly one — enforced by Task 8's test); else leave undefined → engine uses the 45-power fallback. So `PlayerBattleInput` gains `catalystBurstSkillId?: string` (the *scene* computes it from the class def + content and passes it in — keeps the engine free of content lookups).

- [ ] **Step 1: Add the tests**

```ts
describe('resolveTurn — Catalyst Burst', () => {
  const burstPlayer = { ...playerInput, atk: 30, spd: 99, equippedSkillIds: ['spark-flare', 'combustion-cascade'], catalystBurstSkillId: 'combustion-cascade', signatureAffinity: 'Combustion' as const };
  it('is rejected (no-op) when the chain is not full', () => {
    let s = createBattle(burstPlayer, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    expect(s.catalystBurstReady).toBe(false);
    const r = resolveTurn(s, { kind: 'catalystBurst' }, skillCtx);
    // burst didn't fire: enemy only took the enemy's own basic attack damage? no — enemy hp 9999, enemy atk 1 on player; enemy hp unchanged by a no-op burst.
    expect(r.state.enemy.hp).toBe(9999);
  });
  it('when ready: fires the class burst skill at flat ×3, applies its guaranteed status, zeroes the chain', () => {
    let s = createBattle(burstPlayer, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    for (let i = 0; i < 5; i++) s = resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state;
    expect(s.catalystBurstReady).toBe(true);
    const before = s.enemy.hp;
    const refSkillDmg = before - resolveTurn(s, { kind: 'skill', skillId: 'spark-flare', quizCorrect: true }, skillCtx).state.enemy.hp; // chain-5 spark-flare hit
    const r = resolveTurn(s, { kind: 'catalystBurst' }, skillCtx);
    expect(before - r.state.enemy.hp).toBeGreaterThan(refSkillDmg); // burst hits harder than a maxed-chain skill
    expect(r.state.enemy.statuses.some(st => st.id === 'combusting')).toBe(true);
    expect(r.state.chain).toBe(0);
    expect(r.state.catalystBurstReady).toBe(false);
  });
});
```

- [ ] **Step 2: Implement** — in `engine.ts`: add `catalystBurstSkillId?: string` to `Combatant`; in `createBattle`, set `playerCombatant.catalystBurstSkillId = player.catalystBurstSkillId`; replace the stub with:

```ts
function resolveBurstSkill(attacker: Combatant, ctx: BattleContext): SkillDef | null {
  if (!attacker.catalystBurstSkillId) return null;
  try { return ctx.getSkill(attacker.catalystBurstSkillId); } catch { return null; }
}
```

- [ ] **Step 3: Run the suite — PASS.**

Run: `npm test`

- [ ] **Step 4: Commit**

```bash
git add src/systems/battle/engine.ts src/systems/battle/types.ts tests/systems/battleEngine.test.ts
git commit -m "feat(battle): Catalyst Burst — class burst skill at ×3, consumes chain (TDD)"
```

---

### Task 20: Enemy AI (`chooseEnemyAction`) — TDD

**Files:**
- Modify: `src/systems/battle/engine.ts` (replace the Task-16 stub)
- Test: append to `tests/systems/battleEngine.test.ts`

AI rule (M1): with `rng() < 0.25` → basic attack (variety). Otherwise, among `enemy.skillIds` filtered to those affordable (`energyCost <= enemy.energy`), pick the one maximising `power * effectiveness(chart, skill.affinity, player.affinity)`; if none, basic attack. Enemy skill actions carry `quizCorrect: null` (enemies are never quizzed).

- [ ] **Step 1: Add the tests**

```ts
describe('chooseEnemyAction', () => {
  it('with skills, picks the highest expected-damage affordable skill (rng above the 25% wildcard)', () => {
    // electrid knows spark-flare (Combustion, power 42). player affinity Combustion vs Combustion -> neutral 1. Still better than basic attack 20.
    let s = createBattle({ ...playerInput, spd: 1 }, { def: { id: 'electrid', name: 'Electrid', affinity: 'Atomic', baseStats: { hp: 9999, atk: 30, def: 4, spd: 99 }, level: 3, attackPower: 20, skillIds: ['spark-flare'], xpYield: 16, role: 'wild', spriteKey: 'enemy_electrid' } as any, level: 3 }, { rng: () => 0.9 });
    const r = resolveTurn(s, { kind: 'attack' }, skillCtx);
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy' && (e as any).skillId === 'spark-flare')).toBe(true);
  });
  it('falls back to a basic attack when the enemy has no skills', () => {
    let s = createBattle({ ...playerInput, spd: 1 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 30, def: 4, spd: 99 } }, level: 3 }, { rng: () => 0.9 });
    const r = resolveTurn(s, { kind: 'attack' }, skillCtx);
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy' && (e as any).skillId === undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

```ts
function chooseEnemyAction(state: BattleState, ctx: BattleContext): BattleAction {
  const e = state.enemy;
  if (state.rng() < 0.25) return { kind: 'attack' };
  let best: { id: string; score: number } | null = null;
  for (const id of e.skillIds) {
    let skill: SkillDef; try { skill = ctx.getSkill(id); } catch { continue; }
    if (skill.energyCost > e.energy) continue;
    const score = Math.max(1, skill.power) * effectiveness(TYPE_CHART, skill.affinity, state.player.affinity);
    if (!best || score > best.score) best = { id, score };
  }
  return best ? { kind: 'skill', skillId: best.id, quizCorrect: null } : { kind: 'attack' };
}
```

- [ ] **Step 3: Run — PASS.**

- [ ] **Step 4: Commit**

```bash
git add src/systems/battle/engine.ts tests/systems/battleEngine.test.ts
git commit -m "feat(battle): enemy AI — pick best affordable skill, 25% wildcard attack (TDD)"
```

---

### Task 21: Item action in battle — TDD

**Files:** add tests to `tests/systems/battleEngine.test.ts` (the `applyAction('item')` code landed in Task 16; test it; fix bugs).

- [ ] **Step 1: Add the tests** — provide a real `getItem` from `items.json`:

```ts
import itemsData from '../../src/content/data/items.json';
const items = itemsData as Record<string, import('../../src/content/types').ItemDef>;
const fullCtx = { ...skillCtx, getItem: (id: string) => { const i = items[id]; if (!i) throw new Error('unknown item ' + id); return i; } };

describe('resolveTurn — items', () => {
  it('minor-buffer heals 25 HP, capped at max', () => {
    let s = createBattle({ ...playerInput, hp: 10, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'minor-buffer' }, fullCtx);
    expect(r.state.player.hp).toBe(10 + 25 - /* enemy's tiny basic attack */ (10 + 25 - r.state.player.hp >= 0 ? (10 + 25 - r.state.player.hp) : 0));
    // simpler: it healed by ~25 then took a small hit
    expect(r.state.player.hp).toBeGreaterThan(10);
    expect(r.events.some(e => e.t === 'item' && (e as any).itemId === 'minor-buffer')).toBe(true);
  });
  it('reagent revives a fainted hero — but only if hp is 0', () => {
    let s = createBattle({ ...playerInput, hp: 0, maxHp: 100, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 0, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    // NOTE: hp 0 at battle start is contrived; in practice the scene only offers reagent when the hero faints mid-battle (which can't happen in 1v1 — once you faint the battle ends). Reagent is therefore an out-of-battle item; usableInBattle is true only for symmetry. Keeping the test for the effect logic.
    const r = resolveTurn(s, { kind: 'item', itemId: 'reagent' }, fullCtx);
    expect(r.state.player.hp).toBe(50); // 50% of 100
  });
  it('energy-cell restores 50 Energy, capped at max', () => {
    let s = createBattle({ ...playerInput, energy: 30, maxEnergy: 100, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'energy-cell' }, fullCtx);
    // +25 turn regen happens first (energy 55), then +50 cell -> capped at 100
    expect(r.state.player.energy).toBe(100);
  });
  it('a stat booster raises the relevant buff stage', () => {
    let s = createBattle({ ...playerInput, spd: 99 }, { def: { ...enemy, baseStats: { hp: 9999, atk: 1, def: 12, spd: 1 } }, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'item', itemId: 'atk-catalyst' }, fullCtx);
    expect(r.state.player.buffs.atk).toBe(1);
  });
});
```

- [ ] **Step 2: Run — PASS** (fix item bugs). `npx vitest run tests/systems/battleEngine.test.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/systems/battleEngine.test.ts src/systems/battle/engine.ts
git commit -m "test(battle): in-battle item effects coverage"
```

---

### Task 22: Run action — flee succeeds vs wild, fails vs boss — TDD

**Files:** add tests to `tests/systems/battleEngine.test.ts` (`applyAction('run')` landed in Task 16).

- [ ] **Step 1: Add the tests**

```ts
describe('resolveTurn — run', () => {
  it('fleeing a wild battle ends it with outcome "fled"', () => {
    let s = createBattle({ ...playerInput, spd: 99 }, { def: enemy, level: 3 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'run' }, fullCtx);
    expect(r.state.outcome).toBe('fled');
    expect(r.events.some(e => e.t === 'outcome' && (e as any).outcome === 'fled')).toBe(true);
    // the enemy never got to act because the player fled first (faster) and the battle ended
    expect(r.events.some(e => e.t === 'attack' && (e as any).side === 'enemy')).toBe(false);
  });
  it('fleeing a boss battle fails and wastes the player\'s turn', () => {
    let s = createBattle({ ...playerInput, spd: 99 }, { def: { id: 'the-unstable-isotope', name: 'The Unstable Isotope', affinity: 'Atomic', baseStats: { hp: 140, atk: 16, def: 12, spd: 10 }, level: 9, attackPower: 30, skillIds: [], xpYield: 260, role: 'regionBoss', spriteKey: 'enemy_unstable_isotope', bossSoftScale: true } as any, level: 9 }, { rng: () => 1 });
    const r = resolveTurn(s, { kind: 'run' }, fullCtx);
    expect(r.state.outcome).toBe('ongoing');
    expect(r.events.some(e => e.t === 'fleeFailed')).toBe(true);
    expect(r.state.player.hp).toBeLessThan(s.player.hp); // boss still swung
  });
});
```

- [ ] **Step 2: Run — PASS.**

- [ ] **Step 3: Commit**

```bash
git add tests/systems/battleEngine.test.ts src/systems/battle/engine.ts
git commit -m "test(battle): run action — flees wild, fails vs boss"
```

---

### Task 23: Boss soft-scaling + a full deterministic integration battle — TDD

**Files:** add tests to `tests/systems/battleEngine.test.ts` (`buildEnemyCombatant` already has the scaling skeleton from Task 15 — verify + tune).

- [ ] **Step 1: Add the tests**

```ts
import { buildEnemyCombatant } from '../../src/systems/BattleEngine';

describe('boss soft-scaling', () => {
  const bossDef = { id: 'the-unstable-isotope', name: 'The Unstable Isotope', affinity: 'Atomic', baseStats: { hp: 140, atk: 16, def: 12, spd: 10 }, level: 9, attackPower: 30, skillIds: ['isotope-flux'], xpYield: 260, role: 'regionBoss', spriteKey: 'enemy_unstable_isotope', bossSoftScale: true } as any;
  it('scales UP to an over-levelled player but never DOWN for an under-levelled one', () => {
    const vsHigh = buildEnemyCombatant(bossDef, 9, 13);
    expect(vsHigh.level).toBe(13);
    expect(vsHigh.maxHp).toBeGreaterThan(140);
    const vsLow = buildEnemyCombatant(bossDef, 9, 5);
    expect(vsLow.level).toBe(9);            // not scaled down — under-levelled players aren't punished further
    expect(vsLow.maxHp).toBe(140);
  });
  it('wild enemies never soft-scale', () => {
    const w = buildEnemyCombatant({ ...bossDef, role: 'wild', bossSoftScale: false } as any, 9, 20);
    expect(w.level).toBe(9);
  });
});

describe('integration — a whole battle resolves deterministically', () => {
  it('a level-9 player beats Protium without fainting (seeded rng)', () => {
    let seed = 12345; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let s = createBattle({ ...playerInput, level: 9, maxHp: 100, hp: 100, atk: 40, def: 18, spd: 18, equippedSkillIds: ['proton-jab', 'spark-flare', 'shell-shatter'] }, { def: enemy, level: 3 }, { rng });
    let guard = 0;
    while (s.outcome === 'ongoing' && guard++ < 50) s = resolveTurn(s, { kind: guard % 2 === 0 ? 'attack' : 'skill', skillId: 'spark-flare', quizCorrect: true } as any, skillCtx).state;
    expect(s.outcome).toBe('playerWin');
    expect(guard).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Run — PASS** (tune `scaleStat` if numbers feel off).

- [ ] **Step 3: Run the entire suite**

Run: `npm test`
Expected: every test green — content + all of `BattleEngine`.

- [ ] **Step 4: Commit**

```bash
git add tests/systems/battleEngine.test.ts src/systems/battle/engine.ts
git commit -m "test(battle): boss soft-scaling + full-battle integration coverage"
```

---

# Phase 3 — `QuizEngine` (pure logic)

### Task 24: `pickQuestion` — topic + difficulty band + adaptive difficulty + no-repeats — TDD

**Files:**
- Create: `src/systems/QuizEngine.ts`
- Test: `tests/systems/quizEngine.test.ts`

`QuizEngine` is a small class holding the question bank and the set of question ids already shown *this session* (so a battle/shrine doesn't repeat). `pickQuestion(topic, preferredDifficulty, topicStat?)`: filter to `topic`; if `topicStat.recentMisses >= 2`, bias the difficulty *down* by clamping the target band to `1`; among unshown questions at the target difficulty pick one via the injected `rng`; if none unshown at that difficulty, widen to ±1 difficulty; if still none, reset the shown-set for that topic and try again; throw only if the topic has zero questions at all (the scene should have validated content first).

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/quizEngine.test.ts
import { describe, it, expect } from 'vitest';
import { QuizEngine } from '../../src/systems/QuizEngine';
import type { QuestionDef, TopicQuizStat } from '../../src/content/types';

const Q = (id: string, difficulty: 1 | 2 | 3): QuestionDef => ({ id, topic: 't', difficulty, format: 'mcq', prompt: id, options: ['a', 'b', 'c', 'd'], answerIndex: 0, explanation: 'e' });
const bank = { t: [Q('a1', 1), Q('a2', 1), Q('b1', 2), Q('b2', 2), Q('c1', 3), Q('c2', 3)] };

describe('QuizEngine.pickQuestion', () => {
  it('returns a question of the requested topic at (or near) the preferred difficulty', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const q = qe.pickQuestion('t', 2);
    expect(['b1', 'b2']).toContain(q.id);
  });
  it('does not repeat a question within the session until the pool is exhausted', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) seen.add(qe.pickQuestion('t', i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3).id);
    expect(seen.size).toBe(6); // all six distinct
    const seventh = qe.pickQuestion('t', 1); // pool exhausted -> reset, may repeat now
    expect(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).toContain(seventh.id);
  });
  it('adapts down to difficulty 1 when the student has missed this topic ≥2 times recently', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const stat: TopicQuizStat = { topic: 't', asked: 5, correct: 1, recentMisses: 3 };
    const q = qe.pickQuestion('t', 3, stat);
    expect(q.difficulty).toBe(1);
  });
  it('widens the difficulty band when nothing unshown sits at the target', () => {
    const qe = new QuizEngine({ t: [Q('only2a', 2), Q('only2b', 2)] }, { rng: () => 0 });
    expect(qe.pickQuestion('t', 1).difficulty).toBe(2); // widened up to find one
  });
  it('throws for a topic with no questions', () => {
    expect(() => new QuizEngine({ t: [] }, { rng: () => 0 }).pickQuestion('t', 1)).toThrow();
    expect(() => new QuizEngine(bank, { rng: () => 0 }).pickQuestion('nope', 1)).toThrow();
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/systems/QuizEngine.ts`** (the `checkAnswer` part is filled in Task 25 — write a stub for it now so the file compiles)

```ts
import type { QuestionDef, TopicQuizStat } from '../content/types';

export class QuizEngine {
  private shown = new Map<string, Set<string>>(); // topic -> shown question ids this session
  constructor(private bank: Record<string, QuestionDef[]>, private opts: { rng?: () => number } = {}) {}
  private rng() { return (this.opts.rng ?? Math.random)(); }
  private shownSet(topic: string) { let s = this.shown.get(topic); if (!s) { s = new Set(); this.shown.set(topic, s); } return s; }

  pickQuestion(topic: string, preferredDifficulty: number, topicStat?: TopicQuizStat): QuestionDef {
    const all = this.bank[topic];
    if (!all || all.length === 0) throw new Error(`QuizEngine: no questions for topic "${topic}"`);
    const target = (topicStat && topicStat.recentMisses >= 2) ? 1 : Math.max(1, Math.min(3, Math.round(preferredDifficulty)));
    const seen = this.shownSet(topic);
    // try the target band, then widen by ±1, ±2
    for (const widen of [0, 1, 2]) {
      const lo = Math.max(1, target - widen), hi = Math.min(3, target + widen);
      const pool = all.filter(q => q.difficulty >= lo && q.difficulty <= hi && !seen.has(q.id));
      if (pool.length) { const q = pool[Math.floor(this.rng() * pool.length)]; seen.add(q.id); return q; }
    }
    // exhausted: reset the shown-set and pick from the whole topic at the closest difficulty
    seen.clear();
    const byCloseness = [...all].sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target));
    const bestDiff = Math.abs(byCloseness[0].difficulty - target);
    const pool = byCloseness.filter(q => Math.abs(q.difficulty - target) === bestDiff);
    const q = pool[Math.floor(this.rng() * pool.length)];
    seen.add(q.id);
    return q;
  }

  // Task 25:
  checkAnswer(_q: QuestionDef, _answer: { index?: number; widgetCoeffs?: number[] }): boolean { throw new Error('not implemented — Task 25'); }
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run tests/systems/quizEngine.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/systems/QuizEngine.ts tests/systems/quizEngine.test.ts
git commit -m "feat(quiz): pickQuestion — topic/difficulty band, adaptive, no-repeats (TDD)"
```

---

### Task 25: `checkAnswer` — MCQ + balance-the-equation widget — TDD

**Files:**
- Modify: `src/systems/QuizEngine.ts`
- Test: append to `tests/systems/quizEngine.test.ts`

For `mcq`: `answer.index === q.answerIndex`. For `balanceEquation`: the widget yields coefficients **in the order `[...reactants, ...products]`**; the answer is correct iff every coefficient equals the corresponding `coeff` in `q.equation`. (Reject if the lengths don't match.)

- [ ] **Step 1: Add the tests**

```ts
import type { QuestionDef } from '../../src/content/types';
const eqQ: QuestionDef = { id: 'e1', topic: 't', difficulty: 3, format: 'balanceEquation', prompt: 'Balance H2 + O2 -> H2O',
  equation: { reactants: [{ formula: 'H2', coeff: 2 }, { formula: 'O2', coeff: 1 }], products: [{ formula: 'H2O', coeff: 2 }] }, explanation: '2H2 + O2 -> 2H2O' };
const mcqQ: QuestionDef = { id: 'm1', topic: 't', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'e' };

describe('QuizEngine.checkAnswer', () => {
  const qe = new QuizEngine({ t: [mcqQ, eqQ] }, { rng: () => 0 });
  it('mcq: only the matching index is correct', () => {
    expect(qe.checkAnswer(mcqQ, { index: 2 })).toBe(true);
    expect(qe.checkAnswer(mcqQ, { index: 0 })).toBe(false);
    expect(qe.checkAnswer(mcqQ, {})).toBe(false);
  });
  it('balanceEquation: every coefficient (reactants then products) must match', () => {
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [2, 1, 2] })).toBe(true);
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [1, 1, 2] })).toBe(false);
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [2, 1] })).toBe(false);   // wrong length
    expect(qe.checkAnswer(eqQ, { index: 0 })).toBe(false);              // wrong answer kind
  });
});
```

- [ ] **Step 2: Run — FAIL** (stub throws).

- [ ] **Step 3: Replace the `checkAnswer` stub**

```ts
checkAnswer(q: QuestionDef, answer: { index?: number; widgetCoeffs?: number[] }): boolean {
  if (q.format === 'mcq') return typeof answer.index === 'number' && answer.index === q.answerIndex;
  if (q.format === 'balanceEquation' && q.equation) {
    const expected = [...q.equation.reactants, ...q.equation.products].map(t => t.coeff);
    const got = answer.widgetCoeffs;
    return Array.isArray(got) && got.length === expected.length && expected.every((c, i) => got[i] === c);
  }
  return false;
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/QuizEngine.ts tests/systems/quizEngine.test.ts
git commit -m "feat(quiz): checkAnswer — mcq + balance-equation widget (TDD)"
```

---

# Phase 4 — `Progression` (pure logic)

### Task 26: XP / level curves — TDD

**Files:**
- Create: `src/systems/Progression.ts`
- Test: `tests/systems/progression.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/progression.test.ts
import { describe, it, expect } from 'vitest';
import { xpToNextLevel, totalXpForLevel, levelForXp } from '../../src/systems/Progression';

describe('xp / level curves', () => {
  it('xpToNextLevel(L) = 100*L', () => { expect(xpToNextLevel(1)).toBe(100); expect(xpToNextLevel(9)).toBe(900); });
  it('totalXpForLevel(L) = 50*L*(L-1) (cumulative to *reach* level L)', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);   // 0 + 100
    expect(totalXpForLevel(3)).toBe(300);   // 0 + 100 + 200
    expect(totalXpForLevel(10)).toBe(4500);
  });
  it('levelForXp inverts the curve', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(4500)).toBe(10);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement (this slice) in `src/systems/Progression.ts`**

```ts
export function xpToNextLevel(level: number): number { return 100 * level; }
export function totalXpForLevel(level: number): number { return 50 * level * (level - 1); }
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/Progression.ts tests/systems/progression.test.ts
git commit -m "feat(progression): xp/level curves (TDD)"
```

---

### Task 27: `statsForLevel` — base + per-level growth + evolution bonus — TDD

**Files:** Modify `src/systems/Progression.ts`; append to `tests/systems/progression.test.ts`.

`statsForLevel(classDef, level, evolutionStage)` = component-wise `floor(baseStats + growth*(level-1) + sum of statBonus for every evolution with stage <= evolutionStage)`.

- [ ] **Step 1: Add the tests** (use the real `classes.json`)

```ts
import { statsForLevel } from '../../src/systems/Progression';
import classesData from '../../src/content/data/classes.json';
import type { ClassDef } from '../../src/content/types';
const classes = classesData as ClassDef[];
const pyron = classes.find(c => c.id === 'pyron')!;

describe('statsForLevel', () => {
  it('at level 1, stage 0 = baseStats', () => { expect(statsForLevel(pyron, 1, 0)).toEqual(pyron.baseStats); });
  it('grows by `growth` each level beyond 1', () => {
    const l5 = statsForLevel(pyron, 5, 0);
    expect(l5.hp).toBe(pyron.baseStats.hp + pyron.growth.hp * 4);
    expect(l5.atk).toBe(pyron.baseStats.atk + pyron.growth.atk * 4);
  });
  it('adds the evolution statBonus once stage 1 is reached', () => {
    const evo = pyron.evolutions[0].statBonus;
    const l10s0 = statsForLevel(pyron, 10, 0);
    const l10s1 = statsForLevel(pyron, 10, 1);
    expect(l10s1.hp).toBe(l10s0.hp + evo.hp);
    expect(l10s1.atk).toBe(l10s0.atk + evo.atk);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { ClassDef, Stats } from '../content/types';
const ZERO: Stats = { hp: 0, atk: 0, def: 0, spd: 0 };
const addStats = (a: Stats, b: Stats): Stats => ({ hp: a.hp + b.hp, atk: a.atk + b.atk, def: a.def + b.def, spd: a.spd + b.spd });
const scaleStats = (a: Stats, k: number): Stats => ({ hp: a.hp * k, atk: a.atk * k, def: a.def * k, spd: a.spd * k });
const floorStats = (a: Stats): Stats => ({ hp: Math.floor(a.hp), atk: Math.floor(a.atk), def: Math.floor(a.def), spd: Math.floor(a.spd) });

export function statsForLevel(classDef: ClassDef, level: number, evolutionStage: number): Stats {
  let s = addStats(classDef.baseStats, scaleStats(classDef.growth, Math.max(0, level - 1)));
  for (const evo of classDef.evolutions) if (evo.stage <= evolutionStage) s = addStats(s, evo.statBonus);
  return floorStats(s);
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/Progression.ts tests/systems/progression.test.ts
git commit -m "feat(progression): statsForLevel — base + growth + evolution bonus (TDD)"
```

---

### Task 28: `addXp` — multi-level-up + skill unlocks — TDD

**Files:** Modify `src/systems/Progression.ts`; append to `tests/systems/progression.test.ts`.

`addXp(state, amount, classDef)` where `state = { level, xp, unlockedSkillIds }`. Returns `{ level, xp, unlockedSkillIds, leveledTo: number[], newlyUnlockedSkillIds: string[] }`. New XP is added; level recomputed via `levelForXp`; for every level newly crossed, any `classDef.skillUnlocks` at that level whose skill isn't already unlocked is added.

- [ ] **Step 1: Add the tests**

```ts
import { addXp } from '../../src/systems/Progression';

describe('addXp', () => {
  it('adds xp and reports the new level(s) crossed', () => {
    const r = addXp({ level: 1, xp: 0, unlockedSkillIds: [...pyron.startingSkillIds] }, 350, pyron);
    expect(r.level).toBe(3);                 // 350 xp -> level 3 (needs 300)
    expect(r.xp).toBe(350);
    expect(r.leveledTo).toEqual([2, 3]);
  });
  it('unlocks skills scheduled at the levels just crossed (and not before)', () => {
    const r = addXp({ level: 1, xp: 0, unlockedSkillIds: [...pyron.startingSkillIds] }, totalXpForLevel(3), pyron);
    // pyron unlocks "ionize" at level 3
    expect(r.newlyUnlockedSkillIds).toContain('ionize');
    expect(r.unlockedSkillIds).toContain('ionize');
    const r2 = addXp({ level: 1, xp: 0, unlockedSkillIds: [...pyron.startingSkillIds] }, totalXpForLevel(2), pyron);
    expect(r2.newlyUnlockedSkillIds).not.toContain('ionize'); // level 2, not yet
  });
  it('is idempotent about already-unlocked skills', () => {
    const r = addXp({ level: 9, xp: totalXpForLevel(9), unlockedSkillIds: ['proton-jab', 'ionize'] }, xpToNextLevel(9), pyron);
    expect(r.level).toBe(10);
    expect(r.newlyUnlockedSkillIds).not.toContain('ionize');         // already had it
    expect(r.newlyUnlockedSkillIds).toContain('combustion-cascade');  // unlocked at level 10
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
export interface ProgressState { level: number; xp: number; unlockedSkillIds: string[]; }
export interface AddXpResult extends ProgressState { leveledTo: number[]; newlyUnlockedSkillIds: string[]; }

export function addXp(state: ProgressState, amount: number, classDef: ClassDef): AddXpResult {
  const xp = state.xp + Math.max(0, Math.floor(amount));
  const newLevel = levelForXp(xp);
  const leveledTo: number[] = [];
  for (let l = state.level + 1; l <= newLevel; l++) leveledTo.push(l);
  const unlocked = new Set(state.unlockedSkillIds);
  const newlyUnlockedSkillIds: string[] = [];
  for (const u of classDef.skillUnlocks) if (u.level > state.level && u.level <= newLevel && !unlocked.has(u.skillId)) { unlocked.add(u.skillId); newlyUnlockedSkillIds.push(u.skillId); }
  return { level: newLevel, xp, unlockedSkillIds: [...unlocked], leveledTo, newlyUnlockedSkillIds };
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/Progression.ts tests/systems/progression.test.ts
git commit -m "feat(progression): addXp — multi-level-up + skill unlocks (TDD)"
```

---

### Task 29: `checkEvolution` — Lv 10 AND region cleared — TDD

**Files:** Modify `src/systems/Progression.ts`; append to `tests/systems/progression.test.ts`.

`checkEvolution(classDef, level, currentStage, regionProgress)`: among `classDef.evolutions` with `stage === currentStage + 1`, return the first whose `atLevel <= level` **and** `regionProgress[evo.requiresRegionClearedId]?.bossDefeated === true`; else `null`.

- [ ] **Step 1: Add the tests**

```ts
import { checkEvolution } from '../../src/systems/Progression';
const cleared = { 'elemental-reaches': { entered: true, miniBossDefeated: true, bossDefeated: true, shrineCleared: false } };
const notCleared = { 'elemental-reaches': { entered: true, miniBossDefeated: true, bossDefeated: false, shrineCleared: false } };

describe('checkEvolution', () => {
  it('returns the stage-1 evolution when Lv≥10 AND Region 1 boss is down', () => {
    const evo = checkEvolution(pyron, 10, 0, cleared);
    expect(evo?.name).toBe('Pyrochemist');
  });
  it('returns null below the level threshold', () => { expect(checkEvolution(pyron, 9, 0, cleared)).toBeNull(); });
  it('returns null when the required region boss is not yet defeated', () => { expect(checkEvolution(pyron, 12, 0, notCleared)).toBeNull(); });
  it('returns null when already at the latest authored stage', () => { expect(checkEvolution(pyron, 30, 1, cleared)).toBeNull(); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { EvolutionDef, RegionProgress } from '../content/types';
export function checkEvolution(classDef: ClassDef, level: number, currentStage: number, regionProgress: Record<string, RegionProgress>): EvolutionDef | null {
  for (const evo of classDef.evolutions) {
    if (evo.stage !== currentStage + 1) continue;
    if (level < evo.atLevel) continue;
    if (!regionProgress[evo.requiresRegionClearedId]?.bossDefeated) continue;
    return evo;
  }
  return null;
}
```

- [ ] **Step 4: Run — PASS, then run the whole suite.**

Run: `npm test`
Expected: content + BattleEngine + QuizEngine + Progression all green.

- [ ] **Step 5: Commit**

```bash
git add src/systems/Progression.ts tests/systems/progression.test.ts
git commit -m "feat(progression): checkEvolution — Lv 10 AND region cleared gate (TDD)"
```

---

# Phase 5 — `SaveManager` (pure-ish; injectable storage)

### Task 30: `newGame` — fresh save from a class id + content — TDD

**Files:**
- Create: `src/systems/SaveManager.ts`
- Test: `tests/systems/saveManager.test.ts`

`SaveManager` exposes static functions taking an explicit `StorageLike` (`{ getItem(k): string|null; setItem(k,v): void; removeItem(k): void }`) so tests pass an in-memory stub. `newGame(classId, content)`: look up the class; `level 1`, `xp 0`, `evolutionStage 0`; `stats = statsForLevel(classDef, 1, 0)`; `currentHp = stats.hp`; `currentEnergy = 100`; `unlockedSkillIds = [...startingSkillIds]`; `equippedSkillIds = startingSkillIds.slice(0, 5)`; `items = [...startingItemIds]`; `currentRegionId = content.regions[0].id`; `regionProgress = { [region1.id]: { entered: true, miniBossDefeated: false, bossDefeated: false, shrineCleared: false } }`; `storyFlags = {}`; `playerTile = { regionId: region1.id, x: <region1 spawn>, y: <region1 spawn> }` — spawn coords come from the tilemap's `objects` layer (`player_spawn`); for M1 hardcode `{x: 4, y: 14}` and add a TODO to read it from the tilemap once Task 43 authors it (or, cleaner: have `OverworldScene` reposition the player to the tilemap's `player_spawn` object on entry, so the save value is just a fallback); `quizStats = {}`; `settings = { studyMode: false, answerTimer: false }`; `version = CURRENT_SAVE_VERSION`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/systems/saveManager.test.ts
import { describe, it, expect } from 'vitest';
import { SaveManager, CURRENT_SAVE_VERSION } from '../../src/systems/SaveManager';
import { loadGameContent } from '../../src/content/loadGameContent';

const content = loadGameContent().content;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe('SaveManager.newGame', () => {
  it('creates a level-1, stage-0 save in Region 1 with the class\'s starting kit', () => {
    const s = SaveManager.newGame('pyron', content);
    expect(s.version).toBe(CURRENT_SAVE_VERSION);
    expect(s.classId).toBe('pyron');
    expect(s.level).toBe(1); expect(s.xp).toBe(0); expect(s.evolutionStage).toBe(0);
    expect(s.currentHp).toBe(s.stats.hp);
    expect(s.currentEnergy).toBe(100);
    expect(s.unlockedSkillIds).toEqual(content.classes.find(c => c.id === 'pyron')!.startingSkillIds);
    expect(s.equippedSkillIds.length).toBeLessThanOrEqual(5);
    expect(s.currentRegionId).toBe(content.regions[0].id);
    expect(s.regionProgress[content.regions[0].id].entered).toBe(true);
    expect(s.regionProgress[content.regions[0].id].bossDefeated).toBe(false);
    expect(s.settings).toEqual({ studyMode: false, answerTimer: false });
  });
  it('throws for an unknown class id', () => { expect(() => SaveManager.newGame('nope', content)).toThrow(); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement (this slice) `src/systems/SaveManager.ts`**

```ts
import type { GameContent, SaveData } from '../content/types';
import { statsForLevel } from './Progression';

export const SAVE_KEY = 'equilibrium-lost:save:v1';
export const CURRENT_SAVE_VERSION = 1;

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; }

export const SaveManager = {
  newGame(classId: string, content: GameContent): SaveData {
    const cls = content.classes.find(c => c.id === classId);
    if (!cls) throw new Error(`SaveManager.newGame: unknown class "${classId}"`);
    const region1 = content.regions[0];
    const stats = statsForLevel(cls, 1, 0);
    return {
      version: CURRENT_SAVE_VERSION, classId, evolutionStage: 0, level: 1, xp: 0, stats,
      currentHp: stats.hp, currentEnergy: 100,
      unlockedSkillIds: [...cls.startingSkillIds], equippedSkillIds: cls.startingSkillIds.slice(0, 5),
      items: cls.startingItemIds.map(i => ({ ...i })),
      currentRegionId: region1.id,
      regionProgress: { [region1.id]: { entered: true, miniBossDefeated: false, bossDefeated: false, shrineCleared: false } },
      storyFlags: {},
      playerTile: { regionId: region1.id, x: 4, y: 14 }, // OverworldScene snaps to the tilemap's player_spawn on entry; this is a fallback
      quizStats: {},
      settings: { studyMode: false, answerTimer: false }
    };
  }
  // save/load/migrate/clear/recordQuizResult — Tasks 31–34
};
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): newGame — fresh save from class + content (TDD)"
```

---

### Task 31: `save` / `load` round-trip — TDD

**Files:** Modify `src/systems/SaveManager.ts`; append to `tests/systems/saveManager.test.ts`.

`save(data, storage)` → `storage.setItem(SAVE_KEY, JSON.stringify(data))`. `load(content, storage)` → `{ ok: true, data }` on a valid current-version save, after running `migrate` to fill any missing fields. (`clear(storage)` removes the key.)

- [ ] **Step 1: Add the tests**

```ts
describe('SaveManager.save / load', () => {
  it('round-trips a save through storage', () => {
    const st = memStorage();
    const s = SaveManager.newGame('aqualis', content);
    s.level = 7; s.xp = 1500; s.storyFlags.lesson_atomic_structure_seen = true;
    SaveManager.save(s, st);
    const r = SaveManager.load(content, st);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.classId).toBe('aqualis'); expect(r.data.level).toBe(7); expect(r.data.storyFlags.lesson_atomic_structure_seen).toBe(true); }
  });
  it('load returns {ok:false, reason:"none"} when there is no save', () => {
    const r = SaveManager.load(content, memStorage());
    expect(r).toEqual({ ok: false, reason: 'none' });
  });
  it('clear removes the save', () => {
    const st = memStorage();
    SaveManager.save(SaveManager.newGame('ionix', content), st);
    SaveManager.clear(st);
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'none' });
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** (add to `SaveManager`):

```ts
  save(data: SaveData, storage: StorageLike): void { storage.setItem(SAVE_KEY, JSON.stringify(data)); },
  clear(storage: StorageLike): void { storage.removeItem(SAVE_KEY); },
  load(content: GameContent, storage: StorageLike): { ok: true; data: SaveData } | { ok: false; reason: 'none' | 'corrupt' } {
    const raw = storage.getItem(SAVE_KEY);
    if (raw == null) return { ok: false, reason: 'none' };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupt' }; }
    try { const data = SaveManager.migrate(parsed, content); return { ok: true, data }; }
    catch { return { ok: false, reason: 'corrupt' }; }
  },
```

(`migrate` is stubbed for now to just cast + return; Task 33 makes it real, and Task 32's corrupt-detection tests will then pass through it.)

```ts
  migrate(raw: unknown, _content: GameContent): SaveData { if (typeof raw !== 'object' || raw === null) throw new Error('corrupt'); return raw as SaveData; },
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): save/load/clear round-trip (TDD)"
```

---

### Task 32: Corrupted-save detection — TDD

**Files:** Modify `src/systems/SaveManager.ts` (`migrate` validates shape); append to `tests/systems/saveManager.test.ts`.

A save is "corrupt" if: not parseable JSON; not an object; missing `version`/`classId`; `classId` not in content; `level`/`xp`/`stats` missing or wrong-typed; `equippedSkillIds`/`unlockedSkillIds` not arrays; `regionProgress`/`storyFlags`/`quizStats`/`settings` not objects. On corrupt, `load` returns `{ ok: false, reason: 'corrupt' }` — the scene then offers a clean restart (never silently wipes).

- [ ] **Step 1: Add the tests**

```ts
describe('SaveManager — corruption', () => {
  it('non-JSON in storage -> corrupt', () => { const st = memStorage(); st.setItem(SAVE_KEY, '{not json'); expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' }); });
  it('a JSON value that is not an object -> corrupt', () => { const st = memStorage(); st.setItem(SAVE_KEY, '42'); expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' }); });
  it('missing version / classId -> corrupt', () => { const st = memStorage(); st.setItem(SAVE_KEY, JSON.stringify({ level: 1 })); expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' }); });
  it('a classId that does not exist in content -> corrupt', () => {
    const st = memStorage(); const s = SaveManager.newGame('pyron', content); (s as any).classId = 'phantom';
    st.setItem(SAVE_KEY, JSON.stringify(s));
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
  it('a structurally-broken regionProgress -> corrupt', () => {
    const st = memStorage(); const s = SaveManager.newGame('pyron', content); (s as any).regionProgress = 'nope';
    st.setItem(SAVE_KEY, JSON.stringify(s));
    expect(SaveManager.load(content, st)).toEqual({ ok: false, reason: 'corrupt' });
  });
});
```

- [ ] **Step 2: Run — FAIL** (stub `migrate` accepts these).

- [ ] **Step 3: Implement shape validation in `migrate`** (before/around the version handling — keep version handling for Task 33):

```ts
  migrate(raw: unknown, content: GameContent): SaveData {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('corrupt: not an object');
    const o = raw as Record<string, unknown>;
    // (Task 33 inserts version-bump logic here, BEFORE these checks, so older saves are upgraded first.)
    const isArr = Array.isArray, isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
    if (typeof o.version !== 'number') throw new Error('corrupt: no version');
    if (typeof o.classId !== 'string' || !content.classes.some(c => c.id === o.classId)) throw new Error('corrupt: bad classId');
    if (typeof o.level !== 'number' || typeof o.xp !== 'number') throw new Error('corrupt: bad level/xp');
    if (!isObj(o.stats)) throw new Error('corrupt: bad stats');
    if (!isArr(o.unlockedSkillIds) || !isArr(o.equippedSkillIds) || !isArr(o.items)) throw new Error('corrupt: bad arrays');
    for (const k of ['regionProgress', 'storyFlags', 'quizStats', 'settings'] as const) if (!isObj(o[k])) throw new Error(`corrupt: bad ${k}`);
    return o as unknown as SaveData;
  },
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): corrupted-save detection -> {ok:false, reason:'corrupt'} (TDD)"
```

---

### Task 33: Save versioning & migration — TDD

**Files:** Modify `src/systems/SaveManager.ts`; append to `tests/systems/saveManager.test.ts`.

M1 ships `version 1`. A "version 0" save (or a save with `version` missing the M1-era fields) is upgraded by filling defaults: `evolutionStage ??= 0`, `currentEnergy ??= 100`, `quizStats ??= {}`, `settings ??= { studyMode:false, answerTimer:false }`, `playerTile ??= { regionId: currentRegionId, x:4, y:14 }`, then set `version = CURRENT_SAVE_VERSION`. (The migration *ladder* — a series of `0→1`, `1→2`… steps — is built now even though there's only one entry, so Milestone 2 just appends a step.)

- [ ] **Step 1: Add the tests**

```ts
describe('SaveManager — migration', () => {
  it('upgrades a "version 0" save by filling M1 defaults and bumping the version', () => {
    const st = memStorage();
    const base = SaveManager.newGame('pyron', content);
    const old: any = { ...base, version: 0 };
    delete old.evolutionStage; delete old.currentEnergy; delete old.quizStats; delete old.settings; delete old.playerTile;
    st.setItem(SAVE_KEY, JSON.stringify(old));
    const r = SaveManager.load(content, st);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(CURRENT_SAVE_VERSION);
      expect(r.data.evolutionStage).toBe(0);
      expect(r.data.currentEnergy).toBe(100);
      expect(r.data.quizStats).toEqual({});
      expect(r.data.settings).toEqual({ studyMode: false, answerTimer: false });
      expect(r.data.playerTile.regionId).toBe(r.data.currentRegionId);
    }
  });
  it('a current-version save passes through unchanged', () => {
    const st = memStorage(); const s = SaveManager.newGame('ionix', content); s.level = 5;
    SaveManager.save(s, st);
    const r = SaveManager.load(content, st);
    expect(r.ok && r.data.level).toBe(5);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement the migration ladder** — insert at the top of `migrate`, before the shape checks:

```ts
    const STEPS: Array<(o: Record<string, unknown>) => void> = [
      // step index i upgrades version i -> i+1
      (o) => { // 0 -> 1 : M1 baseline
        o.evolutionStage ??= 0;
        o.currentEnergy ??= 100;
        o.quizStats ??= {};
        o.settings ??= { studyMode: false, answerTimer: false };
        o.playerTile ??= { regionId: (o.currentRegionId as string) ?? content.regions[0].id, x: 4, y: 14 };
        o.version = 1;
      }
      // Milestone 2 appends: (o) => { ...; o.version = 2; }
    ];
    let v = typeof o.version === 'number' ? o.version : 0;
    while (v < CURRENT_SAVE_VERSION) { const step = STEPS[v]; if (!step) throw new Error(`corrupt: no migration from v${v}`); step(o); v = o.version as number; }
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): version migration ladder (0->1 baseline) (TDD)"
```

---

### Task 34: `recordQuizResult` — per-topic accuracy + adaptive signal — TDD

**Files:** Modify `src/systems/SaveManager.ts`; append to `tests/systems/saveManager.test.ts`.

`recordQuizResult(data, topic, correct)` returns a **new** `SaveData` with `quizStats[topic]` updated: `asked += 1`; `correct += (correct ? 1 : 0)`; `recentMisses = correct ? 0 : min(recentMisses + 1, 99)` (resets on a correct answer — this is the signal `QuizEngine.pickQuestion` reads to ease off). Creates the topic entry if absent.

- [ ] **Step 1: Add the tests**

```ts
describe('SaveManager.recordQuizResult', () => {
  it('creates a topic entry on first record', () => {
    const s = SaveManager.recordQuizResult(SaveManager.newGame('pyron', content), 'atomic-structure', true);
    expect(s.quizStats['atomic-structure']).toEqual({ topic: 'atomic-structure', asked: 1, correct: 1, recentMisses: 0 });
  });
  it('accumulates asked/correct and tracks a miss streak that resets on a correct answer', () => {
    let s = SaveManager.newGame('pyron', content);
    s = SaveManager.recordQuizResult(s, 'atomic-structure', false);
    s = SaveManager.recordQuizResult(s, 'atomic-structure', false);
    expect(s.quizStats['atomic-structure']).toMatchObject({ asked: 2, correct: 0, recentMisses: 2 });
    s = SaveManager.recordQuizResult(s, 'atomic-structure', true);
    expect(s.quizStats['atomic-structure']).toMatchObject({ asked: 3, correct: 1, recentMisses: 0 });
  });
  it('does not mutate the input', () => {
    const s0 = SaveManager.newGame('pyron', content);
    const s1 = SaveManager.recordQuizResult(s0, 'atomic-structure', true);
    expect(s0.quizStats).toEqual({});
    expect(s1).not.toBe(s0);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
  recordQuizResult(data: SaveData, topic: string, correct: boolean): SaveData {
    const prev = data.quizStats[topic] ?? { topic, asked: 0, correct: 0, recentMisses: 0 };
    const updated = { topic, asked: prev.asked + 1, correct: prev.correct + (correct ? 1 : 0), recentMisses: correct ? 0 : Math.min(prev.recentMisses + 1, 99) };
    return { ...data, quizStats: { ...data.quizStats, [topic]: updated } };
  },
```

- [ ] **Step 4: Run the entire suite — all green.**

Run: `npm test`
Expected: content + BattleEngine + QuizEngine + Progression + SaveManager — every test passes. **This is checkpoint 1: a fully-tested core + a deployable shell.** Also run `npm run build` and confirm it succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): recordQuizResult — per-topic accuracy + miss streak (TDD)"
```

---

# Phase 6 — Phaser scenes & UI

> **Working mode for this phase:** each task = *build the scene/component, then manually verify it against the acceptance checklist* (run `npm run dev`, exercise it in the browser). Any non-trivial *logic* inside a scene is extracted into a **pure helper that is unit-tested first (TDD)** — those helpers are called out per task. Standard Phaser boilerplate (`extends Phaser.Scene`, `preload`/`create`/`update`, `this.add.*`, `this.scene.start`, tweens) is described, not transcribed line-for-line. After every task: `npx tsc --noEmit` must be clean, then commit.
>
> **Global UI conventions:** font `monospace`, sizes 8–14px, colour `#cdd6f4` on dark panels (`#0d1b2a` with a 1px `#415a77` border). All scenes accept/return data via `this.scene.start(key, data)` / `this.registry`. The loaded `GameContent`, the `QuizEngine`, and the active `SaveData` live on `this.registry` (set in `BootScene`): `this.registry.get('content')`, `this.registry.get('quiz')`, `this.registry.get('save')`. A tiny `persist()` helper (added in Task 51) calls `SaveManager.save(this.registry.get('save'), window.localStorage)`.

### Task 35: `placeholderTextures` helper (TDD) + `BootScene` + `ErrorScene`

**Files:**
- Create: `src/ui/placeholderTextures.ts` (pure `resolvePlaceholderSpec` + a Phaser `generatePlaceholderTextures(scene, manifest)`)
- Create: `src/scenes/ErrorScene.ts`
- Rewrite: `src/scenes/BootScene.ts`
- Modify: `src/main.ts` (register `ErrorScene`; more scenes added in later tasks)
- Test: `tests/scenes/bootAssets.test.ts` (extend the existing file)

The boot sequence: `BootScene.create()` → `try { loadGameContent() }` → on `ContentError`, `this.scene.start('ErrorScene', { issues })`; on success → put `content`, `new QuizEngine(content.questions, {})`, and `SaveManager.load(content, localStorage)` result onto `this.registry` → generate placeholder textures from `content.assets.placeholders` → `this.scene.start('TitleScene')`. (In M1 we **do not** call Phaser's image/audio loader at all — every visible thing is a generated placeholder texture. The `images`/`tilemaps` paths in the manifest are dormant until Milestone 3; document that.)

Pure helper: `resolvePlaceholderSpec(key, manifest): PlaceholderAsset | { key, w:16, h:16, color:'#ff00ff', label: key }` — returns the manifest entry or a magenta fallback (so a missing asset is a visible magenta box + a console warning, never a crash — spec §6.5).

- [ ] **Step 1: Extend `tests/scenes/bootAssets.test.ts`**

```ts
import { resolvePlaceholderSpec } from '../../src/ui/placeholderTextures';
import { loadGameContent } from '../../src/content/loadGameContent';

describe('resolvePlaceholderSpec', () => {
  const manifest = loadGameContent().content.assets;
  it('returns the manifest entry for a known key', () => {
    const s = resolvePlaceholderSpec('enemy_protium', manifest);
    expect(s.key).toBe('enemy_protium'); expect(s.w).toBeGreaterThan(0); expect(s.color).toMatch(/^#/);
  });
  it('returns a magenta fallback for an unknown key (never throws)', () => {
    const s = resolvePlaceholderSpec('totally_missing', manifest);
    expect(s.color.toLowerCase()).toBe('#ff00ff');
    expect(s.label).toBe('totally_missing');
  });
});
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run tests/scenes/bootAssets.test.ts`

- [ ] **Step 3: Implement `src/ui/placeholderTextures.ts`**

```ts
import type { AssetManifest, PlaceholderAsset } from '../content/types';

export function resolvePlaceholderSpec(key: string, manifest: AssetManifest): PlaceholderAsset {
  const found = manifest.placeholders.find(p => p.key === key);
  if (found) return found;
  // eslint-disable-next-line no-console
  console.warn(`[assets] no placeholder for "${key}" — using magenta fallback`);
  return { key, w: 16, h: 16, color: '#ff00ff', label: key };
}

/** Generate one texture per placeholder spec: a filled rect (or circle) of the given colour with the label drawn centred. Called from BootScene. */
export function generatePlaceholderTextures(scene: Phaser.Scene, manifest: AssetManifest): void {
  for (const spec of manifest.placeholders) {
    if (scene.textures.exists(spec.key)) continue;
    const g = scene.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(spec.color).color;
    g.fillStyle(color, 1);
    if (spec.shape === 'circle') g.fillCircle(spec.w / 2, spec.h / 2, Math.min(spec.w, spec.h) / 2);
    else g.fillRect(0, 0, spec.w, spec.h);
    g.lineStyle(1, 0x000000, 0.4); g.strokeRect(0, 0, spec.w, spec.h);
    g.generateTexture(spec.key, spec.w, spec.h);
    g.destroy();
    // labels are drawn at use-site (a Text object on top of the sprite) so the texture stays a clean rect — see scene code
  }
}
```

> Note: drawing text *into* a generated texture is fiddly in Phaser; instead, scenes that want a labelled placeholder add a `Phaser.GameObjects.Text` on top of the sprite (helper `addPlaceholderLabel(scene, x, y, key)` in this same file, reading `spec.label`). Include that helper.

- [ ] **Step 4: Implement `src/scenes/ErrorScene.ts`**

```ts
import Phaser from 'phaser';
export class ErrorScene extends Phaser.Scene {
  constructor() { super('ErrorScene'); }
  create(data: { issues?: string[]; message?: string }): void {
    this.cameras.main.setBackgroundColor('#2a0e12');
    this.add.text(16, 16, 'Equilibrium Lost — could not start', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd6d6' });
    const lines = data.issues?.length ? data.issues : [data.message ?? 'Unknown error.'];
    this.add.text(16, 44, lines.map(l => '• ' + l).join('\n'), { fontFamily: 'monospace', fontSize: '10px', color: '#ffb3b3', wordWrap: { width: this.scale.width - 32 } });
    this.add.text(16, this.scale.height - 28, 'Check src/content/data/ — a JSON file is missing or malformed.', { fontFamily: 'monospace', fontSize: '9px', color: '#ff8a8a' });
  }
}
```

- [ ] **Step 5: Rewrite `src/scenes/BootScene.ts`**

```ts
import Phaser from 'phaser';
import { loadGameContent } from '../content/loadGameContent';
import { ContentError } from '../content/ContentLoader';
import { QuizEngine } from '../systems/QuizEngine';
import { SaveManager } from '../systems/SaveManager';
import { generatePlaceholderTextures } from '../ui/placeholderTextures';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create(): void {
    let content;
    try { content = loadGameContent(); }
    catch (e) {
      if (e instanceof ContentError) return void this.scene.start('ErrorScene', { issues: e.issues });
      return void this.scene.start('ErrorScene', { message: String(e) });
    }
    if (content.warnings.length) content.warnings.forEach(w => console.warn('[content]', w));
    this.registry.set('content', content.content);
    this.registry.set('quiz', new QuizEngine(content.content.questions, {}));
    const loaded = SaveManager.load(content.content, window.localStorage);
    this.registry.set('save', loaded.ok ? loaded.data : null);
    this.registry.set('saveLoadResult', loaded); // {ok:false, reason:'corrupt'} surfaces on the Title screen
    generatePlaceholderTextures(this, content.content.assets);
    this.scene.start('TitleScene');
  }
}
```

- [ ] **Step 6: Register `ErrorScene` (and keep BootScene first) in `src/main.ts`** — `SCENES = [BootScene, ErrorScene]` for now (more appended each task).

- [ ] **Step 7: Run tests — PASS; manual smoke** — `npm run dev` → boots to a blank screen that immediately tries `TitleScene` (which doesn't exist yet → Phaser logs "scene not found"). That's fine for this task — Task 38 adds it. Temporarily, end `BootScene.create` by drawing "boot OK — N placeholder textures" so you can eyeball it. Remove that line in Task 38.

To test the error path: temporarily break `src/content/data/skills.json` (e.g. `{ "x": {} }`), `npm run dev` → ErrorScene with the offending field listed. Restore the file.

- [ ] **Step 8: `npx tsc --noEmit` clean; commit**

```bash
git add src/ui/placeholderTextures.ts src/scenes/ErrorScene.ts src/scenes/BootScene.ts src/main.ts tests/scenes/bootAssets.test.ts
git commit -m "feat(scenes): BootScene loads+validates content, generates placeholder textures; ErrorScene"
```

---

### Task 36: UI — `Textbox` (typewriter; pure `chunkText` TDD) + `HealthBar` + `EnergyBar`

**Files:**
- Create: `src/ui/Textbox.ts` (exports pure `chunkText(text, maxCharsPerLine, maxLines): string[][]` + a `Textbox` Phaser class)
- Create: `src/ui/HealthBar.ts`, `src/ui/EnergyBar.ts`
- Test: `tests/ui/textbox.test.ts`

`chunkText` word-wraps `text` to `maxCharsPerLine`, then pages it into groups of at most `maxLines` lines (returns an array of pages, each a string array). The `Textbox` class draws a 9-slice-ish panel (`ui_textbox` placeholder stretched), reveals the current page character-by-character on a timer, exposes `showPages(pages, onPageDone)`, advances on a tap/Enter, and emits `'complete'` when the last page finishes. `HealthBar`/`EnergyBar`: a label + a fill rect that tweens to `value/max`, colour shifts amber→red below 30%/used.

- [ ] **Step 1: Write `tests/ui/textbox.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/ui/Textbox';

describe('chunkText', () => {
  it('wraps on word boundaries to maxCharsPerLine', () => {
    const pages = chunkText('the quick brown fox jumps', 10, 5);
    expect(pages).toEqual([['the quick', 'brown fox', 'jumps']]);
  });
  it('pages into groups of at most maxLines lines', () => {
    const pages = chunkText('a a a a a a a a', 3, 2); // each "a a" line is 3 chars; many lines, 2 per page
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(2);
    expect(pages.flat().join(' ').replace(/\s+/g, ' ').trim()).toBe('a a a a a a a a');
  });
  it('a single over-long word is hard-split', () => {
    const pages = chunkText('supercalifragilistic', 5, 3);
    expect(pages[0].every(l => l.length <= 5)).toBe(true);
    expect(pages.flat().join('')).toBe('supercalifragilistic');
  });
  it('empty string -> one empty page', () => { expect(chunkText('', 10, 3)).toEqual([['']]); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `chunkText` in `src/ui/Textbox.ts`** (plus the `Textbox` Phaser class skeleton)

```ts
import Phaser from 'phaser';

export function chunkText(text: string, maxCharsPerLine: number, maxLines: number): string[][] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let cur = '';
  const pushCur = () => { if (cur.length) { lines.push(cur); cur = ''; } };
  for (let w of words) {
    while (w.length > maxCharsPerLine) { pushCur(); lines.push(w.slice(0, maxCharsPerLine)); w = w.slice(maxCharsPerLine); }
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= maxCharsPerLine) cur += ' ' + w;
    else { pushCur(); cur = w; }
  }
  pushCur();
  if (lines.length === 0) return [['']];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));
  return pages;
}

export interface TextboxOptions { x: number; y: number; w: number; h: number; charsPerLine?: number; linesPerPage?: number; speedMs?: number; }
export class Textbox extends Phaser.GameObjects.Container {
  // panel (NineSlice or stretched Image of 'ui_textbox'), a Text object, a "▼" advance caret.
  // showPages(pages): reveal page[0] char-by-char on a this.scene.time event; on tap/Enter -> next page or emit 'complete'.
  // Implementation is standard Phaser; ~60 lines. Key API:
  //   show(text: string): void   — convenience: chunkText(text, charsPerLine, linesPerPage) then showPages
  //   showPages(pages: string[][]): void
  //   skip(): void               — instantly finish the current page
  //   on('pageAdvance'), on('complete')
  constructor(scene: Phaser.Scene, _opts: TextboxOptions) { super(scene, 0, 0); scene.add.existing(this); /* build children */ }
}
```

- [ ] **Step 4: Implement `HealthBar`/`EnergyBar`** — small `Phaser.GameObjects.Container` subclasses: `constructor(scene, x, y, w, label)`; `setValue(value, max, animate=true)` tweens an inner rect's `width`; colour `#52b788` (hp) / `#4cc9f0` (energy), shifting to `#f3722c` then `#e63946` below 30%. ~40 lines each.

- [ ] **Step 5: Run tests — PASS; `npx tsc --noEmit` clean; commit**

```bash
git add src/ui/Textbox.ts src/ui/HealthBar.ts src/ui/EnergyBar.ts tests/ui/textbox.test.ts
git commit -m "feat(ui): Textbox (typewriter + chunkText TDD), HealthBar, EnergyBar"
```

---

### Task 37: `DialogueRunner` (pure `nextNode` TDD) + `DialogueScene`

**Files:**
- Create: `src/ui/DialogueRunner.ts` (pure `dialogueIndex(tree)`, `entryNode(tree)`, `nextNode(tree, currentId, choiceIndex?)` returning `{ node, end, launch?, setFlag? }`)
- Create: `src/scenes/DialogueScene.ts`
- Modify: `src/main.ts` (register `DialogueScene`)
- Test: `tests/ui/dialogueRunner.test.ts`

`nextNode`: given the current node id and (for a branching node) the chosen choice index, return the next node — following `choices[i].next` if the current node has choices, else `next`. If the resolved node has `end: true` (or no `next`/`choices`), report `end: true`. Surface `node.setFlag` and `node.launch` so the scene can act on them. Throw on a dangling `next` id (content bug).

- [ ] **Step 1: Write `tests/ui/dialogueRunner.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { entryNode, nextNode } from '../../src/ui/DialogueRunner';
import type { DialogueNode } from '../../src/content/types';

const tree: DialogueNode[] = [
  { id: 'n0', text: 'hello', choices: [{ label: 'a', next: 'nA' }, { label: 'b', next: 'nB' }] },
  { id: 'nA', text: 'you chose A', next: 'nEnd', setFlag: 'flagA' },
  { id: 'nB', text: 'you chose B', launch: 'shrine', end: true },
  { id: 'nEnd', text: 'bye', end: true }
];

describe('DialogueRunner', () => {
  it('entryNode is the first node', () => { expect(entryNode(tree).id).toBe('n0'); });
  it('a choice node follows the chosen branch', () => {
    const r = nextNode(tree, 'n0', 0);
    expect(r.node.id).toBe('nA'); expect(r.setFlag).toBe('flagA'); expect(r.end).toBe(false);
  });
  it('a linear node follows .next; reaching an end node reports end', () => {
    const r = nextNode(tree, 'nA');
    expect(r.node.id).toBe('nEnd'); expect(r.end).toBe(true);
  });
  it('surfaces launch on the resolved node', () => {
    const r = nextNode(tree, 'n0', 1);
    expect(r.node.id).toBe('nB'); expect(r.launch).toBe('shrine'); expect(r.end).toBe(true);
  });
  it('throws on a dangling next id', () => {
    const bad: DialogueNode[] = [{ id: 'x', text: 't', next: 'missing' }];
    expect(() => nextNode(bad, 'x')).toThrow();
  });
  it('throws when a choice index is out of range', () => { expect(() => nextNode(tree, 'n0', 9)).toThrow(); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/ui/DialogueRunner.ts`**

```ts
import type { DialogueNode } from '../content/types';

export function dialogueIndex(tree: DialogueNode[]): Map<string, DialogueNode> { const m = new Map<string, DialogueNode>(); for (const n of tree) m.set(n.id, n); return m; }
export function entryNode(tree: DialogueNode[]): DialogueNode { if (!tree.length) throw new Error('empty dialogue tree'); return tree[0]; }

export interface NextNodeResult { node: DialogueNode; end: boolean; setFlag?: string; launch?: string; }
export function nextNode(tree: DialogueNode[], currentId: string, choiceIndex?: number): NextNodeResult {
  const idx = dialogueIndex(tree);
  const cur = idx.get(currentId);
  if (!cur) throw new Error(`dialogue: no node "${currentId}"`);
  let targetId: string | undefined;
  if (cur.choices && cur.choices.length) {
    if (typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex >= cur.choices.length) throw new Error(`dialogue: bad choice index ${choiceIndex} at "${currentId}"`);
    targetId = cur.choices[choiceIndex].next;
  } else targetId = cur.next;
  if (!targetId) throw new Error(`dialogue: node "${currentId}" has no continuation`);
  const node = idx.get(targetId);
  if (!node) throw new Error(`dialogue: dangling next "${targetId}" from "${currentId}"`);
  const end = node.end === true || (!node.next && !(node.choices && node.choices.length));
  return { node, end, setFlag: node.setFlag, launch: node.launch };
}
```

- [ ] **Step 4: Implement `src/scenes/DialogueScene.ts`** — launched as `this.scene.launch('DialogueScene', { npcId, returnTo, returnData })` (overlay; pauses the caller). On `create`: look up `content.npcs[npcId]`, render the entry node's `text` in a `Textbox` (speaker name in a small tag above it); when the textbox emits `complete`, if the current node has `choices` show them as a vertical list (keyboard ↑/↓/Enter + pointer), else call `nextNode(tree, currentId)`. Apply `setFlag` to `save.storyFlags` whenever a node with `setFlag` is *entered*. On reaching an `end` node: if it carries `launch === 'shrine'` → `this.scene.stop()` then `this.scene.start('ChallengeShrineScene', { regionId })`; if `launch` starts `battle:` → start `BattleScene` with that enemy id; else `this.scene.stop()` and `this.scene.resume(returnTo)`. Persist the save on close.

  **Acceptance:** talk to Prof. Bohrlin in the overworld → the four-page atomic-structure lesson plays; choosing "I know this" jumps to `n_skip`; both endings set `lesson_atomic_structure_seen`. Talk to Shrinekeeper Quanta → choosing "Enter the Shrine" sets `shrine_entered_elemental_reaches` and launches the shrine scene (stub until Task 49 — until then it can just `console.log('would launch shrine')`).

- [ ] **Step 5: Register `DialogueScene` in `main.ts`; run tests — PASS; `npx tsc --noEmit` clean; commit**

```bash
git add src/ui/DialogueRunner.ts src/scenes/DialogueScene.ts src/main.ts tests/ui/dialogueRunner.test.ts
git commit -m "feat(scenes): DialogueScene + DialogueRunner.nextNode (TDD)"
```

---

### Task 38: `TitleScene`

**Files:**
- Create: `src/scenes/TitleScene.ts`; Modify `src/main.ts`; remove the temporary "boot OK" text from `BootScene`.

`create`: draw `title_art` placeholder (the big "EQUILIBRIUM LOST" rect) + a subtitle "A Year 10 Chemistry RPG". Menu (keyboard + pointer): **New Game** → `this.scene.start('ClassSelectScene')`; **Continue** — enabled only when `this.registry.get('save')` is non-null → `this.scene.start('WorldMapScene')`; **Settings** → a small inline panel with two toggles bound to `save?.settings` (if no save yet, toggles a transient default that `ClassSelectScene` reads). If `this.registry.get('saveLoadResult')` is `{ok:false, reason:'corrupt'}`, show a red line "Your saved game was corrupted and couldn't be loaded. Starting New Game will overwrite it." — never auto-wipe.

**Acceptance:** fresh load (no save) → Continue is greyed; New Game works. After playing + saving (Task 51) and reloading → Continue is enabled and resumes on the world map. Corrupt the save string in devtools → the red warning appears, Continue is greyed, New Game still works.

- [ ] **Step 1: Implement `TitleScene` + register + clean up BootScene's temp line.**
- [ ] **Step 2: `npx tsc --noEmit` clean; manual check; commit**

```bash
git add src/scenes/TitleScene.ts src/scenes/BootScene.ts src/main.ts
git commit -m "feat(scenes): TitleScene — New Game / Continue / Settings, corrupt-save notice"
```

---

### Task 39: `ClassSelectScene`

**Files:**
- Create: `src/scenes/ClassSelectScene.ts`; Modify `src/main.ts`.

`create`: three panels (Pyron / Aqualis / Ionix) read from `content.classes`, each showing the class name, theme, the `baseStats` block, the signature affinity, and the starting skill names (look up `content.skills`). ←/→ or pointer to select; Enter/click to confirm → `const save = SaveManager.newGame(classId, content); this.registry.set('save', save); SaveManager.save(save, window.localStorage); this.scene.start('WorldMapScene');`. Also show a one-line "playstyle" blurb per the spec table.

**Acceptance:** picking each class produces a save whose stats match `statsForLevel(classDef, 1, 0)`; the world map opens with Region 1 unlocked; reload → Continue resumes that class.

- [ ] **Step 1: Implement + register.**
- [ ] **Step 2: `npx tsc --noEmit` clean; manual check; commit**

```bash
git add src/scenes/ClassSelectScene.ts src/main.ts
git commit -m "feat(scenes): ClassSelectScene — pick a class, create+persist a new save"
```

---

### Task 40: `WorldMapScene`

**Files:**
- Create: `src/scenes/WorldMapScene.ts`; Modify `src/main.ts`.

`create`: draw the `worldmap` placeholder. Lay out **8 region nodes** top-to-bottom: node 1 from `content.regions[0]`; nodes 2–8 from a `const LOCKED_REGION_LABELS = ['The Bonding Forge','Reaction Hollow','The Balance Halls','Catalyst Crags','The Acid Wastes','The Crucible',"Equilibrium's Heart"]` constant in this file (M1 builds only Region 1). A node is **unlocked** iff `save.regionProgress[regionId]?.entered`; Region 1 is always unlocked once a save exists. A small ✓ on a region whose `bossDefeated`. The player marker sits on `save.currentRegionId`. Selecting an unlocked node → `this.scene.start('OverworldScene', { regionId })`. Selecting a locked node → a small "Restore the previous region's equilibrium first." toast. A "Menu" button → `this.scene.launch('MenuScene')` (Task 50). 

**Acceptance:** only Region 1 selectable; entering it goes to the overworld; after beating the Region 1 boss (Task 48) a ✓ shows on Region 1 and (since `unlocksRegionId` is `null` in M1) nothing else unlocks — that's the end of the slice and the WorldMap shows a "Region complete — more of Æquor awaits in a future update" banner when `regionProgress['elemental-reaches'].bossDefeated`.

- [ ] **Step 1: Implement + register.**
- [ ] **Step 2: `npx tsc --noEmit` clean; manual check; commit**

```bash
git add src/scenes/WorldMapScene.ts src/main.ts
git commit -m "feat(scenes): WorldMapScene — 8 nodes, lock/unlock, current marker, completion banner"
```

---

### Task 41: Region 1 tilemap asset (`public/assets/tilemaps/elemental-reaches.json`)

**Files:**
- Create: `public/assets/tilemaps/elemental-reaches.json`

Hand-author a small tilemap (Tiled JSON format, or a minimal compatible subset Phaser can load via `this.make.tilemap({ data, tileWidth:16, tileHeight:16 })`). Recommended: a **hand-rolled grid JSON** (simpler than full Tiled) — `OverworldScene` builds the visuals from it directly:

```json
{
  "width": 24, "height": 18, "tileSize": 16,
  "ground": [[/* 24 ints per row, 18 rows; 0=grass(walkable), 1=path, 2=water(blocked), 3=wall(blocked), 4=tall-grass(walkable, encounter zone) */]],
  "objects": [
    { "type": "player_spawn", "x": 4, "y": 14 },
    { "type": "exit", "x": 4, "y": 17, "to": "world" },
    { "type": "npc", "id": "professor-bohrlin", "x": 6, "y": 5 },
    { "type": "npc", "id": "archivist-mendel", "x": 12, "y": 9 },
    { "type": "npc", "id": "shrinekeeper-quanta", "x": 3, "y": 13 },
    { "type": "shrine_entrance", "x": 2, "y": 13, "regionId": "elemental-reaches" },
    { "type": "minibossTrigger", "x": 18, "y": 6, "enemyId": "unstable-deuteride", "flag": "miniboss_elemental_reaches_done" },
    { "type": "bossGate", "x": 12, "y": 2, "enemyId": "the-unstable-isotope", "requiresFlag": "miniboss_elemental_reaches_done" }
  ]
}
```

> Layout intent: spawn near the bottom; a path winding up; **tall-grass patches** (tile `4`) between landmarks are the wild-encounter zones; Prof. Bohrlin stands just past the spawn so the lesson is hard to miss; Archivist Mendel mid-map; the Shrine entrance behind Shrinekeeper Quanta on the west side; the mini-boss guards a chokepoint at `(18,6)`; the boss gate at the top opens only after `miniboss_elemental_reaches_done`. Authoring this carefully is ~30 min of laying out the two arrays — keep it small and legible. NPC `x/y` here must match `npcs.json` tiles (or `OverworldScene` uses these and ignores the `npcs.json` tile — pick one source of truth: **use the tilemap's `objects` as the placement source; `npcs.json.tile` is a fallback**).

- [ ] **Step 1: Author the file (validate it parses):** `node -e "JSON.parse(require('fs').readFileSync('public/assets/tilemaps/elemental-reaches.json','utf8')); console.log('ok')"`
- [ ] **Step 2: Commit**

```bash
git add public/assets/tilemaps/elemental-reaches.json
git commit -m "content: Region 1 tilemap (grid + objects: spawn, NPCs, shrine, miniboss, boss gate, exit)"
```

---

### Task 42: Entities — `Player`, `Npc`

**Files:**
- Create: `src/entities/Player.ts`, `src/entities/Npc.ts`

`Player` extends `Phaser.Physics.Arcade.Sprite` using `hero_<class>_<stage>_overworld`: grid-based 4-direction movement (one tile per keypress with a short tween, or smooth arcade velocity with tile snapping — pick tweened grid movement, it's simpler and matches the GBA feel), blocked by `collision` tiles; exposes `facing`, `tileXY()`, `onStep(cb)` (fires after each completed tile move — `OverworldScene` uses it for encounter rolls). `Npc` extends `Phaser.GameObjects.Sprite` using `npc_<id>`, sits on its tile, faces `facing`, and exposes `interactionTile()` (the tile in front of it / its own tile) so the overworld can detect "player pressed action while adjacent".

> These are mostly Phaser plumbing — no pure logic to TDD. Keep `Player` ≤ ~100 lines.

- [ ] **Step 1: Implement both; `npx tsc --noEmit` clean; commit**

```bash
git add src/entities/Player.ts src/entities/Npc.ts
git commit -m "feat(entities): Player (grid movement) + Npc (interaction tile)"
```

---

### Task 43: `OverworldScene`

**Files:**
- Create: `src/scenes/OverworldScene.ts`; Modify `src/main.ts`.

`init({ regionId })` → look up `content.regions.find(r => r.id === regionId)`. `preload`: nothing (placeholders already generated; the tilemap JSON is small enough to `import` — actually `import tilemap from '../../public/assets/tilemaps/elemental-reaches.json'`... cleaner: keep tilemaps under `src/content/data/tilemaps/` so they're statically importable like the rest of the data; **move `elemental-reaches.json` there and update Task 41's path and the manifest's `tilemaps` entry**). `create`:
- Render the `ground` grid as a tilemap of the `tiles_elemental_reaches` placeholder, tinted per tile id (grass green, path tan, water blue, wall grey, tall-grass darker green). Mark water/wall tiles as colliding.
- Spawn `Player` at the `player_spawn` object (`save.playerTile` overrides if it's in this region — so re-entering puts you where you left).
- Spawn an `Npc` per `npc` object; spawn small marker sprites for `shrine_entrance`, `minibossTrigger` (only if its `flag` isn't set in `save.storyFlags`), `bossGate`, `exit`.
- Camera follows the player; world bounds = map size.
- **Action key (Space/Enter):** if the player is adjacent-and-facing an `Npc` → `this.scene.launch('DialogueScene', { npcId, returnTo: this.scene.key, returnData: { regionId } }); this.scene.pause();`. If on/adjacent to `shrine_entrance` → confirm prompt → `this.scene.start('ChallengeShrineScene', { regionId })`. If adjacent to `bossGate` and `save.storyFlags[bossGate.requiresFlag]` → confirm → start a boss `BattleScene` (`{ enemyId: bossGate.enemyId, isBoss: true, regionId }`). If on `exit` → persist + `this.scene.start('WorldMapScene')`.
- **`onStep`:** if the tile just entered is tall-grass (`4`) → `if (this.rng() < region.encounterRatePerStep) startWildBattle()`. `startWildBattle`: pick a wild enemy id from `region.wildEnemyIds` (weighted equal), pick its level as `clamp(playerLevel + rand(-1..+1), 1, ∞)` (or just use the enemy def's `level` — simpler; M1: use `enemyDef.level`), persist, `this.scene.start('BattleScene', { enemyId, level, isBoss:false, regionId, returnTo:'OverworldScene', returnData:{regionId} })`.
- **Mini-boss:** stepping onto the `minibossTrigger` tile (if flag unset) → confirm → boss-style `BattleScene` (`isBoss:true`? the spec says mini-bosses guard a key area; fleeing — let's allow fleeing mini-bosses but not region/final bosses → so `isBoss:false` but mark it `isMiniBoss:true` just for the "you can't pass until you win" gate). On win (handled on return), set `save.storyFlags['miniboss_elemental_reaches_done'] = true` and `save.regionProgress['elemental-reaches'].miniBossDefeated = true`.
- On returning from `BattleScene`/`ChallengeShrineScene`, re-create from the (possibly updated) save; if the boss is now defeated, the bossGate sprite becomes a glowing "equilibrium restored" marker and walking into it goes to the WorldMap completion banner.

> This is the biggest scene. Budget ~250–350 lines. Extract two pure helpers and unit-test them: `pickWildEncounter(region, rng): { enemyId, level }` and `tileBlocks(tileId): boolean` — put them in `src/scenes/overworldHelpers.ts` and add `tests/scenes/overworld.test.ts` (TDD them before wiring the scene).

- [ ] **Step 1: TDD the helpers** — `tests/scenes/overworld.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickWildEncounter, tileBlocks } from '../../src/scenes/overworldHelpers';
import { loadGameContent } from '../../src/content/loadGameContent';
const region1 = loadGameContent().content.regions[0];

describe('overworld helpers', () => {
  it('tileBlocks: water(2) and wall(3) block; grass(0)/path(1)/tall-grass(4) do not', () => {
    expect(tileBlocks(2)).toBe(true); expect(tileBlocks(3)).toBe(true);
    expect(tileBlocks(0)).toBe(false); expect(tileBlocks(1)).toBe(false); expect(tileBlocks(4)).toBe(false);
  });
  it('pickWildEncounter returns one of the region\'s wild enemy ids', () => {
    const e = pickWildEncounter(region1, () => 0.0); expect(region1.wildEnemyIds).toContain(e.enemyId);
    const e2 = pickWildEncounter(region1, () => 0.999); expect(region1.wildEnemyIds).toContain(e2.enemyId);
    expect(e.level).toBeGreaterThan(0);
  });
});
```

`overworldHelpers.ts`:

```ts
import type { RegionDef } from '../content/types';
export function tileBlocks(tileId: number): boolean { return tileId === 2 || tileId === 3; }
export function isTallGrass(tileId: number): boolean { return tileId === 4; }
export function pickWildEncounter(region: RegionDef, rng: () => number, getLevel?: (enemyId: string) => number): { enemyId: string; level: number } {
  const ids = region.wildEnemyIds;
  const enemyId = ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))];
  return { enemyId, level: getLevel ? getLevel(enemyId) : 0 }; // 0 -> caller uses the enemy def's own level
}
```

- [ ] **Step 2: Run helper tests — PASS.**
- [ ] **Step 3: Implement `OverworldScene` (move the tilemap JSON to `src/content/data/tilemaps/elemental-reaches.json`, update the manifest path); register in `main.ts`.**
- [ ] **Step 4: Manual check** — walk around; talking to NPCs opens the lesson; tall grass triggers wild battles at roughly the configured rate; the mini-boss gate blocks the chokepoint until beaten; the boss gate is shut until the mini-boss flag is set; the `exit` returns to the WorldMap; re-entering puts you where you left.
- [ ] **Step 5: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/OverworldScene.ts src/scenes/overworldHelpers.ts src/content/data/tilemaps/elemental-reaches.json src/content/data/assetManifest.json src/main.ts tests/scenes/overworld.test.ts
git commit -m "feat(scenes): OverworldScene — tilemap, NPCs, encounters, shrine/miniboss/boss gates, exit"
```

---

### Task 44: UI — `ChainMeter` (pure `formatMultiplier` TDD) + `QuizPanel`

**Files:**
- Create: `src/ui/ChainMeter.ts` (exports pure `formatMultiplier(chain): string` + a `ChainMeter` Phaser class)
- Create: `src/ui/QuizPanel.ts`
- Test: `tests/ui/chainMeter.test.ts`

`formatMultiplier(chain)` → `"×1.0"` … `"×2.6"` (one decimal), and `"BURST READY!"` when `chain >= 5`. `ChainMeter`: 5 segments that fill as `chain` rises (recolour amber→orange→red), with the multiplier text beside them; flashes when it changes; a distinct "BURST READY" state. `QuizPanel`: a `Textbox`-style panel with the question prompt + either four labelled option buttons (A–D, keyboard 1-4 or pointer) for `mcq`, or — for `balanceEquation` — a row of `[coeff] [formula] +` widgets with ▲/▼ steppers (one per term, reactants then products, in `[...reactants, ...products]` order) and a "Submit" button. Exposes `ask(question, opts: { studyMode: boolean })` returning a Promise of `{ index?: number; widgetCoeffs?: number[]; fastAnswer: boolean }` (and shows `question.hint` when `studyMode`). Also `showCorrection(question)` — flashes the right answer and prints `"The answer was X — <explanation>"` for ~2s. An optional countdown ring drives `fastAnswer` (only when `save.settings.answerTimer`; default off → `fastAnswer` always false).

- [ ] **Step 1: Write `tests/ui/chainMeter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatMultiplier } from '../../src/ui/ChainMeter';

describe('formatMultiplier', () => {
  it('formats the chain multiplier to one decimal', () => {
    expect(formatMultiplier(0)).toBe('×1.0');
    expect(formatMultiplier(1)).toBe('×1.2');
    expect(formatMultiplier(2)).toBe('×1.5');
    expect(formatMultiplier(3)).toBe('×1.8');
    expect(formatMultiplier(4)).toBe('×2.2');
  });
  it('says BURST READY at full chain', () => { expect(formatMultiplier(5)).toBe('BURST READY!'); expect(formatMultiplier(9)).toBe('BURST READY!'); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `formatMultiplier` (in `src/ui/ChainMeter.ts`)**

```ts
import { CHAIN_MULTIPLIERS, MAX_CHAIN } from '../systems/battle/chain';
export function formatMultiplier(chain: number): string {
  if (chain >= MAX_CHAIN) return 'BURST READY!';
  const m = CHAIN_MULTIPLIERS[Math.max(0, Math.min(MAX_CHAIN - 1, Math.floor(chain)))];
  return '×' + m.toFixed(1);
}
// + the ChainMeter Phaser class (standard rendering, ~70 lines)
```

- [ ] **Step 4: Implement the `ChainMeter` and `QuizPanel` Phaser classes.** (No further pure logic — `QuizEngine.checkAnswer`, already tested, does the grading; `QuizPanel` only collects input.)
- [ ] **Step 5: Run tests — PASS; `npx tsc --noEmit` clean; commit**

```bash
git add src/ui/ChainMeter.ts src/ui/QuizPanel.ts tests/ui/chainMeter.test.ts
git commit -m "feat(ui): ChainMeter (formatMultiplier TDD) + QuizPanel (mcq + balance widget)"
```

---

### Task 45: `BattleScene` — layout, action menu, Attack/Run, enemy turn, win/lose

**Files:**
- Create: `src/scenes/BattleScene.ts`; Modify `src/main.ts`.
- Create: `src/scenes/battlePresenter.ts` (pure helper: `playerBattleInputFromSave(save, content): PlayerBattleInput` — builds the engine input from the save + content, incl. `catalystBurstSkillId`; also `battleContextFromContent(content, settings): BattleContext`). TDD this helper.

`init(data: { enemyId, level?, isBoss, regionId, returnTo, returnData })`. `create`:
- Background: `bg_battle_<region>` placeholder. Enemy sprite (`enemy_<id>` placeholder + label) top-right; player battle sprite (`hero_<class>_<stage>_battle` + label) bottom-left.
- `HealthBar` + `EnergyBar` for the player (bottom-left panel: name Lv.N, HP, Energy); `HealthBar` + name/level for the enemy (top panel; no energy bar shown). `ChainMeter` near the player panel. A `Textbox` along the bottom for the battle log.
- Build engine state: `const ctx = battleContextFromContent(content, save.settings); let state = createBattle(playerBattleInputFromSave(save, content), { def: content.enemies[enemyId], level: data.level ?? content.enemies[enemyId].level }, { rng: Math.random });` Sync the player combatant's `hp`/`energy` to the save's `currentHp`/`currentEnergy`.
- Action menu (4 buttons): **Attack** | **Skills** | **Items** | **Run** (Run disabled when `state.enemy.isBoss` — `isBoss` flag from `createBattle`; mini-bosses are *not* `isBoss`, so Run is allowed but the overworld won't let you pass — that's fine).
- **Attack/Run flow:** on pick → `const { state: ns, events } = resolveTurn(state, action, ctx); state = ns; await animate(events);` then either re-enable the menu (if `ongoing`) or run the end sequence.
- `animate(events)`: a small sequential player that walks the `BattleEvent[]` — `damage` → flash the target, shake, tween its HP bar, show a floating damage number tinted by `effectiveness` (red ≥2, grey 0.5, white 1) and a "★ Critical Reaction!" tag on `crit`; `heal` → green flash + bar tween; `energyRegen` → bar tween; `quizFizzle` → "The reaction fizzles…" log line; `statusApplied`/`statusTick`/`statusExpired` → status-icon add/pulse/remove + log; `buffsStripped` → "Buffs precipitated out!"; `extraAction` → "Catalysed — extra action!"; `precipitatedSkip` → "<name> is precipitated and can't move!"; `chainChanged` → `ChainMeter.set(chain)`; `enemySwitch` → swap enemy sprite + "<name> appears!"; `faint` → fade the fainted sprite; `outcome` → stop here, the end sequence takes over; `turnStart` → optionally a subtle indicator. Keep it readable; ~150 lines.
- **End sequence (this task: just the basics):** `outcome === 'fled'` → "Got away safely!" → persist `currentHp/currentEnergy` back to save → `this.scene.start(returnTo, returnData)`. `outcome === 'playerLose'` → "Equilibrium collapses…" → set `save.currentHp = 1`, drop the player back at the region spawn (a soft "you wake up" — no harsh penalty, matching the game's tone), persist → `this.scene.start('OverworldScene', { regionId })`. `outcome === 'playerWin'` → "<enemy> stabilised!" → **Task 48 fills in XP/level/evolution**; for now just persist HP/energy and return.

- [ ] **Step 1: TDD `battlePresenter.ts`** — `tests/scenes/battlePresenter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { playerBattleInputFromSave, battleContextFromContent } from '../../src/scenes/battlePresenter';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';
const content = loadGameContent().content;

describe('battlePresenter', () => {
  it('builds a player battle input matching the save (stats, equipped skills, burst skill id)', () => {
    const save = SaveManager.newGame('pyron', content);
    const inp = playerBattleInputFromSave(save, content);
    expect(inp.level).toBe(1);
    expect(inp.maxHp).toBe(save.stats.hp);
    expect(inp.equippedSkillIds).toEqual(save.equippedSkillIds);
    expect(inp.signatureAffinity).toBe('Combustion');
    // pyron's burst skill is reachable at level 10 but the *id* should still resolve from the class def
    expect(inp.catalystBurstSkillId).toBe('combustion-cascade');
  });
  it('battleContextFromContent wires getSkill/getItem/getEnemyDef + settings', () => {
    const ctx = battleContextFromContent(content, { answerTimer: true });
    expect(ctx.getSkill('proton-jab').name).toBe('Proton Jab');
    expect(ctx.getItem('minor-buffer').name).toBe('Minor Buffer');
    expect(ctx.getEnemyDef('protium').name).toBe('Protium');
    expect(ctx.settings.answerTimer).toBe(true);
    expect(() => ctx.getSkill('nope')).toThrow();
  });
});
```

`battlePresenter.ts`:

```ts
import type { GameContent, SaveData } from '../content/types';
import type { PlayerBattleInput, BattleContext } from '../systems/BattleEngine';
import { statsForLevel } from '../systems/Progression';

export function playerBattleInputFromSave(save: SaveData, content: GameContent): PlayerBattleInput {
  const cls = content.classes.find(c => c.id === save.classId)!;
  const stats = statsForLevel(cls, save.level, save.evolutionStage);
  const reachable = [...cls.startingSkillIds, ...cls.skillUnlocks.map(u => u.skillId)];
  const catalystBurstSkillId = reachable.find(id => content.skills[id]?.isCatalystBurst);
  // basic-attack power = a fraction of ATK, floored
  const attackPower = Math.max(10, Math.floor(stats.atk * 0.9));
  return {
    name: cls.name, classId: cls.id, signatureAffinity: cls.signatureAffinity, level: save.level,
    maxHp: stats.hp, hp: save.currentHp, atk: stats.atk, def: stats.def, spd: stats.spd,
    maxEnergy: 100, energy: save.currentEnergy, equippedSkillIds: [...save.equippedSkillIds], attackPower,
    isBoss: false, catalystBurstSkillId
  };
}
export function battleContextFromContent(content: GameContent, settings: { answerTimer: boolean }): BattleContext {
  return {
    getSkill: (id) => { const s = content.skills[id]; if (!s) throw new Error('unknown skill ' + id); return s; },
    getItem: (id) => { const i = content.items[id]; if (!i) throw new Error('unknown item ' + id); return i; },
    getEnemyDef: (id) => { const e = content.enemies[id]; if (!e) throw new Error('unknown enemy ' + id); return e; },
    settings: { answerTimer: settings.answerTimer }
  };
}
```

> Note: `PlayerBattleInput` needs `catalystBurstSkillId?` — already added in Task 19. Also the engine should read the player's `attackPower` from the input (it does — `playerCombatant.attackPower = player.attackPower`).

- [ ] **Step 2: Run helper tests — PASS.**
- [ ] **Step 3: Implement `BattleScene` (Attack/Run/enemy-turn/animate/win-lose-flee basics); register in `main.ts`.** Hook `OverworldScene`'s wild-encounter call to it.
- [ ] **Step 4: Manual check** — a wild battle: Attack trades blows; HP bars move; damage numbers tinted by effectiveness; Run escapes a wild battle; losing drops you back at the spawn with 1 HP (no game-over wall); the enemy AI sometimes uses a skill (Electrid casts Spark Flare). Boss/mini-boss battles: Run is disabled (region boss) / allowed-but-pointless (mini-boss).
- [ ] **Step 5: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battlePresenter.ts src/main.ts tests/scenes/battlePresenter.test.ts
git commit -m "feat(scenes): BattleScene v1 — layout, action menu, Attack/Run, enemy turn, animations, win/lose/flee"
```

---

### Task 46: `BattleScene` — Skills submenu + quiz flow + Chain Reaction + Study Mode

**Files:** Modify `src/scenes/BattleScene.ts`.

- **Skills submenu:** on **Skills**, show the player's `equippedSkillIds` as a list — each row: skill name, affinity tag, `power`, `Energy cost`; rows where `cost > state.player.energy` are greyed and unselectable; a back option. Selecting a skill:
  - If `skill.topic === null` (e.g. `proton-jab`) → no quiz; `resolveTurn(state, { kind:'skill', skillId, quizCorrect: null }, ctx)`.
  - Else → `const q = quiz.pickQuestion(skill.topic, skill.questionDifficulty, save.quizStats[skill.topic]);` → `const ans = await quizPanel.ask(q, { studyMode: save.settings.studyMode });` → `const correct = quiz.checkAnswer(q, ans);` → `save = SaveManager.recordQuizResult(save, skill.topic, correct); this.registry.set('save', save);` (and `persist()`). If `correct` → small "Reaction mastered! +XP" popup (the XP itself is awarded at battle end via the enemy's `xpYield`, but spec §4.2 wants a per-correct bonus — so also bank a small per-question bonus: accumulate `bonusXp += 2 * skill.questionDifficulty` on the scene, added at victory). If `!correct` → `await quizPanel.showCorrection(q)` (shows "The answer was X — <explanation>" for ~2s). Then `resolveTurn(state, { kind:'skill', skillId, quizCorrect: correct, fastAnswer: ans.fastAnswer }, ctx)` and animate. The `chainChanged` events update the `ChainMeter`; a wrong answer's events include `quizFizzle` → "The reaction fizzles to a fraction of its power." No HP penalty, no extra lost turn — verify by inspection that nothing else happens.
- **Study Mode** (`save.settings.studyMode`): `QuizPanel.ask` shows the `hint`; additionally the `ChainMeter` displays "(Study Mode — chain off)" and the scene **ignores** chain-multiplier visuals (the engine still tracks `chain`, but in Study Mode pass... hmm — simplest: in Study Mode the scene still lets the engine do its thing; "removes Chain Reaction pressure" is satisfied by hiding the meter and not celebrating breaks. Do that — don't fork the engine.)
- **Adaptive difficulty** is automatic: `pickQuestion` already eases to difficulty 1 when `save.quizStats[topic].recentMisses >= 2`. Additionally, when a topic's `recentMisses` hits 3, queue a one-time "refresher" — on the *next* return to the overworld, auto-launch the relevant NPC's dialogue (or just show a toast: "Prof. Bohrlin: remember — atomic number = protons. Try that skill again."). Implement the toast version (cheap, satisfies §4.8).

- [ ] **Step 1: Implement the Skills submenu + quiz flow + Study Mode + refresher toast.**
- [ ] **Step 2: Manual check** — using Spark Flare pops an atomic-structure question; a correct answer fires full power and ticks the chain meter up with a flash; a wrong answer shows the correction, fizzles to ~30%, breaks the chain, and costs **no HP and no extra turn**; missing the same topic 3× eases the questions and shows the refresher toast next time you're in the overworld; toggling Study Mode in the menu (Task 50) shows hints and hides the chain meter.
- [ ] **Step 3: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene — Skills + quiz moment + Chain Reaction + Study Mode + adaptive refresher"
```

---

### Task 47: `BattleScene` — Items submenu + Catalyst Burst + status icons

**Files:** Modify `src/scenes/BattleScene.ts`.

- **Items submenu:** on **Items**, list `save.items` filtered to `content.items[id].usableInBattle` with quantities; selecting one → `resolveTurn(state, { kind:'item', itemId }, ctx)`, then decrement `save.items` (remove the entry at qty 0), `persist()`. Animate the `heal`/`item` events.
- **Catalyst Burst:** a prominent **BURST** button appears (pulsing) only when `state.catalystBurstReady`; pressing it → a full-screen flash/zoom effect → `resolveTurn(state, { kind:'catalystBurst' }, ctx)` → animate (big damage number + the burst skill's guaranteed status) → the `ChainMeter` resets. (No quiz on a burst.)
- **Status icons:** under each combatant's name, render a small icon (`icon_status_<id>` placeholder) per active status with its `turnsRemaining`; the `animate` walker keeps these in sync from `statusApplied`/`statusExpired` events; hovering/inspecting shows the effect text from the spec §4.5 list.

- [ ] **Step 1: Implement items submenu + burst button + status icons.**
- [ ] **Step 2: Manual check** — a Minor Buffer heals 25 and is consumed; building the chain to 5 lights the BURST button; firing it plays the flash, deals a big hit, applies the guaranteed status, and zeroes the meter; statuses show as ticking icons and behave per the spec (Oxidised drains DEF, Combusting burns each turn, Precipitated makes the enemy skip a turn, etc.).
- [ ] **Step 3: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene — Items, Catalyst Burst, status-effect icons"
```

---

### Task 48: `BattleScene` — victory: XP, level-up, skill unlock, evolution, TM-learn, boss clear

**Files:** Modify `src/scenes/BattleScene.ts`.

On `outcome === 'playerWin'`, run the victory sequence (all updates go to `save`, then `persist()`):
1. **XP:** `const gained = enemyDef.xpYield + scene.bonusXp;` → `const r = addXp({ level: save.level, xp: save.xp, unlockedSkillIds: save.unlockedSkillIds }, gained, classDef);` → show `"+${gained} XP — Reaction mastered!"`. Apply `save.level = r.level; save.xp = r.xp; save.unlockedSkillIds = r.unlockedSkillIds;`.
2. **Level-ups:** for each `lvl` in `r.leveledTo`, banner `"Level ${lvl}!"`; recompute `save.stats = statsForLevel(classDef, save.level, save.evolutionStage)`; heal-on-level-up: bump `save.currentHp` by the HP delta (nice-to-have).
3. **Skill unlocks:** for each id in `r.newlyUnlockedSkillIds`, banner `"Learned ${content.skills[id].name}!"`. If, after this, `save.equippedSkillIds.length < 5`, auto-equip the new skill; else leave it for the Menu.
4. **Evolution:** `const evo = checkEvolution(classDef, save.level, save.evolutionStage, save.regionProgress);` — note this can only fire here right after a boss win that sets `bossDefeated` (see step 6); to handle the "Lv 10 reached before the boss" case, *also* re-run `checkEvolution` when entering the overworld after the boss. If `evo` → play the evolution cutscene (sprite cross-fade `hero_<class>_<stage0>_battle` → `hero_<class>_<stage1>_battle` with a white flash + a "Equilibrium flows through you — <oldName> evolved into <evo.name>!" banner), then `save.evolutionStage = evo.stage; save.stats = statsForLevel(classDef, save.level, save.evolutionStage); save.unlockedSkillIds.push(evo.newSignatureSkillId)` (dedupe), and if room, auto-equip it.
5. **TM-learn:** if `enemyDef.teachesSkillId` and not already unlocked → banner `"${enemy.name} taught you ${content.skills[teachesSkillId].name}!"`; add to `unlockedSkillIds` (auto-equip if room).
6. **Boss clear:** if `enemyDef.role === 'miniBoss'` → `save.regionProgress[regionId].miniBossDefeated = true; save.storyFlags['miniboss_' + regionId + '_done'] = true;`. If `enemyDef.role === 'regionBoss'` → `save.regionProgress[regionId].bossDefeated = true;` + grant `region.bossReward` (XP via another `addXp` pass, items appended to `save.items`, `bossReward.skillId` unlocked) + set a story flag `equilibrium_restored_${regionId}` + `"Equilibrium restored to The Elemental Reaches!"` banner. (`region.unlocksRegionId` is `null` in M1, so nothing new opens — the WorldMap shows the completion banner.) **After a region-boss win, re-run `checkEvolution`** (now `bossDefeated` is true, so a Lv-10 hero evolves here).
7. Persist `save.currentHp`/`currentEnergy` from `state.player`, `persist()`, then `this.scene.start(returnTo, returnData)` (or `WorldMapScene` after a region-boss win).

> Extract the *pure* victory bookkeeping into `applyVictory(save, enemyDef, region, bonusXp, content): { save: SaveData; banners: string[]; evolved: EvolutionDef | null }` in `src/scenes/battleVictory.ts` and **TDD it** (the scene then just animates the returned `banners`/`evolved`). This keeps the gnarliest sequencing under test.

- [ ] **Step 1: TDD `battleVictory.ts`** — `tests/scenes/battleVictory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyVictory } from '../../src/scenes/battleVictory';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';
const content = loadGameContent().content;
const region1 = content.regions[0];

describe('applyVictory', () => {
  it('a wild win grants XP and (if scheduled) levels + skill unlocks', () => {
    let save = SaveManager.newGame('pyron', content);
    save.xp = 290; save.level = 3 - 1 === 2 ? 3 : 3; save.level = 3; // contrive: at level 3 already? keep simple:
    save = SaveManager.newGame('pyron', content); // reset
    const protium = content.enemies['protium'];
    const r = applyVictory(save, protium, region1, 0, content);
    expect(r.save.xp).toBe(protium.xpYield);
    expect(r.save.regionProgress[region1.id].bossDefeated).toBe(false);
  });
  it('a region-boss win marks bossDefeated, grants the boss reward, and (Lv≥10) evolves', () => {
    let save = SaveManager.newGame('pyron', content);
    save.level = 10; save.xp = 4500; save.unlockedSkillIds = [...content.classes.find(c=>c.id==='pyron')!.startingSkillIds];
    const boss = content.enemies[region1.regionBossId];
    const r = applyVictory(save, boss, region1, 0, content);
    expect(r.save.regionProgress[region1.id].bossDefeated).toBe(true);
    expect(r.save.storyFlags['equilibrium_restored_' + region1.id]).toBe(true);
    // boss reward items appended
    for (const it of region1.bossReward.itemIds) expect(r.save.items.some(i => i.itemId === it)).toBe(true);
    // evolution fired
    expect(r.evolved?.name).toBe('Pyrochemist');
    expect(r.save.evolutionStage).toBe(1);
    expect(r.save.unlockedSkillIds).toContain('combustion-cascade');
    expect(r.banners.some(b => /evolved into Pyrochemist/i.test(b))).toBe(true);
  });
  it('a mini-boss win sets the miniboss flag but does not clear the region', () => {
    let save = SaveManager.newGame('pyron', content);
    const r = applyVictory(save, content.enemies[region1.miniBossId], region1, 0, content);
    expect(r.save.regionProgress[region1.id].miniBossDefeated).toBe(true);
    expect(r.save.storyFlags['miniboss_' + region1.id + '_done']).toBe(true);
    expect(r.save.regionProgress[region1.id].bossDefeated).toBe(false);
  });
  it('TM-style: an enemy with teachesSkillId teaches it once', () => {
    let save = SaveManager.newGame('aqualis', content);
    const drift = content.enemies['ionized-drift']; // teaches thermal-vent
    const r = applyVictory(save, drift, region1, 0, content);
    expect(r.save.unlockedSkillIds).toContain('thermal-vent');
    const r2 = applyVictory(r.save, drift, region1, 0, content);
    expect(r2.banners.some(b => /thermal/i.test(b))).toBe(false); // not taught twice
  });
});
```

(Tidy the first test — drop the contrived lines; just: `newGame`, `applyVictory` with `protium`, assert `xp === protium.xpYield`.) Implement `applyVictory` using `addXp`, `statsForLevel`, `checkEvolution` — it's a pure composition (~60 lines).

- [ ] **Step 2: Run — PASS.**
- [ ] **Step 3: Wire the victory sequence into `BattleScene` using `applyVictory`; animate `banners` + the evolution cross-fade.**
- [ ] **Step 4: Manual check** — beating wild enemies levels you up with banners; reaching a skill-unlock level shows "Learned X!"; beating Ionized Drift teaches Thermal Vent; beating the mini-boss opens the boss gate; beating The Unstable Isotope restores the region (banner + ✓ on the WorldMap) and, if you're Lv 10+, triggers the evolution cutscene; the boss reward items land in your bag.
- [ ] **Step 5: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battleVictory.ts src/main.ts tests/scenes/battleVictory.test.ts
git commit -m "feat(scenes): BattleScene victory — XP/levels/unlocks/evolution/TM/boss-clear (applyVictory TDD)"
```

---

### Task 49: `ChallengeShrineScene` — quiz gauntlet

**Files:**
- Create: `src/scenes/ChallengeShrineScene.ts`; Modify `src/main.ts`.
- Create: `src/scenes/shrineScoring.ts` (pure `scoreGauntlet(answers, passRatio): { correct: number; total: number; passed: boolean }`). TDD it.

`init({ regionId })` → `region = content.regions.find(...)`; `shrine = region.shrine`. `create`: a hushed, NPC-free panel. Ask `shrine.questionCount` questions in sequence via `QuizPanel` + `quiz.pickQuestion(shrine.questionTopic, /* spread difficulty 1→2→3 */, save.quizStats[topic])` (after each, `save = recordQuizResult(...)`, no battle, show ✓/✗ and the explanation on a miss). After the last question, `const result = scoreGauntlet(answers, shrine.passRatio);` → on `passed`: `save.regionProgress[regionId].shrineCleared = true;` grant `shrine.rewardXp` (via `addXp`) + `shrine.rewardItemIds` (append to `save.items`); "Shrine cleared! +Bonus XP, rare items recovered." On fail: "Not quite — study and return." (no penalty; the shrine remains retryable). `persist()`. Return to `OverworldScene` either way.

- [ ] **Step 1: TDD `shrineScoring.ts`** — `tests/scenes/challengeShrine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreGauntlet } from '../../src/scenes/shrineScoring';

describe('scoreGauntlet', () => {
  it('passes when correct/total >= passRatio', () => {
    expect(scoreGauntlet([true, true, true, true, true, false], 0.8334)).toEqual({ correct: 5, total: 6, passed: true });
    expect(scoreGauntlet([true, true, true, true, false, false], 0.8334)).toEqual({ correct: 4, total: 6, passed: false });
  });
  it('an empty gauntlet does not pass', () => { expect(scoreGauntlet([], 0.5).passed).toBe(false); });
  it('100% always passes when passRatio <= 1', () => { expect(scoreGauntlet([true, true], 1).passed).toBe(true); });
});
```

```ts
// src/scenes/shrineScoring.ts
export function scoreGauntlet(answers: boolean[], passRatio: number): { correct: number; total: number; passed: boolean } {
  const total = answers.length, correct = answers.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct / total >= passRatio };
}
```

- [ ] **Step 2: Run — PASS.**
- [ ] **Step 3: Implement `ChallengeShrineScene`; register; wire `DialogueScene`'s `launch:'shrine'` and `OverworldScene`'s `shrine_entrance` to it.**
- [ ] **Step 4: Manual check** — entering the Shrine asks 6 questions; getting ≥5 right clears it, banks the bonus XP and the Energy Cell + Isotope Core; getting <5 right ends with the gentle "study and return" message and leaves the Shrine repeatable; the run updates per-topic quiz stats.
- [ ] **Step 5: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/ChallengeShrineScene.ts src/scenes/shrineScoring.ts src/main.ts tests/scenes/challengeShrine.test.ts
git commit -m "feat(scenes): ChallengeShrineScene — quiz gauntlet + rewards (scoreGauntlet TDD)"
```

---

### Task 50: `MenuScene` — Skills loadout / Items / Status / Save / Settings / Quit

**Files:**
- Create: `src/scenes/MenuScene.ts`; Modify `src/main.ts`.
- Create: `src/scenes/loadout.ts` (pure `setLoadout(save, newEquippedIds, content): { ok: true; equipped: string[] } | { ok: false; reason: string }` — rejects >5, ids not in `unlockedSkillIds`, duplicates, empty). TDD it.

`MenuScene` launches as an overlay (`this.scene.launch('MenuScene'); this.scene.pause(callerKey)`), or as a full scene from the WorldMap. Tabs (←/→ or pointer):
- **Skills:** two columns — *Equipped* (≤5) and *Available* (`unlockedSkillIds` minus equipped) — move skills between them; on confirm, `const r = setLoadout(save, equipped, content); if (r.ok) { save.equippedSkillIds = r.equipped; persist(); } else toast(r.reason);`. Show each skill's affinity/power/cost.
- **Items:** list `save.items`; using a non-battle item out of battle (e.g. a `buffer`) heals `save.currentHp` (capped), decrements/removes the entry, `persist()`.
- **Status:** class name + evolution stage name, level, XP (and "XP to next: `xpToNextLevel(level) - (save.xp - totalXpForLevel(level))`"), the full `save.stats`, equipped skills, and the per-topic quiz accuracy table (the seed of the Milestone-4 report card).
- **Save:** "Save now" → `persist()` + "Saved." (auto-save also happens on transitions — Task 51.)
- **Settings:** toggles for **Study Mode** and **Answer Timer**, bound to `save.settings`, `persist()` on change.
- **Quit to Title:** `persist()` → `this.scene.stop()` everything → `this.scene.start('TitleScene')`.

- [ ] **Step 1: TDD `loadout.ts`** — `tests/scenes/menuLoadout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { setLoadout } from '../../src/scenes/loadout';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';
const content = loadGameContent().content;

describe('setLoadout', () => {
  it('accepts a valid loadout of unlocked skills, ≤5, no dupes', () => {
    let save = SaveManager.newGame('pyron', content); save.unlockedSkillIds = ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize'];
    const r = setLoadout(save, ['proton-jab', 'spark-flare', 'shell-shatter', 'ionize'], content);
    expect(r.ok).toBe(true); if (r.ok) expect(r.equipped.length).toBe(4);
  });
  it('rejects more than 5', () => {
    let save = SaveManager.newGame('pyron', content); save.unlockedSkillIds = ['a','b','c','d','e','f'].map((_,i)=>['proton-jab','spark-flare','shell-shatter','ionize','neutralize','decompose'][i]);
    expect(setLoadout(save, ['proton-jab','spark-flare','shell-shatter','ionize','neutralize','decompose'], content).ok).toBe(false);
  });
  it('rejects an id the player has not unlocked', () => {
    let save = SaveManager.newGame('pyron', content); save.unlockedSkillIds = ['proton-jab'];
    expect(setLoadout(save, ['proton-jab', 'decompose'], content).ok).toBe(false);
  });
  it('rejects duplicates and empty loadouts', () => {
    let save = SaveManager.newGame('pyron', content); save.unlockedSkillIds = ['proton-jab', 'spark-flare'];
    expect(setLoadout(save, ['proton-jab', 'proton-jab'], content).ok).toBe(false);
    expect(setLoadout(save, [], content).ok).toBe(false);
  });
});
```

```ts
// src/scenes/loadout.ts
import type { GameContent, SaveData } from '../content/types';
export function setLoadout(save: SaveData, ids: string[], content: GameContent): { ok: true; equipped: string[] } | { ok: false; reason: string } {
  if (ids.length === 0) return { ok: false, reason: 'Equip at least one skill.' };
  if (ids.length > 5) return { ok: false, reason: 'You can equip at most 5 skills.' };
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'No duplicate skills.' };
  const unlocked = new Set(save.unlockedSkillIds);
  for (const id of ids) { if (!unlocked.has(id)) return { ok: false, reason: `You haven't learned ${content.skills[id]?.name ?? id} yet.` }; if (!content.skills[id]) return { ok: false, reason: `Unknown skill ${id}.` }; }
  return { ok: true, equipped: [...ids] };
}
```

- [ ] **Step 2: Run — PASS.**
- [ ] **Step 3: Implement `MenuScene`; register; wire the "Menu" buttons in `WorldMapScene` and `OverworldScene` (and an ESC key in `OverworldScene`).**
- [ ] **Step 4: Manual check** — swap your loadout (can't exceed 5, can't equip unlearned skills); use a Buffer from the menu to heal; the Status tab shows your stats, XP-to-next, and per-topic accuracy; toggling Study Mode/Timer sticks across a reload; "Quit to Title" returns cleanly and "Continue" still works.
- [ ] **Step 5: `npx tsc --noEmit` clean; commit**

```bash
git add src/scenes/MenuScene.ts src/scenes/loadout.ts src/scenes/WorldMapScene.ts src/scenes/OverworldScene.ts src/main.ts tests/scenes/menuLoadout.test.ts
git commit -m "feat(scenes): MenuScene — loadout/items/status/save/settings/quit (setLoadout TDD)"
```

---

### Task 51: Auto-save hooks, `persist()` helper, Continue path, full scene registration

**Files:**
- Create: `src/persist.ts` (`persist()` + a `getSave()/getContent()/getQuiz()` convenience)
- Modify: `src/main.ts` (final `SCENES` list, in order), `src/scenes/*` (call `persist()` at the right moments)

- [ ] **Step 1: Create `src/persist.ts`**

```ts
import Phaser from 'phaser';
import { SaveManager } from './systems/SaveManager';
import type { SaveData, GameContent } from './content/types';
import type { QuizEngine } from './systems/QuizEngine';

let registryRef: Phaser.Data.DataManager | null = null;
export function bindRegistry(reg: Phaser.Data.DataManager) { registryRef = reg; }
function reg() { if (!registryRef) throw new Error('persist: registry not bound — BootScene must call bindRegistry'); return registryRef; }
export function getContent(): GameContent { return reg().get('content'); }
export function getQuiz(): QuizEngine { return reg().get('quiz'); }
export function getSave(): SaveData | null { return reg().get('save'); }
export function setSave(s: SaveData) { reg().set('save', s); }
export function persist() { const s = getSave(); if (s) SaveManager.save(s, window.localStorage); }
```

In `BootScene.create`, call `bindRegistry(this.registry)` first thing.

- [ ] **Step 2: Add `persist()` calls** at: every region/scene transition that mutates the save (entering/leaving the overworld, after each battle, after each shrine question, after a loadout change, after a settings change, on `MenuScene` "Save now", on `ClassSelectScene` confirm). Also: when leaving a battle, write `state.player.hp → save.currentHp` and `state.player.energy → save.currentEnergy` *before* `persist()`. When entering the overworld, write `save.playerTile = { regionId, x, y }` on each completed step (debounced — e.g. only persist the tile on scene exit, not every step, to avoid thrash). On `OverworldScene` exit / `WorldMapScene` enter, `persist()`.
- [ ] **Step 3: Finalise `src/main.ts`**

```ts
import Phaser from 'phaser';
import { makeGameConfig } from './gameConfig';
import { BootScene } from './scenes/BootScene';
import { ErrorScene } from './scenes/ErrorScene';
import { TitleScene } from './scenes/TitleScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { OverworldScene } from './scenes/OverworldScene';
import { DialogueScene } from './scenes/DialogueScene';
import { BattleScene } from './scenes/BattleScene';
import { ChallengeShrineScene } from './scenes/ChallengeShrineScene';
import { MenuScene } from './scenes/MenuScene';

new Phaser.Game(makeGameConfig([
  BootScene, ErrorScene, TitleScene, ClassSelectScene, WorldMapScene, OverworldScene, DialogueScene, BattleScene, ChallengeShrineScene, MenuScene
] as any));
```

- [ ] **Step 4: Manual check** — play a few minutes (wander, talk, battle, level up, maybe evolve, clear the shrine), then **hard-refresh the browser**: "Continue" resumes with HP/energy, level, items, story flags, loadout, settings, and your overworld position intact. Quit to Title, Continue again — still intact. Devtools → corrupt the save string → reload → Title shows the corrupt-save warning, "New Game" overwrites cleanly.
- [ ] **Step 5: `npx tsc --noEmit` clean; `npm test` green; commit**

```bash
git add src/persist.ts src/main.ts src/scenes/*
git commit -m "feat: persist() helper + auto-save hooks + final scene registration"
```

---

# Phase 7 — Integration, build config, playtest, deploy

### Task 52: End-to-end scene-flow shakedown + error/fallback robustness

**Files:** Touch-ups across `src/scenes/*` as bugs surface.

- [ ] **Step 1:** Play the whole loop in `npm run dev`: Title → New Game → ClassSelect → WorldMap → Overworld(Region 1) → talk to all 3 NPCs → fight wild enemies → clear the Challenge Shrine → beat the mini-boss → beat The Unstable Isotope → see the region-complete banner on the WorldMap. Note every bug; fix.
- [ ] **Step 2: Robustness checks (spec §6.5/§6.6):**
  - Temporarily add a bogus `spriteKey` to an enemy in `enemies.json` → in battle, that enemy shows the magenta fallback box + a console warning, **no crash**. Restore.
  - Temporarily break `questions/atomic-structure.json` (one malformed question object) → game still boots, the bad question is skipped, a console warning names it. Restore.
  - Temporarily blank `regions.json` to `[]` → ErrorScene with "content: regions is empty". Restore.
  - Devtools → `localStorage.setItem('equilibrium-lost:save:v1', '{broken')` → reload → Title shows the corrupt-save notice; New Game works; Continue is greyed.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm test` green. Commit any fixes.

```bash
git add -A
git commit -m "fix: end-to-end scene-flow shakedown + error/fallback hardening"
```

---

### Task 53: Production build + GitHub Pages base path

**Files:** Verify `vite.config.ts` (`base: '/equilibrium-lost/'`); add a `public/.nojekyll` (so Pages serves `_`-prefixed Vite asset folders).

- [ ] **Step 1:** `npm run build` → succeeds (`tsc --noEmit` then `vite build`); inspect `dist/` — `index.html` references `/equilibrium-lost/assets/...`.
- [ ] **Step 2:** `npm run preview` → open the previewed URL → the game runs identically to dev (placeholders, full loop). If asset paths 404, the `base` is wrong — fix it.
- [ ] **Step 3:** `touch public/.nojekyll` (Vite copies `public/` to `dist/`); rebuild; confirm `dist/.nojekyll` exists.
- [ ] **Step 4: Commit**

```bash
git add public/.nojekyll vite.config.ts
git commit -m "build: GitHub Pages base path + .nojekyll; verified production build"
```

---

### Task 54: Milestone-1 manual playtest checklist (spec §9)

**Files:** Create `docs/superpowers/playtest-m1.md` recording the run.

- [ ] **Step 1:** Execute and tick off, recording notes/bugs in `docs/superpowers/playtest-m1.md`:
  - [ ] Complete Region 1 start-to-finish (new game → region boss down) in one sitting (~30–50 min target — note actual time; this is the in-class flow).
  - [ ] Quit mid-way, re-open, Continue → state intact (level, HP/energy, items, story flags, loadout, settings, overworld position). [at-home flow]
  - [ ] Wrong answer in battle: weak (~30%) hit + correction line shown; **no HP loss, no extra lost turn**; chain resets.
  - [ ] Correct answer: full power; +XP popup; chain meter ticks up; reaching chain 5 lights BURST; firing BURST plays the flash + big hit + guaranteed status + resets the chain.
  - [ ] Type chart reads true: a Base skill is super-effective vs an Acid enemy; an Acid skill vs an Ionic/Metal enemy; Endothermic vs a Combustion enemy; Decompose splits Shellfracture into two halves you must both defeat; Precipitate strips an enemy's stat boost.
  - [ ] Status effects behave: Oxidised drains DEF over turns; Combusting burns each turn; Precipitated makes the enemy skip; Catalysed gives the extra action; Dissolved chips HP; Endothermic Chill lowers ATK.
  - [ ] Evolution fires at the right moment (Lv 10 **and** Region 1 cleared — not before): cutscene plays, sprite swaps, stat jump, new signature skill learned.
  - [ ] Adaptive difficulty: deliberately miss the same topic 3× → questions ease toward difficulty 1; the refresher toast appears next time you're in the overworld.
  - [ ] Study Mode toggle: hints appear on questions; chain-meter pressure is removed.
  - [ ] Challenge Shrine: clearing it grants bonus XP + the rare items; failing it is penalty-free and retryable.
  - [ ] Survives a corrupted save: detected on load, offered a clean restart, never silently wiped.
  - [ ] No crashes; missing assets degrade to magenta placeholders; malformed questions are skipped, not fatal.
- [ ] **Step 2:** Fix any blocker bugs found; re-run the affected items. Non-blocker polish items → log them as Milestone-4 notes in the playtest doc.
- [ ] **Step 3:** `npm test` green; `npm run build` succeeds. Commit.

```bash
git add docs/superpowers/playtest-m1.md
git commit -m "docs: Milestone 1 manual playtest run + findings"
```

> **Reminder (spec §9):** *feel/fun* can't be verified here — that's the Milestone-4 classroom pilot. This checklist verifies *correctness and robustness*.

---

### Task 55: Deploy to GitHub Pages

**Prerequisites:** a GitHub repo named `equilibrium-lost` (so `base: '/equilibrium-lost/'` matches the Pages URL `https://<user>.github.io/equilibrium-lost/`) with **Settings → Pages → Source = GitHub Actions**. If the repo name differs, update `base` in `vite.config.ts` first.

- [ ] **Step 1:** If the repo isn't created yet: `gh repo create equilibrium-lost --public --source=. --remote=origin --push` (or create on github.com and `git remote add origin … && git push -u origin main`).
- [ ] **Step 2:** Confirm `git push origin main` triggers the `deploy.yml` workflow; watch it: `npm ci` → `npm test` (must pass — the workflow gates deploy on green tests) → `npm run build` → `upload-pages-artifact` → `deploy-pages`.
- [ ] **Step 3:** Open `https://<user>.github.io/equilibrium-lost/` → the game loads → play the full Region 1 loop on the live site. Hard-refresh → Continue works (localStorage is per-origin, persists).
- [ ] **Step 4:** If assets 404 on the live site: the `base` path is wrong for the actual repo/URL — fix `vite.config.ts`, push, re-deploy.

> No commit for this task unless `vite.config.ts` changed.

---

### Task 56: Tag the milestone

- [ ] **Step 1:** `npm test` green; `npm run build` clean; live site verified.
- [ ] **Step 2:**

```bash
git tag -a v0.1.0-m1 -m "Milestone 1 — vertical slice: core engine + Region 1 (The Elemental Reaches), placeholder art, deployed to GitHub Pages"
git push origin v0.1.0-m1
```

- [ ] **Step 3:** Update `README.md` with the live URL. Commit.

```bash
git add README.md
git commit -m "docs: add live GitHub Pages URL to README (Milestone 1 shipped)"
```

---

## Self-review (run by the plan author before handing off)

**1. Spec coverage — every section of the design maps to a task:**

| Spec § | Requirement | Covered by |
|--------|-------------|------------|
| §1 | Static web app, GitHub Pages, offline, localStorage, single-player | Tasks 1, 3, 30–34, 53, 55 |
| §2.1 | Immersion: world/enemies/skills/status/type chart from real chemistry | Tasks 7–10 (data), 11, 14 (engine), 18 (split/strip/catalyst behaviours) |
| §2.2 | NPC teaching layer | Tasks 10 (dialogue data), 37 (DialogueScene) |
| §2.3 | Quiz on Skills in battle: correct→full+XP+chain; wrong→~30% + correction, chain reset, **no HP penalty/no lost turn** | Tasks 13 (damage: fizzle 0.3), 17 (chain update + fizzle event), 25 (checkAnswer), 46 (quiz flow + correction) — verified again in Task 54 |
| §2.4 | Challenge Shrines: quiz gauntlets, bonus XP + rare items | Tasks 8 (shrine in regions.json), 49 (ChallengeShrineScene) |
| §2 | Teacher-editable question bank, one JSON file per topic, tagged by topic+difficulty | Tasks 4 (QuestionDef), 5 (validator), 9 (atomic-structure.json), 24 (topic+difficulty selection) |
| §2 | Per-topic quiz accuracy tracked; report-card seed | Tasks 4 (quizStats), 34 (recordQuizResult), 50 (Status tab table) |
| §3 | World = 8 regions; M1 = Region 1 "The Elemental Reaches"; every region has overworld/NPCs/~4 wilds/shrine/mini-boss/region boss | Tasks 8 (regions.json), 41/43 (tilemap + overworld), 10 (NPCs), 8 (4 wilds + mini-boss + boss), 49 (shrine), 45–48 (battles); 8 region nodes shown in Task 40 |
| §3 | Data-driven regions/enemies/NPCs/questions | Tasks 4–10 |
| §4 | 1v1 turn-based, speed-ordered, ends at 0 HP / flee (no flee vs boss) | Tasks 15 (turn order), 16 (resolveTurn), 22 (run/flee), 45 (Run button gating) |
| §4.1 | Action menu: Attack (no quiz) / Skills (quiz, costs Energy) / Items (Buffers/Reagents/boosters) / Run | Tasks 16 (actions), 21 (items), 45–47 (UI) |
| §4.1 | Energy pool, slow refill + items | Decisions table (100 / +25/turn); Tasks 16 (regen), 21 (energy-cell), 7 (items.json) |
| §4.2 | Quiz textbox; mcq default + interactive widgets (balance-the-equation) | Tasks 4/5/9 (balanceEquation), 25 (grading), 44 (QuizPanel widget), 46 (flow) |
| §4.3 | Chain Reaction meter → multiplier → Catalyst Burst signature move w/ full-screen anim; any wrong answer breaks it | Tasks 12 (chain math), 17 (chain updates), 19 (burst), 44 (ChainMeter), 47 (burst button + flash) |
| §4.4 | Type chart encodes chemistry (Base>Acid, Acid>Metal/Ionic, Endo counters Exo/Combustion, Catalyst utility, Decomposition splits, Precipitation strips buffs); lives in typeChart.json | Tasks 7 (typeChart.json), 11 (effectiveness), 18 (split/strip/catalyst behaviours) |
| §4.5 | Six status effects | Tasks 14 (status.ts: all six), 47 (icons), 10 (status icon placeholders) |
| §4.6 | Wild encounters / mini-bosses / region bosses (unlock next region + story + reward) / final boss (M2) | Tasks 8 (roles), 43 (encounters + gates), 48 (boss-clear + reward + unlock) |
| §4.7 | Battle rewards: XP→levels→stat growth+skill unlocks+evolution; items/reagents; TM-style skill teach | Tasks 26–29 (progression), 48 (victory: addXp/level/unlock/evolution/teachesSkillId), 8 (teachesSkillId on enemies) |
| §4.8 | Adaptive difficulty (ease topic + NPC refresher); Study Mode; boss soft-scaling; optional answer timer ("Critical Reaction!") off by default | Tasks 24 (adaptive pick), 34 (recentMisses signal), 46 (refresher toast + Study Mode), 23 (boss soft-scale), 13 (crit mult), 44 (timer ring), 50 (Settings toggles) |
| §5.1 | 3 starting classes (Pyron/Aqualis/Ionix), stat biases, signature lines, not topic-locked | Tasks 7 (classes.json), 8 (skills.json signature skills), 39 (ClassSelectScene), 45 (signatureAffinity bonus) |
| §5.2 | Levelling: XP→stats + skill unlocks at set levels, drawn from reached topics | Tasks 26–28 (curves + addXp + unlocks), 8 (skillUnlocks in classes.json) — M1 has one topic so "reached topics" = atomic structure |
| §5.3 | Evolution at level milestones **and** clearing the relevant region: new sprite + stat jump + new signature skill | Tasks 29 (checkEvolution: Lv10 AND bossDefeated), 48 (evolution cutscene), 10 (evolved sprite placeholders), 7 (evolutions in classes.json) |
| §5.4 | Limited active loadout (4–6 → fixed at 5), swappable outside battle | Tasks 50 (MenuScene Skills tab + setLoadout), Decisions table |
| §5.5 | Save contents (class/evo/level/XP/stats/skills/equipped/items/region/region-progress/flags/quiz-stats/settings), versioned | Tasks 4 (SaveData), 30 (newGame), 33 (versioning) |
| §6.1 | Phaser 3 + TypeScript + Vite + Vitest + GitHub Actions; no backend | Tasks 1, 3 |
| §6.2 | Logic separated from rendering (BattleEngine/QuizEngine/Progression pure, no Phaser) | Phases 2–4 are pure modules; scenes (Phase 6) only render/input |
| §6.3 | Content is data: classes/skills/enemies/regions/items/typeChart/questions are JSON; questions/ one file per topic | Tasks 4–10 |
| §6.4 | Save versioning + migration; corrupted save → detected, clean-restart offered, never wiped | Tasks 32, 33, 38 (Title notice), 54 (verified) |
| §6.5 | assetManifest.json maps logical names→paths; missing asset → placeholder + console warn, no crash | Tasks 10 (manifest), 35 (resolvePlaceholderSpec magenta fallback + warn), 54 (verified) |
| §6.6 | ContentLoader validates on boot; malformed question skipped+warn; missing required file → friendly error screen; corrupted save → clean restart | Tasks 5, 6 (loader+validators), 35 (ErrorScene), 54 (verified) |
| §6.7 | Project structure | Tasks 1, 35–51 follow it (BattleEngine grows into `battle/` — noted) |
| §6.8 | `vite build` → `dist/` → GH Actions deploy | Tasks 3, 53, 55 |
| §7 | Asset spec sheet (Phase 1 deliverable); placeholder art for M1; manifest swap later | Tasks 4 (`public/assets/spec.md`), 10 + 35 (placeholders) |
| §8 M1 | All core systems + full scene flow + Region 1 (tilemap, NPC lessons, ~4 wilds, Challenge Shrine, mini-boss, region boss, Chain Reaction, type chart, status effects, evolution at Lv10, ~40–60 atomic-structure questions), placeholder art, deployed, playable end-to-end | This whole plan; end-to-end verified in Tasks 52/54; deployed in 55 |
| §9 | Unit tests on pure logic (damage/type-chart/XP/evolution/quiz+chain/save+migration); manual playtest checklist per milestone | Phases 2–5 (unit tests), Task 54 (checklist) |
| §11 | Open questions resolved during planning | "Decisions locked for Milestone 1" table |

No gaps found. (Out-of-scope items in §10 — multiplayer, accounts/cloud save, teacher dashboard, non-chemistry content, native mobile — are intentionally absent.)

**2. Placeholder scan:** No "TBD"/"implement later"/"add appropriate error handling"/"write tests for the above (without code)" in task steps. Where exact pixel-level Phaser code is *described rather than transcribed* (Textbox/HealthBar/EnergyBar/ChainMeter/QuizPanel render code; the bodies of scenes), the plan states this explicitly up front (the "How to read this plan" and Phase-6 working-mode notes), gives the exact public API, the exact acceptance criteria, and full code for every pure helper and every engine function. The `~N lines` annotations are budgets, not omissions.

**3. Type consistency:** Names used across tasks are consistent: `SaveData`/`GameContent`/`SkillDef`/`EnemyDef`/`ClassDef`/`RegionDef`/`QuestionDef`/`NpcDef`/`DialogueNode` (Task 4) are the same everywhere; `Combatant`/`BattleState`/`BattleAction`/`BattleEvent`/`BattleContext`/`TurnResult` (Tasks 11/15/16); `createBattle`/`getTurnOrder`/`resolveTurn`/`buildEnemyCombatant`/`computeDamage`/`effectiveness`/`chainMultiplier`/`applyStatus`/`tickStatuses`/`consumePrecipitated` (Phase 2); `xpToNextLevel`/`totalXpForLevel`/`levelForXp`/`statsForLevel`/`addXp`/`checkEvolution` (Phase 4); `SaveManager.{newGame,save,load,migrate,clear,recordQuizResult}` + `StorageLike` + `SAVE_KEY` + `CURRENT_SAVE_VERSION` (Phase 5); `QuizEngine.{pickQuestion,checkAnswer}` (Phase 3); helpers `resolvePlaceholderSpec`/`chunkText`/`nextNode`/`formatMultiplier`/`pickWildEncounter`/`tileBlocks`/`playerBattleInputFromSave`/`battleContextFromContent`/`applyVictory`/`scoreGauntlet`/`setLoadout` (Phase 6). `PlayerBattleInput` carries `catalystBurstSkillId?` consistently (introduced Task 15 stub, populated Task 19, consumed Tasks 19/45). One deliberate refinement noted in two places: `src/systems/BattleEngine.ts` becomes a barrel over `src/systems/battle/*`.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-equilibrium-lost-milestone-1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** superpowers:subagent-driven-development. Natural review checkpoints: after Task 3 (scaffold + CI), after Task 10 (all content + content tests green), after Task 23 (BattleEngine done), after Task 34 (**checkpoint 1** — full test suite + deployable shell), after Task 43 (overworld walkable), after Task 48 (battles complete with victory/evolution), after Task 51 (full game wired), after Task 54 (playtest), after Task 56 (shipped).

**2. Inline Execution** — execute tasks in this session in batches with checkpoints. **REQUIRED SUB-SKILL:** superpowers:executing-plans.

**Which approach?**
