# Region 3 — Reaction Hollow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the third playable region — *Reaction Hollow* (NSW Year 10 Chemistry: classifying reactions — synthesis, decomposition, combustion, single displacement, precipitation; the metal reactivity series) — fully playable end-to-end, and wire the World Map's unlock chain so clearing Region 2 opens Region 3.

**Architecture:** Almost entirely **content** JSON in `src/content/data/`: a new `regions.json` entry, a ~45-question `questions/reaction-types.json` bank, a hand-authored `tilemaps/reaction-hollow.json` grid (the proven Region-2 layout, re-skinned by a new biome palette), 3 mentor NPCs, 7 enemies (4 wild + a split-half + a mini-boss + the region boss *The Eternal Flame*), 2 new quizzed skills + 1 enemy-only filler, and `assetManifest.json` placeholder entries. Plus the same **small code generalisations** Region 2 needed: `OverworldScene` registers the 3rd tilemap + gets a biome-palette entry; `WorldMapScene` drops one locked label; `loadGameContent.ts` imports the new question bank. No new scenes, no engine changes.

**Tech Stack:** Phaser 3 · TypeScript (strict, `noUncheckedIndexedAccess`) · Vite · Vitest. Source of truth: `docs/superpowers/specs/2026-05-12-equilibrium-lost-region3-reaction-hollow-design.md` (and the Region-2 plan/spec for the pattern).

---

## How to read this plan

- Region 2 was built from `docs/superpowers/plans/2026-05-12-equilibrium-lost-region2-bonding-forge.md`; this is the same shape with new content + the playtest-audit fixes already in place (first mentor reachable before the mini-boss; hyphenated chokepoint flag; per-region `lesson_<topic>_seen`; enemies get distinct theme-fitting movesets; levels chosen for what the player can plausibly reach).
- Every gate stays green at **every commit**: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Task ordering keeps `loadGameContent().warnings` empty at all times: assetManifest placeholders land before the enemies/NPCs/region that reference their sprite keys; the `reaction-types.json` import in `loadGameContent.ts` lands before the region entry whose `topic` is `"reaction-types"`.
- Work on branch `feat/region3-reaction-hollow` (create it in Task 0). Commit per task. When all gates are green, merge to `main` (push auto-deploys to GitHub Pages), then tag `v0.4.0-region3`.

---

## Decisions locked for Region 3

| # | Decision |
|---|----------|
| Region id / index | `reaction-hollow` / `index: 3` / name `"Reaction Hollow"` / `topic: "reaction-types"` |
| Asset keys | tileset `tiles_reaction_hollow`, battle bg `bg_battle_reaction_hollow`, tilemap `tilemap_reaction_hollow` |
| Wild enemies | `synthor` (Synthesis, Lv 11 — the deliberate pushover), `combustix` (Combustion, Lv 12), `decomposeer` (Decomposition, Lv 13 — `splitIntoId: "decomposeer-half"`), `displacid` (Metal, Lv 14 — `teachesSkillId: "synthesis-fuse"`) |
| Split half | `decomposeer-half` (Decomposition, Lv 13, low HP, `role: "wild"`, `xpYield: 18`, no skills, no split) — mirrors R1's `shellfracture-half` |
| Mini-boss | `volatile-mixture` (Synthesis, Lv 14, `role: "miniBoss"`, `bossSoftScale: false`) |
| Region boss | `the-eternal-flame` (Combustion, Lv 16, `role: "regionBoss"`, `bossSoftScale: true`, `teachesSkillId: "combustion-flare"`) |
| New skills (topic `"reaction-types"`, quizzed) | `synthesis-fuse` (Synthesis, applies `endothermicChill`), `combustion-flare` (Combustion, applies `combusting`) |
| New enemy-only filler (topic `null`) | `flame-surge` (Combustion) — the `isotope-flux`-style filler the region boss uses |
| Class skill unlocks (added) | pyron: L13 `combustion-flare`, L16 `synthesis-fuse` · aqualis: L15 `synthesis-fuse`, L16 `combustion-flare` · ionix: L14 `combustion-flare`, L15 `synthesis-fuse` |
| Mentors | `alchemist-vera` (Alchemist Vera — synthesis / decomposition / precipitation; **quest NPC**, sets `lesson_reaction-types_seen`), `pyrologist-ignis` (Pyrologist Ignis — combustion + single displacement + the reactivity series), `shrinekeeper-cinder` (Shrinekeeper Cinder — shrine intro, node with `launch: "shrine"`) |
| Shrine | `{ questionTopic: "reaction-types", questionCount: 6, passRatio: 0.8333, rewardXp: 700, rewardItemIds: ["energy-cell", "buffer"] }` |
| Boss reward | `{ xp: 850, itemIds: ["reagent", "isotope-core"], skillId: "combustion-flare" }` |
| Region 2 change | `regions[1].unlocksRegionId`: `null` → `"reaction-hollow"` |
| Mini-boss flag | `miniboss_reaction-hollow_done` — hyphenated to match `battleVictory.ts`'s `miniboss_${region.id}_done` |
| Question bank | 45 questions: 18 difficulty-1, 16 difficulty-2, 11 difficulty-3; 42 `mcq` + 3 `balanceEquation` (`rt-033` H₂O→H₂+O₂ d2, `rt-034` Fe+O₂→Fe₂O₃ d2, `rt-045` CH₄+2O₂→CO₂+2H₂O d3). Every item carries a `hint`. |
| Tilemap | the proven Region-2 24×18 grid (re-used verbatim — connectivity / chokepoint / first-NPC-reachability already validated), only the `objects` differ (R3 NPC ids, shrine `regionId`, mini-boss/boss ids + the hyphenated flag) |
| Biome palette | dark-basalt floor, ember-orange paths, ash tall-grass, obsidian walls — placeholder-quality, keyed by `region.tilesetKey`, default = elemental-reaches |

---

## File structure

**New files**
- `src/content/data/questions/reaction-types.json` — 45-question bank, topic `"reaction-types"`.
- `src/content/data/tilemaps/reaction-hollow.json` — hand-authored 24×18 grid (the Region-2 layout, re-skinned).

**Modified content**
- `src/content/data/assetManifest.json` — add `images` + `placeholders` for `tiles_reaction_hollow`, `bg_battle_reaction_hollow`, 7 `enemy_*`, 3 `npc_*`; add `tilemaps.tilemap_reaction_hollow`.
- `src/content/data/skills.json` — add `synthesis-fuse`, `combustion-flare`, `flame-surge`.
- `src/content/data/classes.json` — add the new `skillUnlocks` entries to all three classes.
- `src/content/data/enemies.json` — add 7 enemies.
- `src/content/data/npcs.json` — add 3 mentors.
- `src/content/data/regions.json` — append the Region 3 entry; flip Region 2's `unlocksRegionId`.

**Modified code**
- `src/content/loadGameContent.ts` — `import reactionTypes from './data/questions/reaction-types.json'`; add `'reaction-types': reactionTypes` to the `questions` map.
- `src/scenes/OverworldScene.ts` — add `tilemap_reaction_hollow` to `TILEMAPS`; add a `tiles_reaction_hollow` entry to the `BIOMES` map.
- `src/scenes/WorldMapScene.ts` — remove `"Reaction Hollow"` from `LOCKED_REGION_LABELS` (→ 5 entries).

**Modified tests**
- `tests/content/realContent.test.ts` — add the `reaction-hollow.json` import, add `'reaction-hollow'` to the reachability test's `maps` record, add the Region 3 test, the reaction-types-bank test, and the tilemap parses+shape test.

---

## Task 0: Branch

- [ ] **Step 1: Create the feature branch.**

```bash
cd /Users/irvincisneros/equilibrium-lost
git checkout main && git pull
git checkout -b feat/region3-reaction-hollow
```

- [ ] **Step 2: Confirm a green baseline.** Run `npx tsc --noEmit` (clean), `npm test` (145 pass), `npm run build` (succeeds).

---

## Task 1: assetManifest — new image + placeholder + tilemap entries

**Files:**
- Modify: `src/content/data/assetManifest.json`

Adding these first keeps `realContent.test.ts`'s asset-key cross-ref green at every later commit.

- [ ] **Step 1: Add the new `images` entries.** In the `"images"` object, after the existing `"npc_shrinekeeper_mortar": ...` line (the last Region-2 npc image; anywhere before `"ui_textbox"` is fine), add:

```json
    "tiles_reaction_hollow": "assets/images/tiles_reaction_hollow.png",
    "bg_battle_reaction_hollow": "assets/images/bg_battle_reaction_hollow.png",
    "enemy_synthor": "assets/images/enemy_synthor.png",
    "enemy_combustix": "assets/images/enemy_combustix.png",
    "enemy_decomposeer": "assets/images/enemy_decomposeer.png",
    "enemy_displacid": "assets/images/enemy_displacid.png",
    "enemy_decomposeer_half": "assets/images/enemy_decomposeer_half.png",
    "enemy_volatile_mixture": "assets/images/enemy_volatile_mixture.png",
    "enemy_eternal_flame": "assets/images/enemy_eternal_flame.png",
    "npc_alchemist_vera": "assets/images/npc_alchemist_vera.png",
    "npc_pyrologist_ignis": "assets/images/npc_pyrologist_ignis.png",
    "npc_shrinekeeper_cinder": "assets/images/npc_shrinekeeper_cinder.png",
```

- [ ] **Step 2: Add the tilemap entry.** Change the `"tilemaps"` line so it reads:

```json
  "tilemaps": { "tilemap_elemental_reaches": "src/content/data/tilemaps/elemental-reaches.json", "tilemap_bonding_forge": "src/content/data/tilemaps/bonding-forge.json", "tilemap_reaction_hollow": "src/content/data/tilemaps/reaction-hollow.json" },
```

- [ ] **Step 3: Add the new `placeholders` entries.** In the `"placeholders"` array, after the last Region-2 entry (`{ "key": "npc_shrinekeeper_mortar", ... }`), add a comma to that entry then append:

```json
    { "key": "tiles_reaction_hollow", "w": 64, "h": 64, "color": "#2b2622", "label": "" },
    { "key": "bg_battle_reaction_hollow", "w": 1920, "h": 896, "color": "#1f1612", "label": "" },
    { "key": "enemy_synthor", "w": 96, "h": 96, "color": "#8aa06a", "label": "Synthor" },
    { "key": "enemy_combustix", "w": 128, "h": 128, "color": "#e2632a", "label": "Combustix" },
    { "key": "enemy_decomposeer", "w": 160, "h": 160, "color": "#7a6f5e", "label": "Decomposeer" },
    { "key": "enemy_displacid", "w": 128, "h": 128, "color": "#b0843a", "label": "Displacid" },
    { "key": "enemy_decomposeer_half", "w": 96, "h": 96, "color": "#8d8576", "label": "Frag" },
    { "key": "enemy_volatile_mixture", "w": 192, "h": 192, "color": "#d4843a", "label": "Volatile Mix" },
    { "key": "enemy_eternal_flame", "w": 256, "h": 256, "color": "#e2461a", "label": "ETERNAL FLAME" },
    { "key": "npc_alchemist_vera", "w": 64, "h": 96, "color": "#5a8a6a", "label": "Ve" },
    { "key": "npc_pyrologist_ignis", "w": 64, "h": 96, "color": "#c2562a", "label": "Ig" },
    { "key": "npc_shrinekeeper_cinder", "w": 64, "h": 96, "color": "#8a5a3a", "label": "Ci" }
```

- [ ] **Step 4: Gates.** `node -e "JSON.parse(require('fs').readFileSync('src/content/data/assetManifest.json','utf8')); console.log('ok')"`; `npx tsc --noEmit`; `npm test` (145 pass); `npm run build`.

- [ ] **Step 5: Commit.**

```bash
git add src/content/data/assetManifest.json
git commit -m "feat(content): asset manifest entries for Region 3 (Reaction Hollow)"
```

---

## Task 2: Tilemap — `tilemaps/reaction-hollow.json`

**Files:**
- Create: `src/content/data/tilemaps/reaction-hollow.json`

The 24×18 `ground` grid is the proven Region-2 layout verbatim (connectivity, the north-running chokepoint, the first-NPC-reachable-before-the-guardian property are all already validated by tests). Only the `objects` differ: R3's NPC ids, `shrine_entrance.regionId`, `minibossTrigger.enemyId` + the hyphenated `flag`, `bossGate.enemyId` + `requiresFlag`.

- [ ] **Step 1: Create the file** with exactly this content:

```json
{
  "width": 24,
  "height": 18,
  "tileSize": 16,
  "ground": [
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,3,3,3,3,3,3,3,3,3,3,1,3,3,3,3,3,3,3,3,3,3,3,3],
    [3,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,4,4,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,4,4,4,0,3],
    [3,0,4,4,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,4,4,4,0,3],
    [3,0,4,4,4,0,0,1,0,0,0,4,0,0,0,0,0,0,4,4,4,4,0,3],
    [3,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,3],
    [3,0,4,4,4,0,0,0,0,0,0,1,0,0,0,0,0,0,4,4,4,4,0,3],
    [3,0,4,4,4,0,0,0,0,0,0,1,0,0,0,0,0,0,4,4,4,4,0,3],
    [3,3,3,3,3,3,3,3,3,3,3,1,3,3,3,3,3,3,3,3,3,3,3,3]
  ],
  "objects": [
    { "type": "player_spawn", "x": 11, "y": 14 },
    { "type": "exit", "x": 11, "y": 17, "to": "world" },
    { "type": "npc", "id": "alchemist-vera", "x": 11, "y": 12 },
    { "type": "npc", "id": "pyrologist-ignis", "x": 7, "y": 8 },
    { "type": "npc", "id": "shrinekeeper-cinder", "x": 4, "y": 12 },
    { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "reaction-hollow" },
    { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "volatile-mixture", "flag": "miniboss_reaction-hollow_done" },
    { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-eternal-flame", "requiresFlag": "miniboss_reaction-hollow_done" }
  ]
}
```

- [ ] **Step 2: Verify it parses.** Run: `node -e "JSON.parse(require('fs').readFileSync('src/content/data/tilemaps/reaction-hollow.json','utf8')); console.log('ok')"` — Expected: `ok`.

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` (145 pass — nothing imports it yet); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/tilemaps/reaction-hollow.json
git commit -m "feat(content): Region 3 tilemap (the Reaction Hollow grid)"
```

---

## Task 3: Skills + class unlocks

**Files:**
- Modify: `src/content/data/skills.json`
- Modify: `src/content/data/classes.json`

Two new quizzed reaction-types skills + one enemy-only filler (`flame-surge`, topic `null`, like `isotope-flux`/`lattice-flux`).

- [ ] **Step 1: Add the 3 skills to `skills.json`.** After the existing last entry (`"lattice-flux": { ... }`), add a comma to that entry then append (keeping the file a single JSON object):

```json
  "synthesis-fuse":   { "id": "synthesis-fuse", "name": "Synthesis Fuse", "affinity": "Synthesis", "power": 36, "energyCost": 28, "topic": "reaction-types", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "endothermicChill", "chance": 30, "turns": 2, "magnitude": 0 } }, "description": "Fuses two reagents into an inert compound around the target. May reduce ATK." },
  "combustion-flare": { "id": "combustion-flare", "name": "Combustion Flare", "affinity": "Combustion", "power": 42, "energyCost": 26, "topic": "reaction-types", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "combusting", "chance": 35, "turns": 2, "magnitude": 5 } }, "description": "A controlled flare of combustion. May set the target alight (Combusting)." },
  "flame-surge":      { "id": "flame-surge", "name": "Flame Surge", "affinity": "Combustion", "power": 38, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Eternal Flame's attack — a roaring surge of fire." }
```

- [ ] **Step 2: Add the new unlocks to `classes.json`.** In each class's `skillUnlocks` array, append the entries (keep all existing entries):
  - `pyron.skillUnlocks`: append `{ "level": 13, "skillId": "combustion-flare" }, { "level": 16, "skillId": "synthesis-fuse" }`
  - `aqualis.skillUnlocks`: append `{ "level": 15, "skillId": "synthesis-fuse" }, { "level": 16, "skillId": "combustion-flare" }`
  - `ionix.skillUnlocks`: append `{ "level": 14, "skillId": "combustion-flare" }, { "level": 15, "skillId": "synthesis-fuse" }`

  For example, `pyron`'s line becomes:

```json
    "skillUnlocks": [ { "level": 3, "skillId": "ionize" }, { "level": 5, "skillId": "thermal-vent" }, { "level": 7, "skillId": "neutralize" }, { "level": 9, "skillId": "decompose" }, { "level": 10, "skillId": "combustion-cascade" }, { "level": 12, "skillId": "ionic-bond" }, { "level": 13, "skillId": "combustion-flare" }, { "level": 14, "skillId": "lattice-collapse" }, { "level": 16, "skillId": "synthesis-fuse" } ],
```

- [ ] **Step 3: Gates.** `node -e "JSON.parse(require('fs').readFileSync('src/content/data/skills.json','utf8')); JSON.parse(require('fs').readFileSync('src/content/data/classes.json','utf8')); console.log('ok')"`; `npx tsc --noEmit`; `npm test` (145 pass — `validateSkill` passes; cross-refs resolve; each class still has exactly one Catalyst Burst); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/skills.json src/content/data/classes.json
git commit -m "feat(content): reaction-types skills + class unlocks (L13-16)"
```

---

## Task 4: Enemies

**Files:**
- Modify: `src/content/data/enemies.json`

Seven new entries: 4 wild "corrupted reaction" enemies (Lv 11–14, distinct theme-fitting movesets, roughly equal `xpYield`; `synthor` the deliberate Lv-11 pushover), the `decomposeer-half` split target, the `volatile-mixture` mini-boss (Lv 14), and *The Eternal Flame* region boss (Lv 16, `bossSoftScale: true`, uses `combustion-flare` + `spark-flare` + the `flame-surge` filler, `teachesSkillId: "combustion-flare"`).

- [ ] **Step 1: Add the 7 enemies to `enemies.json`.** After the existing last entry (`"the-sundered-lattice": { ... }`), add a comma to that entry then append:

```json
  "synthor":           { "id": "synthor", "name": "Synthor", "affinity": "Synthesis", "baseStats": { "hp": 30, "atk": 9, "def": 5, "spd": 9 }, "level": 11, "attackPower": 22, "skillIds": ["synthesis-fuse"], "xpYield": 96, "role": "wild", "spriteKey": "enemy_synthor" },
  "combustix":         { "id": "combustix", "name": "Combustix", "affinity": "Combustion", "baseStats": { "hp": 48, "atk": 13, "def": 8, "spd": 12 }, "level": 12, "attackPower": 26, "skillIds": ["spark-flare", "combustion-flare"], "xpYield": 108, "role": "wild", "spriteKey": "enemy_combustix" },
  "decomposeer":       { "id": "decomposeer", "name": "Decomposeer", "affinity": "Decomposition", "baseStats": { "hp": 70, "atk": 12, "def": 11, "spd": 6 }, "level": 13, "attackPower": 28, "skillIds": ["decompose", "shell-shatter"], "xpYield": 118, "role": "wild", "spriteKey": "enemy_decomposeer", "splitIntoId": "decomposeer-half" },
  "decomposeer-half":  { "id": "decomposeer-half", "name": "Decay Fragment", "affinity": "Decomposition", "baseStats": { "hp": 22, "atk": 10, "def": 5, "spd": 8 }, "level": 13, "attackPower": 20, "skillIds": [], "xpYield": 18, "role": "wild", "spriteKey": "enemy_decomposeer_half" },
  "displacid":         { "id": "displacid", "name": "Displacid", "affinity": "Metal", "baseStats": { "hp": 56, "atk": 16, "def": 12, "spd": 10 }, "level": 14, "attackPower": 30, "skillIds": ["ionic-bond", "precipitate"], "xpYield": 132, "role": "wild", "spriteKey": "enemy_displacid", "teachesSkillId": "synthesis-fuse" },
  "volatile-mixture":  { "id": "volatile-mixture", "name": "Volatile Mixture", "affinity": "Synthesis", "baseStats": { "hp": 175, "atk": 20, "def": 13, "spd": 9 }, "level": 14, "attackPower": 30, "skillIds": ["synthesis-fuse", "combustion-flare"], "xpYield": 230, "role": "miniBoss", "spriteKey": "enemy_volatile_mixture", "bossSoftScale": false },
  "the-eternal-flame": { "id": "the-eternal-flame", "name": "The Eternal Flame", "affinity": "Combustion", "baseStats": { "hp": 280, "atk": 28, "def": 17, "spd": 11 }, "level": 16, "attackPower": 34, "skillIds": ["combustion-flare", "spark-flare", "flame-surge"], "xpYield": 480, "role": "regionBoss", "spriteKey": "enemy_eternal_flame", "bossSoftScale": true, "teachesSkillId": "combustion-flare" }
```

- [ ] **Step 2: Gates.** `node -e "JSON.parse(require('fs').readFileSync('src/content/data/enemies.json','utf8')); console.log('ok')"`; `npx tsc --noEmit`; `npm test` (145 pass — the asset-key test now checks `enemy_synthor` … `enemy_eternal_flame` (entries from Task 1); "every skill id referenced by an enemy exists" checks `synthesis-fuse`/`combustion-flare`/`flame-surge` (entries from Task 3) and the reused `spark-flare`/`decompose`/`shell-shatter`/`ionic-bond`/`precipitate`); `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/content/data/enemies.json
git commit -m "feat(content): Region 3 enemies (4 wild + split-half + mini-boss + The Eternal Flame)"
```

---

## Task 5: Question bank — `questions/reaction-types.json` + `loadGameContent.ts`

**Files:**
- Create: `src/content/data/questions/reaction-types.json`
- Modify: `src/content/loadGameContent.ts`

45 questions on classifying reactions (Year-10 reading level): 18 difficulty-1, 16 difficulty-2 (incl. 2 `balanceEquation`), 11 difficulty-3 (incl. 1 `balanceEquation`); a `hint` on each; all pass `validateQuestion`. **Do both files in one commit** so no commit has the region pointing at a topic with no questions.

- [ ] **Step 1: Create `src/content/data/questions/reaction-types.json`** with exactly this content:

```json
[
  { "id": "rt-001", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Which type of reaction is A + B → AB, where two substances combine to make one?", "options": ["Decomposition", "Synthesis (combination)", "Displacement", "Combustion"], "answerIndex": 1, "explanation": "Two (or more) reactants joining to form a single product is a synthesis (combination) reaction.", "hint": "Two things become one." },
  { "id": "rt-002", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Which type of reaction is AB → A + B, where one substance breaks down into two or more?", "options": ["Synthesis", "Decomposition", "Precipitation", "Neutralisation"], "answerIndex": 1, "explanation": "One reactant splitting into two or more products is a decomposition reaction.", "hint": "One thing becomes two." },
  { "id": "rt-003", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "When a hydrocarbon fuel burns completely in plenty of oxygen, the products are…", "options": ["carbon monoxide and water", "carbon dioxide and water", "carbon and hydrogen", "oxygen and hydrogen"], "answerIndex": 1, "explanation": "Complete combustion of a hydrocarbon gives carbon dioxide + water.", "hint": "Plenty of oxygen → the 'clean' products." },
  { "id": "rt-004", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Combustion reactions release energy as heat (and often light). They are therefore described as…", "options": ["endothermic", "exothermic", "neutral", "reversible"], "answerIndex": 1, "explanation": "Burning gives out heat — combustion is exothermic.", "hint": "Does a fire feel hot or cold?" },
  { "id": "rt-005", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "In a single displacement reaction, a more reactive metal…", "options": ["takes the place of a less reactive metal in its compound", "is pushed out by a less reactive metal", "turns into a gas", "stays completely unchanged"], "answerIndex": 0, "explanation": "A more reactive metal displaces a less reactive one from its compound (e.g. Zn displaces Cu from CuSO₄).", "hint": "The stronger metal pushes the weaker one out." },
  { "id": "rt-006", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "A precipitation reaction happens when two solutions are mixed and…", "options": ["a gas bubbles off", "an insoluble solid forms", "the temperature drops to zero", "nothing changes at all"], "answerIndex": 1, "explanation": "Mixing two soluble salts can form an insoluble product — the precipitate — which appears as a solid.", "hint": "A solid suddenly appears in the liquid." },
  { "id": "rt-007", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "The symbol ↓ (or '(s)') after a product in an equation usually means that product is…", "options": ["a gas", "a precipitate (an insoluble solid)", "a liquid", "dissolved in water"], "answerIndex": 1, "explanation": "'↓' or '(s)' marks a solid precipitate that forms and settles out of solution.", "hint": "It points downwards — it sinks." },
  { "id": "rt-008", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Magnesium burning in oxygen to form magnesium oxide, 2Mg + O₂ → 2MgO, is an example of which reaction type?", "options": ["Decomposition", "Displacement", "Synthesis (combination)", "Precipitation"], "answerIndex": 2, "explanation": "Magnesium and oxygen combine to form a single product — synthesis.", "hint": "Two reactants → one product." },
  { "id": "rt-009", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Heating copper carbonate so it turns into copper oxide and carbon dioxide, CuCO₃ → CuO + CO₂, is an example of…", "options": ["synthesis", "decomposition", "combustion", "neutralisation"], "answerIndex": 1, "explanation": "One compound broken down by heat into two products — thermal decomposition.", "hint": "One thing splits into two when it's heated." },
  { "id": "rt-010", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Which of these is a sign that a chemical reaction is happening?", "options": ["The substances stay exactly the same", "A colour change, a gas, a precipitate, or heat/light is produced", "The total mass changes on its own", "Nothing observable ever happens"], "answerIndex": 1, "explanation": "Observable signs of a reaction include a colour change, a gas given off, a precipitate forming, and a temperature change or light.", "hint": "Reactions usually make something visible happen." },
  { "id": "rt-011", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Which list orders metals from MOST reactive to LEAST reactive (the reactivity series)?", "options": ["Gold, copper, iron, sodium, potassium", "Potassium, sodium, magnesium, iron, copper", "Copper, iron, magnesium, sodium, potassium", "Iron, copper, gold, sodium, magnesium"], "answerIndex": 1, "explanation": "Part of the reactivity series, most→least reactive: K, Na, Ca, Mg, Al, Zn, Fe, Cu, Ag, Au.", "hint": "The Group-1 metals are at the top; gold is right at the bottom." },
  { "id": "rt-012", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Iron + sulfur → iron sulfide. What type of reaction is this?", "options": ["Decomposition", "Synthesis (combination)", "Combustion", "Displacement"], "answerIndex": 1, "explanation": "Two elements combining into one compound is synthesis.", "hint": "Two reactants, one product." },
  { "id": "rt-013", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Zinc + copper sulfate → zinc sulfate + copper. What type of reaction is this?", "options": ["Synthesis", "Decomposition", "Single displacement", "Precipitation"], "answerIndex": 2, "explanation": "Zinc (more reactive) displaces copper (less reactive) from its compound — single displacement.", "hint": "One metal swaps places with another." },
  { "id": "rt-014", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Passing electricity through water splits it into hydrogen and oxygen, 2H₂O → 2H₂ + O₂. What type of reaction is this?", "options": ["Synthesis", "Combustion", "Decomposition", "Displacement"], "answerIndex": 2, "explanation": "One compound broken down (here by an electric current) into its elements — decomposition.", "hint": "Water is being taken apart." },
  { "id": "rt-015", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Why does a fire need oxygen to keep burning?", "options": ["Oxygen cools the fuel down", "Combustion is a reaction between a fuel and oxygen", "Oxygen is the fuel", "Oxygen carries the heat away"], "answerIndex": 1, "explanation": "Combustion is fuel + oxygen → oxides + energy; cut off the oxygen and the reaction stops.", "hint": "Smothering a flame cuts off its oxygen." },
  { "id": "rt-016", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Mixing silver nitrate solution with sodium chloride solution makes a white solid of silver chloride. This is an example of…", "options": ["combustion", "a precipitation reaction", "synthesis of an element", "thermal decomposition"], "answerIndex": 1, "explanation": "Two solutions mixed → an insoluble product (silver chloride) drops out as a solid — a precipitation reaction.", "hint": "A solid appears when you mix two clear liquids." },
  { "id": "rt-017", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Incomplete combustion (not enough oxygen) of a hydrocarbon can produce the poisonous gas…", "options": ["carbon dioxide", "carbon monoxide", "oxygen", "nitrogen"], "answerIndex": 1, "explanation": "With limited oxygen, combustion produces carbon monoxide (CO) and soot instead of carbon dioxide.", "hint": "Mono- means one oxygen." },
  { "id": "rt-018", "topic": "reaction-types", "difficulty": 1, "format": "mcq", "prompt": "Which reaction type always has exactly ONE reactant?", "options": ["Synthesis", "Decomposition", "Displacement", "Precipitation"], "answerIndex": 1, "explanation": "Decomposition starts from a single compound (AB → A + B); the others start from two or more reactants.", "hint": "Breaking one thing apart needs only that one thing." },
  { "id": "rt-019", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Classify: 2H₂ + O₂ → 2H₂O.", "options": ["Decomposition", "Synthesis / combustion", "Displacement", "Precipitation"], "answerIndex": 1, "explanation": "Hydrogen and oxygen combine into one product and release energy — it's both a synthesis and a combustion reaction.", "hint": "Two reactants → one product; and it burns." },
  { "id": "rt-020", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Classify: Fe + CuSO₄ → FeSO₄ + Cu.", "options": ["Synthesis", "Decomposition", "Single displacement", "Combustion"], "answerIndex": 2, "explanation": "Iron (more reactive) displaces copper from copper sulfate — single displacement.", "hint": "A metal element swaps with the metal in a compound." },
  { "id": "rt-021", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Will adding copper metal to zinc sulfate solution cause a displacement reaction?", "options": ["Yes — copper displaces zinc", "No — copper is less reactive than zinc, so it can't displace it", "Yes — all metals displace each other", "Only if you heat it strongly"], "answerIndex": 1, "explanation": "Displacement only happens if the added metal is MORE reactive than the one in the compound; copper is below zinc, so no reaction.", "hint": "Check the reactivity series — is copper above or below zinc?" },
  { "id": "rt-022", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Which equation represents a decomposition reaction?", "options": ["A + B → AB", "AB + CD → AD + CB", "CaCO₃ → CaO + CO₂", "Zn + 2HCl → ZnCl₂ + H₂"], "answerIndex": 2, "explanation": "CaCO₃ → CaO + CO₂ is one reactant splitting into two products — decomposition (thermal decomposition of a carbonate).", "hint": "Look for one substance becoming two." },
  { "id": "rt-023", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Methane burns in oxygen: CH₄ + 2O₂ → CO₂ + 2H₂O. Which statement is correct?", "options": ["It is endothermic", "It is complete combustion, releasing energy", "It produces carbon monoxide", "It is a decomposition reaction"], "answerIndex": 1, "explanation": "Plenty of oxygen → complete combustion → CO₂ + H₂O, and it gives out heat (exothermic).", "hint": "The products are the 'clean' ones, so oxygen wasn't limited." },
  { "id": "rt-024", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "A student mixes lead nitrate solution with potassium iodide solution and a bright yellow solid forms. The yellow solid is…", "options": ["a gas that has dissolved", "a precipitate (lead iodide)", "potassium metal", "unreacted lead nitrate"], "answerIndex": 1, "explanation": "The insoluble product, lead iodide, forms as a yellow precipitate — a precipitation reaction.", "hint": "A solid product appearing from two solutions = a precipitate." },
  { "id": "rt-025", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Which of these is a synthesis (combination) reaction?", "options": ["2KClO₃ → 2KCl + 3O₂", "N₂ + 3H₂ → 2NH₃", "Mg + 2HCl → MgCl₂ + H₂", "AgNO₃ + NaCl → AgCl + NaNO₃"], "answerIndex": 1, "explanation": "Nitrogen and hydrogen combining into a single product (ammonia) is synthesis; the others are decomposition, displacement and precipitation.", "hint": "Find the one where the reactants merge into one product." },
  { "id": "rt-026", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "When a metal reacts with oxygen, the general product is…", "options": ["a metal carbonate", "a metal hydroxide", "a metal oxide", "a metal chloride"], "answerIndex": 2, "explanation": "Metal + oxygen → metal oxide (e.g. 2Mg + O₂ → 2MgO) — a synthesis reaction.", "hint": "Oxygen + a metal makes an … oxide." },
  { "id": "rt-027", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Magnesium reacts more vigorously with dilute acid than iron does. This is mainly because…", "options": ["magnesium is denser", "magnesium is higher in the reactivity series than iron", "iron is a non-metal", "the magnesium is heated first"], "answerIndex": 1, "explanation": "The more reactive a metal (the higher in the series), the faster it reacts with acid — magnesium is above iron.", "hint": "Reactivity series: which of the two is higher up?" },
  { "id": "rt-028", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "During a reaction the test tube feels hot. This reaction is…", "options": ["endothermic", "exothermic", "a precipitation reaction by definition", "impossible"], "answerIndex": 1, "explanation": "Heat released to the surroundings ⇒ exothermic (combustion, neutralisation and many others are exothermic).", "hint": "Heat OUT = exo." },
  { "id": "rt-029", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Hydrogen peroxide breaking down into water and oxygen, 2H₂O₂ → 2H₂O + O₂, is which reaction type?", "options": ["Synthesis", "Decomposition", "Combustion", "Displacement"], "answerIndex": 1, "explanation": "One reactant (H₂O₂) splitting into two products — decomposition.", "hint": "One thing → two things." },
  { "id": "rt-030", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Which pair of solutions, when mixed, will NOT produce a precipitate? (Assume all sodium and potassium salts are soluble.)", "options": ["Silver nitrate + sodium chloride", "Barium chloride + sodium sulfate", "Sodium chloride + potassium nitrate", "Lead nitrate + potassium iodide"], "answerIndex": 2, "explanation": "All the possible products of NaCl + KNO₃ are soluble, so nothing precipitates; the other mixes form insoluble AgCl, BaSO₄ or PbI₂.", "hint": "If every possible product is soluble, no solid forms." },
  { "id": "rt-031", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Aluminium powder reacts with iron(III) oxide in the 'thermite' reaction: 2Al + Fe₂O₃ → Al₂O₃ + 2Fe. This is a…", "options": ["synthesis reaction", "decomposition reaction", "single displacement reaction", "precipitation reaction"], "answerIndex": 2, "explanation": "Aluminium (more reactive) displaces iron from its oxide — single displacement (and it's strongly exothermic).", "hint": "One metal takes the oxygen away from another metal's oxide." },
  { "id": "rt-032", "topic": "reaction-types", "difficulty": 2, "format": "mcq", "prompt": "Which observation best indicates that combustion is occurring?", "options": ["A solid sinks to the bottom of a beaker", "A fuel burns with a flame, getting hotter and giving off CO₂ and water vapour", "Two clear solutions stay clear when mixed", "A compound is split apart by an electric current"], "answerIndex": 1, "explanation": "A flame, heat output, and CO₂ + water as products are the signatures of combustion.", "hint": "Think about what burning a candle looks like." },
  { "id": "rt-033", "topic": "reaction-types", "difficulty": 2, "format": "balanceEquation", "prompt": "Balance the decomposition of water: __ H₂O → __ H₂ + __ O₂", "equation": { "reactants": [ { "formula": "H2O", "coeff": 2 } ], "products": [ { "formula": "H2", "coeff": 2 }, { "formula": "O2", "coeff": 1 } ] }, "explanation": "2H₂O → 2H₂ + O₂ — 4 H and 2 O on each side. This is the electrolysis of water.", "hint": "Make the oxygen balance first: O₂ has 2 oxygens, so you need 2 H₂O." },
  { "id": "rt-034", "topic": "reaction-types", "difficulty": 2, "format": "balanceEquation", "prompt": "Balance the synthesis that happens when iron rusts: __ Fe + __ O₂ → __ Fe₂O₃", "equation": { "reactants": [ { "formula": "Fe", "coeff": 4 }, { "formula": "O2", "coeff": 3 } ], "products": [ { "formula": "Fe2O3", "coeff": 2 } ] }, "explanation": "4Fe + 3O₂ → 2Fe₂O₃ — 4 Fe and 6 O on each side; this is what slowly forms when iron rusts.", "hint": "Each Fe₂O₃ has 2 Fe and 3 O — try 2 of them, then balance the Fe and the O₂." },
  { "id": "rt-035", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "A reaction is AB + CD → AD + CB. This 'swap-partners' pattern is a…", "options": ["synthesis reaction", "decomposition reaction", "double displacement reaction (precipitation and neutralisation are examples of it)", "combustion reaction"], "answerIndex": 2, "explanation": "Two compounds exchanging ions is a double displacement; precipitation and acid–base neutralisation are special cases of it.", "hint": "Both compounds keep one part and swap the other." },
  { "id": "rt-036", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Predict the products: zinc + dilute hydrochloric acid →", "options": ["zinc chloride + water", "zinc oxide + hydrogen", "zinc chloride + hydrogen", "no reaction"], "answerIndex": 2, "explanation": "A reactive metal + an acid → a salt + hydrogen gas: Zn + 2HCl → ZnCl₂ + H₂ (a single-displacement-type reaction).", "hint": "Metal + acid always gives a salt and one particular gas — which gas?" },
  { "id": "rt-037", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Copper(II) oxide is heated with carbon: 2CuO + C → 2Cu + CO₂. Which statement is correct?", "options": ["Copper gains oxygen", "Carbon displaces copper because, in this reaction, carbon takes the oxygen", "It is a synthesis reaction", "It is a precipitation reaction"], "answerIndex": 1, "explanation": "Carbon removes the oxygen from copper oxide (reducing it to copper metal): CuO → Cu and C → CO₂ — a displacement-type reduction.", "hint": "Which element ends up holding the oxygen at the end?" },
  { "id": "rt-038", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Using the reactivity series K > Na > Ca > Mg > Al > Zn > Fe > Cu > Ag, which reaction will actually occur?", "options": ["Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag", "Ag + Cu(NO₃)₂ → AgNO₃ + Cu", "Cu + ZnSO₄ → CuSO₄ + Zn", "Au + NaCl → AuCl + Na"], "answerIndex": 0, "explanation": "Copper is above silver, so copper displaces silver from silver nitrate; the others ask a less-reactive metal to displace a more-reactive one — which can't happen.", "hint": "The displacing metal must be HIGHER in the series than the one it's replacing." },
  { "id": "rt-039", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Heating potassium chlorate: 2KClO₃ → 2KCl + 3O₂. Classify it and name the gas released.", "options": ["Synthesis; the gas is hydrogen", "Decomposition; the gas is oxygen", "Combustion; the gas is carbon dioxide", "Displacement; the gas is chlorine"], "answerIndex": 1, "explanation": "One compound broken down by heat into two products — decomposition; the gas released is oxygen.", "hint": "One reactant → two products; then look at what's given off." },
  { "id": "rt-040", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Which equation is correctly classified?", "options": ["CaO + H₂O → Ca(OH)₂ — decomposition", "2Na + Cl₂ → 2NaCl — displacement", "Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃ — precipitation", "C + O₂ → CO₂ — decomposition"], "answerIndex": 2, "explanation": "Lead iodide is insoluble, so PbI₂ drops out as a precipitate — a precipitation (double-displacement) reaction; the other three are mislabelled (they're synthesis, synthesis, and combustion/synthesis).", "hint": "Find the one where an insoluble solid forms from two solutions." },
  { "id": "rt-041", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Why does iron rust (react with oxygen and water) while gold jewellery does not corrode?", "options": ["Gold is denser than iron", "Gold is far less reactive than iron — it's near the bottom of the reactivity series", "Gold is a non-metal", "Iron has no electrons to lose"], "answerIndex": 1, "explanation": "Reactivity decreases down the series; iron reacts with O₂/water (rusting), while gold is so unreactive it stays as the metal.", "hint": "Where do iron and gold sit in the reactivity series?" },
  { "id": "rt-042", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "A hydrocarbon is burned in a limited supply of air. Compared with complete combustion, the products will include…", "options": ["only carbon dioxide and water", "carbon monoxide and/or soot (carbon), as well as water", "hydrogen gas and oxygen", "metal oxides"], "answerIndex": 1, "explanation": "Incomplete combustion (limited O₂) yields CO and/or unburnt carbon (soot) alongside water, instead of all CO₂.", "hint": "Not enough oxygen → the carbon can't all become CO₂." },
  { "id": "rt-043", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "A reaction mixture's temperature DROPS during the reaction. The reaction is…", "options": ["exothermic — it released energy", "endothermic — it absorbed energy from the surroundings", "a combustion reaction", "not a real reaction"], "answerIndex": 1, "explanation": "Temperature falling means the reaction took in energy from the surroundings — it's endothermic (some decomposition reactions and dissolving certain salts behave this way).", "hint": "Heat IN from the surroundings = endo = it feels cold." },
  { "id": "rt-044", "topic": "reaction-types", "difficulty": 3, "format": "mcq", "prompt": "Magnesium ribbon is added to copper(II) sulfate solution; the blue colour fades, the mixture warms up, and a reddish solid coats the ribbon. Identify the reaction and the reddish solid.", "options": ["Precipitation; the solid is magnesium hydroxide", "Single displacement; the solid is copper metal", "Decomposition; the solid is sulfur", "Synthesis; the solid is magnesium oxide"], "answerIndex": 1, "explanation": "Mg (more reactive) displaces Cu from CuSO₄: Mg + CuSO₄ → MgSO₄ + Cu; the blue Cu²⁺ leaves solution and copper metal deposits on the ribbon — and it's exothermic.", "hint": "The blue colour is the copper ion in solution — where does that copper end up?" },
  { "id": "rt-045", "topic": "reaction-types", "difficulty": 3, "format": "balanceEquation", "prompt": "Balance the complete combustion of methane: __ CH₄ + __ O₂ → __ CO₂ + __ H₂O", "equation": { "reactants": [ { "formula": "CH4", "coeff": 1 }, { "formula": "O2", "coeff": 2 } ], "products": [ { "formula": "CO2", "coeff": 1 }, { "formula": "H2O", "coeff": 2 } ] }, "explanation": "CH₄ + 2O₂ → CO₂ + 2H₂O — 1 C, 4 H and 4 O on each side.", "hint": "Balance C, then H (you'll need 2 H₂O), then count the O atoms on the right and match them with O₂." }
]
```

- [ ] **Step 2: Wire it into `loadGameContent.ts`.** Add the import alongside the existing question imports:

```ts
import atomicStructure from './data/questions/atomic-structure.json';
import bonding from './data/questions/bonding.json';
import reactionTypes from './data/questions/reaction-types.json';
```

and change the `questions` line in the `ContentLoader.fromRaw({ … })` call so it reads:

```ts
    questions: { 'atomic-structure': atomicStructure as unknown[], 'bonding': bonding as unknown[], 'reaction-types': reactionTypes as unknown[] },
```

- [ ] **Step 3: Gates.** `node -e "const q=JSON.parse(require('fs').readFileSync('src/content/data/questions/reaction-types.json','utf8'));const c={1:0,2:0,3:0};q.forEach(x=>c[x.difficulty]++);console.log(q.length,c,q.filter(x=>x.format==='balanceEquation').map(x=>x.id),q.every(x=>typeof x.hint==='string'&&x.hint.length>0),new Set(q.map(x=>x.id)).size===q.length)"` — Expected: `45 { '1': 18, '2': 16, '3': 11 } [ 'rt-033', 'rt-034', 'rt-045' ] true true`. Then `npx tsc --noEmit`; `npm test` (145 pass — `reaction-types` is a known topic now, no region uses it yet, no warnings); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/questions/reaction-types.json src/content/loadGameContent.ts
git commit -m "feat(content): reaction-types question bank (45 Q) + load it"
```

---

## Task 6: NPCs — 3 mentors

**Files:**
- Modify: `src/content/data/npcs.json`

`alchemist-vera` is `npcIds[0]` (the region's quest NPC): both her teach-path final node and her skip node set `setFlag: "lesson_reaction-types_seen"`. `shrinekeeper-cinder` has a node with `launch: "shrine"`. Tiles match `reaction-hollow.json`. `node[0]` is the entry node; every `next`/`choices.next` resolves; terminal nodes carry `end: true`.

- [ ] **Step 1: Add the 3 NPCs to `npcs.json`.** After the existing last entry (`"shrinekeeper-mortar": { ... }`), add a comma to that entry then append:

```json
  "alchemist-vera": {
    "id": "alchemist-vera", "name": "Alchemist Vera", "spriteKey": "npc_alchemist_vera", "tile": { "x": 11, "y": 12 }, "facing": "down",
    "dialogue": [
      { "id": "v0", "speaker": "Alchemist Vera", "text": "Reaction Hollow. Down here every reaction has a SHAPE — once you see the shape you can name it, and once you can name it you can use it. Want the shapes, or have you classified reactions before?", "choices": [ { "label": "Show me the shapes.", "next": "v1" }, { "label": "I've classified reactions — let me through.", "next": "v_skip" } ] },
      { "id": "v1", "speaker": "Alchemist Vera", "text": "SYNTHESIS (combination): two things become one. A + B → AB. Iron + sulfur → iron sulfide; a metal + oxygen → a metal oxide. Reactants merge; one product comes out.", "next": "v2" },
      { "id": "v2", "speaker": "Alchemist Vera", "text": "DECOMPOSITION: one thing becomes two. AB → A + B. Heat a metal carbonate and it gives a metal oxide + CO₂; run a current through water and it splits into H₂ + O₂.", "next": "v3" },
      { "id": "v3", "speaker": "Alchemist Vera", "text": "PRECIPITATION: mix two solutions and an insoluble solid drops out — we mark it with ↓ or (s). Silver nitrate + sodium chloride gives a white silver-chloride precipitate. A solid appears from two clear liquids.", "next": "v4" },
      { "id": "v4", "speaker": "Alchemist Vera", "text": "That's three of the five shapes. Pyrologist Ignis, further up, keeps the other two — COMBUSTION and DISPLACEMENT. Learn all five and the Eternal Flame won't fool you. Off you go.", "end": true, "setFlag": "lesson_reaction-types_seen" },
      { "id": "v_skip", "speaker": "Alchemist Vera", "text": "Confident! Then name the corrupted reactions up ahead as you fight them. Remember — a wrong answer just fizzles the move; it never hurts you. Go.", "end": true, "setFlag": "lesson_reaction-types_seen" }
    ]
  },
  "pyrologist-ignis": {
    "id": "pyrologist-ignis", "name": "Pyrologist Ignis", "spriteKey": "npc_pyrologist_ignis", "tile": { "x": 7, "y": 8 }, "facing": "down",
    "dialogue": [
      { "id": "o0", "speaker": "Pyrologist Ignis", "text": "Vera gave you the quiet shapes. I keep the loud ones. First: COMBUSTION.", "next": "o1" },
      { "id": "o1", "speaker": "Pyrologist Ignis", "text": "COMBUSTION: a fuel reacts with oxygen, releasing heat and light — it's EXOTHERMIC. Burn a hydrocarbon completely and you get carbon dioxide + water. Starve it of oxygen and you get carbon monoxide and soot instead.", "next": "o2" },
      { "id": "o2", "speaker": "Pyrologist Ignis", "text": "DISPLACEMENT: a more reactive metal kicks a less reactive one out of its compound. Zinc + copper sulfate → zinc sulfate + copper — the copper plates out as metal.", "next": "o3" },
      { "id": "o3", "speaker": "Pyrologist Ignis", "text": "How do you know which way it goes? The REACTIVITY SERIES: K, Na, Ca, Mg, Al, Zn, Fe, Cu, Ag, Au — high displaces low. Magnesium displaces copper; copper can't displace magnesium. Same rule tells you which metals rust or fizz in acid.", "next": "o4" },
      { "id": "o4", "speaker": "Pyrologist Ignis", "text": "Combustion, displacement — plus Vera's synthesis, decomposition, precipitation. Five shapes. The Flame at the top of the Hollow is combustion gone wild; classify it and you can quench it. Go.", "end": true }
    ]
  },
  "shrinekeeper-cinder": {
    "id": "shrinekeeper-cinder", "name": "Shrinekeeper Cinder", "spriteKey": "npc_shrinekeeper_cinder", "tile": { "x": 4, "y": 12 }, "facing": "right",
    "dialogue": [
      { "id": "s0", "speaker": "Shrinekeeper Cinder", "text": "The Cinder Shrine — no monsters, just questions on reaction types. Clear it and you'll carry off an Energy Cell and a fresh Buffer. Step in?", "choices": [ { "label": "Enter the Shrine.", "next": "s_enter" }, { "label": "Not yet.", "next": "s_later" } ] },
      { "id": "s_enter", "speaker": "Shrinekeeper Cinder", "text": "Six questions. One miss is forgiven; two and the embers spit you out. Begin when ready.", "end": true, "setFlag": "shrine_entered_reaction-hollow", "launch": "shrine" },
      { "id": "s_later", "speaker": "Shrinekeeper Cinder", "text": "The Shrine keeps its embers warm. Come back when you've studied.", "end": true }
    ]
  }
```

- [ ] **Step 2: Gates.** `node -e "JSON.parse(require('fs').readFileSync('src/content/data/npcs.json','utf8')); console.log('ok')"`; `npx tsc --noEmit`; `npm test` (145 pass — `validateNpc` passes; the asset-key test now checks `npc_alchemist_vera`/`npc_pyrologist_ignis`/`npc_shrinekeeper_cinder` (entries from Task 1); the NPC-walkability test walks the new trees); `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/content/data/npcs.json
git commit -m "feat(content): Region 3 mentors (Vera, Ignis, Cinder)"
```

---

## Task 7: `OverworldScene` — register the tilemap + add the biome palette

**Files:**
- Modify: `src/scenes/OverworldScene.ts`

- [ ] **Step 1: Add the tilemap import.** Change:

```ts
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../content/data/tilemaps/bonding-forge.json';
```

to:

```ts
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../content/data/tilemaps/bonding-forge.json';
import reactionHollow from '../content/data/tilemaps/reaction-hollow.json';
```

- [ ] **Step 2: Register it in `TILEMAPS`.** Change:

```ts
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
  tilemap_bonding_forge: bondingForge as unknown as TilemapData,
};
```

to:

```ts
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
  tilemap_bonding_forge: bondingForge as unknown as TilemapData,
  tilemap_reaction_hollow: reactionHollow as unknown as TilemapData,
};
```

- [ ] **Step 3: Add the biome palette.** In the `BIOMES` map, after the `tiles_bonding_forge` entry, add:

```ts
  tiles_reaction_hollow: {
    floor: 0x2b2622, path: 0x9a4a1c, tallGrass: 0x7d4014,
    wallFace: 0x1c1814, wallTop: 0x35302a, wallBase: 0x0d0b08, wallLine: 0x060504,
    waterFill: 0x4a1808, waterLine: 0x2a0c02,
  },
```

- [ ] **Step 4: Gates.** `npx tsc --noEmit` (clean); `npm test` (145 pass — `overworld.test.ts` only covers `overworldHelpers`); `npm run build`.

- [ ] **Step 5: Commit.**

```bash
git add src/scenes/OverworldScene.ts
git commit -m "feat(scenes): OverworldScene — register the Reaction Hollow tilemap + biome palette"
```

---

## Task 8: `WorldMapScene` — drop the now-built region's locked label

**Files:**
- Modify: `src/scenes/WorldMapScene.ts`

- [ ] **Step 1: Trim `LOCKED_REGION_LABELS`.** Change:

```ts
// Labels for the not-yet-built regions; the first content.regions.length nodes come from content.
const LOCKED_REGION_LABELS = [
  'Reaction Hollow',
  'The Balance Halls',
  'Catalyst Crags',
  'The Acid Wastes',
  'The Crucible',
  "Equilibrium's Heart",
];
```

to:

```ts
// Labels for the not-yet-built regions; the first content.regions.length nodes come from content.
const LOCKED_REGION_LABELS = [
  'The Balance Halls',
  'Catalyst Crags',
  'The Acid Wastes',
  'The Crucible',
  "Equilibrium's Heart",
];
```

- [ ] **Step 2: Gates.** `npx tsc --noEmit`; `npm test` (145 pass — no WorldMapScene test); `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/scenes/WorldMapScene.ts
git commit -m "feat(scenes): WorldMapScene — Reaction Hollow is a real node now"
```

---

## Task 9: Region entry + Region-2 unlock flip — `regions.json`

**Files:**
- Modify: `src/content/data/regions.json`

By now `reaction-types` is a loaded question topic (Task 5) and every referenced enemy/sprite/tileset/bg key exists (Tasks 1, 4), so `loadGameContent().warnings` stays `[]`.

- [ ] **Step 1: Flip Region 2's `unlocksRegionId`.** In the `bonding-forge` object, change:

```json
    "unlocksRegionId": null,
```

to:

```json
    "unlocksRegionId": "reaction-hollow",
```

- [ ] **Step 2: Append the Region 3 object.** Add a comma after the `bonding-forge` object's closing `}` and add:

```json
  {
    "id": "reaction-hollow", "index": 3, "name": "Reaction Hollow", "topic": "reaction-types",
    "tilemapKey": "tilemap_reaction_hollow", "tilesetKey": "tiles_reaction_hollow", "battleBackgroundKey": "bg_battle_reaction_hollow",
    "wildEnemyIds": ["synthor", "combustix", "decomposeer", "displacid"],
    "encounterRatePerStep": 0.10,
    "miniBossId": "volatile-mixture",
    "regionBossId": "the-eternal-flame",
    "npcIds": ["alchemist-vera", "pyrologist-ignis", "shrinekeeper-cinder"],
    "shrine": { "questionTopic": "reaction-types", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 700, "rewardItemIds": ["energy-cell", "buffer"] },
    "unlocksRegionId": null,
    "bossReward": { "xp": 850, "itemIds": ["reagent", "isotope-core"], "skillId": "combustion-flare" }
  }
```

- [ ] **Step 3: Gates.** `node -e "JSON.parse(require('fs').readFileSync('src/content/data/regions.json','utf8')); console.log('ok')"`; `npx tsc --noEmit`; `npm test` (145 pass — `loadGameContent().warnings` is still `[]`; `realContent.test.ts`'s Region-1 and Region-2 tests still pass; the asset-key test now also checks `tiles_reaction_hollow` + `bg_battle_reaction_hollow` (entries from Task 1)); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/regions.json
git commit -m "feat(content): add Region 3 (Reaction Hollow); Region 2 unlocks it"
```

---

## Task 10: Tests — Region 3 coverage in `realContent.test.ts`

**Files:**
- Modify: `tests/content/realContent.test.ts`

Add: the `reaction-hollow.json` import; add `'reaction-hollow'` to the first-NPC-reachability test's `maps` record (so that test doesn't throw when it iterates the new region); a Region 3 existence/shape test; a reaction-types-bank size/difficulty test; a `reaction-hollow.json` parses+shape test.

- [ ] **Step 1: Add the import** at the top of the file, next to the other tilemap imports:

```ts
import elementalReaches from '../../src/content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../../src/content/data/tilemaps/bonding-forge.json';
import reactionHollow from '../../src/content/data/tilemaps/reaction-hollow.json';
```

- [ ] **Step 2: Register the new tilemap in the reachability test's `maps` record.** In the `it('first-lesson NPCs are reachable before the mini-boss gate in every shipped region', …)` test, change:

```ts
    const maps: Record<string, AuditTilemap> = {
      'elemental-reaches': elementalReaches as AuditTilemap,
      'bonding-forge': bondingForge as AuditTilemap,
    };
```

to:

```ts
    const maps: Record<string, AuditTilemap> = {
      'elemental-reaches': elementalReaches as AuditTilemap,
      'bonding-forge': bondingForge as AuditTilemap,
      'reaction-hollow': reactionHollow as AuditTilemap,
    };
```

- [ ] **Step 3: Add the new test cases** inside the existing `describe('shipped content', () => { … })` block (before its closing `});`):

```ts
  it('Region 3 (reaction-hollow) exists, index 3, topic "reaction-types", with a valid mini-boss and region boss; Region 2 unlocks it', () => {
    const { content } = loadGameContent();
    const r3 = content.regions.find(r => r.index === 3)!;
    expect(r3.id).toBe('reaction-hollow');
    expect(r3.topic).toBe('reaction-types');
    expect(content.enemies[r3.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r3.regionBossId]?.role).toBe('regionBoss');
    const r2 = content.regions.find(r => r.index === 2)!;
    expect(r2.unlocksRegionId).toBe('reaction-hollow');
  });
  it('reaction-types question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['reaction-types']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the reaction-hollow tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = reactionHollow as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
```

- [ ] **Step 4: Gates.** `npx tsc --noEmit`; `npm test` — Expected: **148 pass** (145 + 3 new; the existing reachability / first-lesson-flag / NPC-walkability tests now also cover Region 3 and must stay green). `npm run build`.

- [ ] **Step 5: Commit.**

```bash
git add tests/content/realContent.test.ts
git commit -m "test(content): Region 3 + reaction-types bank + tilemap coverage"
```

---

## Task 11: Finish the branch — merge, deploy, tag

- [ ] **Step 1: Final full gate run.** `npx tsc --noEmit` (clean); `npm test` (148 pass); `npm run build` (succeeds).

- [ ] **Step 2: Merge to `main` and push** (push auto-deploys `dist/` to GitHub Pages):

```bash
git checkout main
git merge --no-ff feat/region3-reaction-hollow -m "feat: Region 3 — Reaction Hollow"
git push origin main
```

- [ ] **Step 3: Tag the release and push the tag:**

```bash
git tag -a v0.4.0-region3 -m "Region 3 — Reaction Hollow"
git push origin v0.4.0-region3
```

- [ ] **Step 4: Watch the deploy.** `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` — Expected: the "Deploy to GitHub Pages" run completes successfully.

- [ ] **Step 5: Smoke (deploy).** Visit https://irvincisneros-png.github.io/equilibrium-lost/ — from a save with Region 2 cleared, the World Map shows "Reaction Hollow" unlocked with "◀ START HERE"; entering it shows the volcanic biome (obsidian/ember), the 3 mentors (★ on Alchemist Vera until you talk to her, and she's reachable from spawn before the mini-boss), the reaction-types lesson dialogue (which pauses page-to-page and node-to-node), tall-grass wild battles with reaction-types questions (incl. the balance-equation widget items), the Cinder Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north stays sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The Eternal Flame* shows the "Equilibrium restored to Reaction Hollow!" banner + ✓ on the World Map, learns `combustion-flare`, lands the reward items; loading mid-Region-3 resumes correctly.

---

## Self-review notes

- **Spec coverage:** every bullet in §"Scope of the content" + §"Code changes" + §"Tests" + §"Balance" of the design spec maps to a task (regions.json → T9; reaction-types.json → T5; tilemap → T2; npcs → T6; enemies (7 incl. the split-half) → T4; skills+classes → T3; assetManifest → T1; OverworldScene → T7; WorldMapScene → T8; loadGameContent → T5; tests → T10; the spec's `node -e JSON.parse` parses-check → T2 step 2 + T5 step 3 + T10 step 3; the ordering-note → reflected in the task order). main.ts: no change, as the spec says.
- **No placeholders:** all JSON content and code diffs are given in full.
- **Type consistency:** `tiles_reaction_hollow` is used identically as the region's `tilesetKey`, the manifest key, the `BIOMES` key; `tilemap_reaction_hollow` as the region's `tilemapKey` and the `TILEMAPS`/manifest-tilemaps key; the mini-boss flag `miniboss_reaction-hollow_done` matches `battleVictory.ts`'s `miniboss_${region.id}_done` with `region.id === 'reaction-hollow'`; all new enemy `spriteKey`s and npc `spriteKey`s match the placeholder keys added in T1; `the-eternal-flame.spriteKey === 'enemy_eternal_flame'` (no `the_` prefix, mirroring R1/R2's bosses); `decomposeer.splitIntoId === 'decomposeer-half'` which is a defined enemy with `spriteKey: 'enemy_decomposeer_half'`; `displacid.teachesSkillId === 'synthesis-fuse'` and `the-eternal-flame.teachesSkillId === bossReward.skillId === 'combustion-flare'` are all defined skills; the test's `reactionHollow` import + `maps` entry match the new tilemap path; `q.format === 'balanceEquation'` ids `rt-033`/`rt-034`/`rt-045` match the bank.
