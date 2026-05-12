# Region 2 — The Bonding Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the second playable region — *The Bonding Forge* (NSW Year 10 Chemistry: ionic/covalent/metallic bonding, why compounds form, simple formulae, common polyatomic ions) — fully playable end-to-end, and wire the World Map's unlock chain so clearing Region 1 opens Region 2.

**Architecture:** Almost entirely **content** (JSON in `src/content/data/`): a new `regions.json` entry, a ~45-question `questions/bonding.json` bank, a hand-authored `tilemaps/bonding-forge.json` grid, 3 mentor NPCs, 6 enemies (4 wild + a mini-boss + the region boss *The Sundered Lattice*), 3 new bonding-affinity skills + 1 enemy-only filler skill, and `assetManifest.json` placeholder entries. Plus **small code generalisations**: `WorldMapScene` renders all `content.regions` and uses the `unlocksRegionId` chain; `OverworldScene` registers the 2nd tilemap, uses a per-region `lesson_<topic>_seen` flag instead of the hard-coded `lesson_atomic_structure_seen`, and gains an optional per-biome tile palette; `loadGameContent.ts` imports the new question bank. No new scenes, no engine changes.

**Tech Stack:** Phaser 3 · TypeScript (strict, `noUncheckedIndexedAccess`) · Vite · Vitest. Source of truth: `docs/superpowers/specs/2026-05-12-equilibrium-lost-region2-bonding-forge-design.md`.

---

## How to read this plan

- Region 1 was built from `docs/superpowers/plans/2026-05-11-equilibrium-lost-milestone-1.md`; **follow that codebase's patterns** (data-driven JSON, pure helpers unit-tested, Phaser scenes render-only).
- Every gate stays green at **every commit**: `npx tsc --noEmit`, `npm test`, `npm run build`. There are 139 existing tests; this milestone adds a handful.
- Task ordering matters so that no commit ever leaves `loadGameContent().warnings` non-empty (the `realContent.test.ts` "no cross-reference warnings" assertion). In particular: the **assetManifest placeholders** must land before the enemies/NPCs/region that reference their sprite keys; the **`bonding.json` import in `loadGameContent.ts`** must land before the region entry whose `topic` is `"bonding"`.
- Work on branch `feat/region2-bonding-forge` (already created). Commit per task. When all gates are green, merge to `main` (no PR — push to main auto-deploys to GitHub Pages), then tag `v0.3.0-region2`.

---

## Decisions locked for Region 2

| # | Decision |
|---|----------|
| Region id / index | `bonding-forge` / `index: 2` / name `"The Bonding Forge"` / `topic: "bonding"` |
| Asset keys | tileset `tiles_bonding_forge`, battle bg `bg_battle_bonding_forge`, tilemap `tilemap_bonding_forge` |
| Wild enemies | `bond-mote` (Covalent, Lv5 — the deliberate pushover), `ion-shard` (Ionic, Lv6), `covalent-wisp` (Covalent, Lv7 — `teachesSkillId: "covalent-shell"`), `slag-golem` (Metal, Lv9) |
| Mini-boss | `unstable-halide` (Ionic, Lv11, `role: "miniBoss"`, `bossSoftScale: false`) |
| Region boss | `the-sundered-lattice` (Metal, Lv14, `role: "regionBoss"`, `bossSoftScale: true`, `teachesSkillId: "lattice-collapse"`) |
| New skills (topic `"bonding"`, quizzed) | `ionic-bond` (Ionic, applies `oxidised`), `covalent-shell` (Covalent, applies `endothermicChill`), `lattice-collapse` (Metal, `stripBuffs`) |
| New enemy-only filler skill (topic `null`) | `lattice-flux` (Metal) — the `isotope-flux`-style filler the region boss uses |
| Class skill unlocks (added) | pyron: L13 `ionic-bond`, L16 `lattice-collapse` · aqualis: L14 `covalent-shell`, L16 `lattice-collapse` · ionix: L13 `ionic-bond`, L14 `covalent-shell` |
| Mentors | `smith-valentia` (Master Smith Valentia — ionic + metallic; **quest NPC**, sets `lesson_bonding_seen`), `lorekeeper-octet` (Lorekeeper Octet — covalent + why-compounds-form + polyatomic ions), `shrinekeeper-mortar` (Shrinekeeper Mortar — shrine intro, node with `launch: "shrine"`) |
| Shrine | `{ questionTopic: "bonding", questionCount: 6, passRatio: 0.8333, rewardXp: 400, rewardItemIds: ["energy-cell", "buffer"] }` |
| Boss reward | `{ xp: 500, itemIds: ["reagent", "isotope-core"], skillId: "lattice-collapse" }` |
| Region 1 change | `regions[0].unlocksRegionId`: `null` → `"bonding-forge"` |
| Mini-boss flag | `miniboss_bonding-forge_done` — **hyphenated** to match `battleVictory.ts`'s `miniboss_${region.id}_done`. (Bonus task K also fixes Region 1's tilemap, which currently uses the under-scored `miniboss_elemental_reaches_done` that `battleVictory.ts` never sets — leaving R1 stuck past the mini-boss.) |
| Question bank | 45 questions: 18 difficulty-1, 16 difficulty-2, 11 difficulty-3; 42 `mcq` + 3 `balanceEquation` (`b-033` Mg+Cl₂→MgCl₂ d2, `b-034` Na+Cl₂→NaCl d2, `b-045` Na+O₂→Na₂O d3). Every item carries a `hint`. |
| Biome palette | iron-grey floor, copper paths, ember-brown tall-grass, dark-iron walls — placeholder-quality, keyed by `region.tilesetKey` with the elemental-reaches palette as the default. |

---

## File structure

**New files**
- `src/content/data/questions/bonding.json` — 45-question bank, topic `"bonding"`.
- `src/content/data/tilemaps/bonding-forge.json` — hand-authored 24×18 grid (same format as `elemental-reaches.json`).

**Modified content**
- `src/content/data/assetManifest.json` — add `images` + `placeholders` for `tiles_bonding_forge`, `bg_battle_bonding_forge`, 6 `enemy_*`, 3 `npc_*`; add `tilemaps.tilemap_bonding_forge`.
- `src/content/data/skills.json` — add `ionic-bond`, `covalent-shell`, `lattice-collapse`, `lattice-flux`.
- `src/content/data/classes.json` — add the new `skillUnlocks` entries to all three classes.
- `src/content/data/enemies.json` — add 6 enemies.
- `src/content/data/npcs.json` — add 3 mentors.
- `src/content/data/regions.json` — append the Region 2 entry; flip Region 1's `unlocksRegionId`.

**Modified code**
- `src/content/loadGameContent.ts` — `import bonding from './data/questions/bonding.json'`; add `'bonding': bonding` to the `questions` map.
- `src/scenes/OverworldScene.ts` — add `tilemap_bonding_forge` to `TILEMAPS`; replace the 3 hard-coded `lesson_atomic_structure_seen` reads with `lesson_${region.topic}_seen`; replace the `TILE_COLOR` const + inline wall/water colours with a `BIOMES` palette map.
- `src/scenes/WorldMapScene.ts` — render every `content.regions` entry as a real node; trim `LOCKED_REGION_LABELS` (lose "The Bonding Forge" → 6 entries); unlock = `region.index === 1 || someone-who-unlocks-me-is-bossDefeated`; "◀ START HERE" tracks the first not-yet-cleared unlocked content region.

**Modified tests**
- `tests/content/realContent.test.ts` — add the Region 2 test, the bonding-bank test, a `bonding-forge.json` parses+shape test, and an NPC-dialogue-walkability test.

**Bonus bugfix**
- `src/content/data/tilemaps/elemental-reaches.json` — `miniboss_elemental_reaches_done` → `miniboss_elemental-reaches_done` in both the `minibossTrigger.flag` and the `bossGate.requiresFlag`.

---

## Task 1: assetManifest — new image + placeholder + tilemap entries

**Files:**
- Modify: `src/content/data/assetManifest.json`

Adding these *first* (before anything references the keys) keeps `realContent.test.ts`'s asset-key cross-ref green at every later commit. The asset-key test only checks that *referenced* keys have entries; unreferenced extra entries are harmless.

- [ ] **Step 1: Add the new `images` entries.** In the `"images"` object, after the existing `"bg_battle_elemental_reaches": ...` line (or anywhere before `"ui_textbox"`), add:

```json
    "tiles_bonding_forge": "assets/images/tiles_bonding_forge.png",
    "bg_battle_bonding_forge": "assets/images/bg_battle_bonding_forge.png",
    "enemy_bond_mote": "assets/images/enemy_bond_mote.png",
    "enemy_ion_shard": "assets/images/enemy_ion_shard.png",
    "enemy_covalent_wisp": "assets/images/enemy_covalent_wisp.png",
    "enemy_slag_golem": "assets/images/enemy_slag_golem.png",
    "enemy_unstable_halide": "assets/images/enemy_unstable_halide.png",
    "enemy_sundered_lattice": "assets/images/enemy_sundered_lattice.png",
    "npc_smith_valentia": "assets/images/npc_smith_valentia.png",
    "npc_lorekeeper_octet": "assets/images/npc_lorekeeper_octet.png",
    "npc_shrinekeeper_mortar": "assets/images/npc_shrinekeeper_mortar.png",
```

- [ ] **Step 2: Add the tilemap entry.** Change the `"tilemaps"` line from:

```json
  "tilemaps": { "tilemap_elemental_reaches": "src/content/data/tilemaps/elemental-reaches.json" },
```

to:

```json
  "tilemaps": { "tilemap_elemental_reaches": "src/content/data/tilemaps/elemental-reaches.json", "tilemap_bonding_forge": "src/content/data/tilemaps/bonding-forge.json" },
```

- [ ] **Step 3: Add the new `placeholders` entries.** In the `"placeholders"` array, after the last `icon_status_*` entry (and before the closing `]`), add a comma to the previous last entry then:

```json
    { "key": "tiles_bonding_forge", "w": 64, "h": 64, "color": "#4f4a44", "label": "" },
    { "key": "bg_battle_bonding_forge", "w": 1920, "h": 896, "color": "#2a211a", "label": "" },
    { "key": "enemy_bond_mote", "w": 96, "h": 96, "color": "#c7b07a", "label": "Bond Mote" },
    { "key": "enemy_ion_shard", "w": 128, "h": 128, "color": "#c97f50", "label": "Ion Shard" },
    { "key": "enemy_covalent_wisp", "w": 128, "h": 128, "color": "#9b8bd4", "label": "Cov. Wisp" },
    { "key": "enemy_slag_golem", "w": 160, "h": 160, "color": "#7a7268", "label": "Slag Golem" },
    { "key": "enemy_unstable_halide", "w": 192, "h": 192, "color": "#d98a3d", "label": "Halide" },
    { "key": "enemy_sundered_lattice", "w": 256, "h": 256, "color": "#9a7a6a", "label": "SUNDERED LATTICE" },
    { "key": "npc_smith_valentia", "w": 64, "h": 96, "color": "#b5651d", "label": "Va" },
    { "key": "npc_lorekeeper_octet", "w": 64, "h": 96, "color": "#6a8caf", "label": "Oc" },
    { "key": "npc_shrinekeeper_mortar", "w": 64, "h": 96, "color": "#8a6d3b", "label": "Mo" }
```

- [ ] **Step 4: Gates.** Run `npx tsc --noEmit` (clean), `npm test` (139 pass), `npm run build` (succeeds).

- [ ] **Step 5: Commit.**

```bash
git add src/content/data/assetManifest.json
git commit -m "feat(content): asset manifest entries for Region 2 (Bonding Forge)"
```

---

## Task 2: Tilemap — `tilemaps/bonding-forge.json`

**Files:**
- Create: `src/content/data/tilemaps/bonding-forge.json`

A 24×18 grid (same schema as `elemental-reaches.json`). Tile ids: `0` floor, `1` path, `2` water/slag (blocked — unused here), `3` wall, `4` tall-grass (encounter). Layout: player spawns bottom-centre (`11,14`), a path winds up past Master Smith Valentia (`11,12`), branches left along row 12 to Shrinekeeper Mortar (`4,12`) and the shrine entrance (`3,12`), continues up through a tall-grass corridor at column 11 (rows 5–8) to the Forge-Gate wall (row 4) whose only opening is the mini-boss chokepoint at `11,4`; past it the sealed tile `11,3` then the boss gate `11,2`. Lorekeeper Octet sits at `7,8` on a path stub. Tall-grass pockets sit at cols 2–4 / 18–21 on rows 6–8 and rows 15–16. `canEnter` in `OverworldScene` seals the tile directly north of an undefeated `minibossTrigger` (`o.y - 1`), so the chokepoint must run north — it does.

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
    { "type": "npc", "id": "smith-valentia", "x": 11, "y": 12 },
    { "type": "npc", "id": "lorekeeper-octet", "x": 7, "y": 8 },
    { "type": "npc", "id": "shrinekeeper-mortar", "x": 4, "y": 12 },
    { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "bonding-forge" },
    { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "unstable-halide", "flag": "miniboss_bonding-forge_done" },
    { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-sundered-lattice", "requiresFlag": "miniboss_bonding-forge_done" }
  ]
}
```

- [ ] **Step 2: Verify it parses.** Run: `node -e "JSON.parse(require('fs').readFileSync('src/content/data/tilemaps/bonding-forge.json','utf8')); console.log('ok')"` — Expected: `ok`.

- [ ] **Step 3: Gates.** `npx tsc --noEmit`, `npm test` (139 pass — nothing imports the tilemap yet), `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/tilemaps/bonding-forge.json
git commit -m "feat(content): Region 2 tilemap (the Bonding Forge grid)"
```

---

## Task 3: Skills + class unlocks

**Files:**
- Modify: `src/content/data/skills.json`
- Modify: `src/content/data/classes.json`

Three new quizzed bonding-affinity skills (topic `"bonding"`, powers 38–46, energy 25–30, one with a `behavior`), plus one enemy-only filler (`lattice-flux`, topic `null`, like `isotope-flux`). These are flavour, not a balance overhaul.

- [ ] **Step 1: Add the 4 skills to `skills.json`.** Before the final `"isotope-flux": { ... }` line's closing `}` of the object, add a comma after `isotope-flux` and append (keeping the file a single JSON object):

```json
  "ionic-bond":       { "id": "ionic-bond", "name": "Ionic Bond", "affinity": "Ionic", "power": 40, "energyCost": 25, "topic": "bonding", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "oxidised", "chance": 35, "turns": 3, "magnitude": 0 } }, "description": "Forces an electron transfer — locks the target into a brittle lattice. May inflict Oxidised (DEF drain)." },
  "covalent-shell":   { "id": "covalent-shell", "name": "Covalent Shell", "affinity": "Covalent", "power": 38, "energyCost": 25, "topic": "bonding", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "endothermicChill", "chance": 30, "turns": 2, "magnitude": 0 } }, "description": "Weaves a shared electron pair into a tight shell around the target. May reduce ATK." },
  "lattice-collapse": { "id": "lattice-collapse", "name": "Lattice Collapse", "affinity": "Metal", "power": 40, "energyCost": 30, "topic": "bonding", "questionDifficulty": 3, "accuracy": 90, "isSignature": false, "isCatalystBurst": false, "behavior": { "stripBuffs": true }, "description": "Collapses a metallic lattice inward — crystallises the target's stat boosts back out of solution." },
  "lattice-flux":     { "id": "lattice-flux", "name": "Lattice Flux", "affinity": "Metal", "power": 36, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Sundered Lattice's attack — a pulse of collapsing crystal structure." }
```

- [ ] **Step 2: Add the new unlocks to `classes.json`.** In each class's `skillUnlocks` array, append the entries (keep the existing entries, just add the new ones inside the same array):
  - `pyron.skillUnlocks`: append `{ "level": 13, "skillId": "ionic-bond" }, { "level": 16, "skillId": "lattice-collapse" }`
  - `aqualis.skillUnlocks`: append `{ "level": 14, "skillId": "covalent-shell" }, { "level": 16, "skillId": "lattice-collapse" }`
  - `ionix.skillUnlocks`: append `{ "level": 13, "skillId": "ionic-bond" }, { "level": 14, "skillId": "covalent-shell" }`

  For example, `pyron`'s line becomes:

```json
    "skillUnlocks": [ { "level": 3, "skillId": "ionize" }, { "level": 5, "skillId": "thermal-vent" }, { "level": 7, "skillId": "neutralize" }, { "level": 9, "skillId": "decompose" }, { "level": 10, "skillId": "combustion-cascade" }, { "level": 13, "skillId": "ionic-bond" }, { "level": 16, "skillId": "lattice-collapse" } ],
```

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` (139 pass — `validateSkill` passes the new entries; cross-refs resolve; each class still has exactly one Catalyst Burst skill); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/skills.json src/content/data/classes.json
git commit -m "feat(content): bonding-affinity skills + class unlocks (L13-16)"
```

---

## Task 4: Enemies

**Files:**
- Modify: `src/content/data/enemies.json`

Six new entries: 4 wild "corrupted bond" enemies (Lv 5–9, roughly equal `xpYield` so the Forge grass levels the player toward the boss; `bond-mote` is the deliberate Lv-5 pushover), the `unstable-halide` mini-boss (Lv 11), and *The Sundered Lattice* region boss (Lv 14, `bossSoftScale: true`, uses `lattice-collapse` + `ionic-bond` + the `lattice-flux` filler, `teachesSkillId: "lattice-collapse"`).

- [ ] **Step 1: Add the 6 enemies to `enemies.json`.** Append before the closing `}` of the object (comma after the existing last entry `the-unstable-isotope`):

```json
  "bond-mote":         { "id": "bond-mote", "name": "Bond Mote", "affinity": "Covalent", "baseStats": { "hp": 24, "atk": 8, "def": 4, "spd": 8 }, "level": 5, "attackPower": 18, "skillIds": [], "xpYield": 48, "role": "wild", "spriteKey": "enemy_bond_mote" },
  "ion-shard":         { "id": "ion-shard", "name": "Ion Shard", "affinity": "Ionic", "baseStats": { "hp": 42, "atk": 11, "def": 9, "spd": 7 }, "level": 6, "attackPower": 22, "skillIds": ["ionic-bond"], "xpYield": 54, "role": "wild", "spriteKey": "enemy_ion_shard" },
  "covalent-wisp":     { "id": "covalent-wisp", "name": "Covalent Wisp", "affinity": "Covalent", "baseStats": { "hp": 38, "atk": 11, "def": 7, "spd": 14 }, "level": 7, "attackPower": 22, "skillIds": ["covalent-shell"], "xpYield": 56, "role": "wild", "spriteKey": "enemy_covalent_wisp", "teachesSkillId": "covalent-shell" },
  "slag-golem":        { "id": "slag-golem", "name": "Slag Golem", "affinity": "Metal", "baseStats": { "hp": 60, "atk": 14, "def": 13, "spd": 5 }, "level": 9, "attackPower": 26, "skillIds": ["ionic-bond"], "xpYield": 62, "role": "wild", "spriteKey": "enemy_slag_golem" },
  "unstable-halide":   { "id": "unstable-halide", "name": "Unstable Halide", "affinity": "Ionic", "baseStats": { "hp": 130, "atk": 17, "def": 12, "spd": 8 }, "level": 11, "attackPower": 28, "skillIds": ["ionic-bond", "covalent-shell"], "xpYield": 130, "role": "miniBoss", "spriteKey": "enemy_unstable_halide", "bossSoftScale": false },
  "the-sundered-lattice": { "id": "the-sundered-lattice", "name": "The Sundered Lattice", "affinity": "Metal", "baseStats": { "hp": 220, "atk": 22, "def": 16, "spd": 9 }, "level": 14, "attackPower": 32, "skillIds": ["lattice-collapse", "ionic-bond", "lattice-flux"], "xpYield": 400, "role": "regionBoss", "spriteKey": "enemy_sundered_lattice", "bossSoftScale": true, "teachesSkillId": "lattice-collapse" }
```

- [ ] **Step 2: Gates.** `npx tsc --noEmit`; `npm test` (139 pass — the asset-key test now checks `enemy_bond_mote` … `enemy_sundered_lattice`, which got entries in Task 1; "every skill id referenced by an enemy exists" checks `ionic-bond`/`covalent-shell`/`lattice-collapse`/`lattice-flux`, which got entries in Task 3); `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/content/data/enemies.json
git commit -m "feat(content): Region 2 enemies (4 wild + mini-boss + The Sundered Lattice)"
```

---

## Task 5: Question bank — `questions/bonding.json` + `loadGameContent.ts`

**Files:**
- Create: `src/content/data/questions/bonding.json`
- Modify: `src/content/loadGameContent.ts`

45 questions on the NSW Year 10 bonding unit (ionic/covalent/metallic bonding, why compounds form, simple formulae, properties, common polyatomic ions), authored at Year-10 reading level: 18 difficulty-1, 16 difficulty-2 (incl. 2 `balanceEquation`), 11 difficulty-3 (incl. 1 `balanceEquation`). Every item has a `hint` (Study Mode). All pass `validateQuestion`. **Do both files in one commit** so no commit has the region pointing at a topic with no questions.

- [ ] **Step 1: Create `src/content/data/questions/bonding.json`** with exactly this content:

```json
[
  { "id": "b-001", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "What type of bond forms when a metal transfers electrons to a non-metal?", "options": ["Covalent bond", "Ionic bond", "Metallic bond", "Hydrogen bond"], "answerIndex": 1, "explanation": "Metal + non-metal with electron transfer gives an ionic bond.", "hint": "Think 'transfer', not 'share'." },
  { "id": "b-002", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "What type of bond forms when two non-metal atoms share electrons?", "options": ["Ionic bond", "Metallic bond", "Covalent bond", "Nuclear bond"], "answerIndex": 2, "explanation": "Two non-metals sharing electron pairs is a covalent bond.", "hint": "Non-metal + non-metal = sharing." },
  { "id": "b-003", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "In metallic bonding, the positive metal ions are held together by…", "options": ["a sea of delocalised electrons", "shared neutrons", "negative ions", "covalent double bonds"], "answerIndex": 0, "explanation": "Metallic bonding is a lattice of cations sitting in a 'sea' of delocalised (free-moving) electrons.", "hint": "What can drift through the metal and lets it conduct electricity?" },
  { "id": "b-004", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Why do atoms form chemical bonds?", "options": ["To become radioactive", "To achieve a stable, full outer electron shell", "To gain extra protons", "To get rid of their nucleus"], "answerIndex": 1, "explanation": "Atoms bond to reach a stable, noble-gas (full outer shell) configuration.", "hint": "Noble gases are stable because their outer shells are already full." },
  { "id": "b-005", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "When a metal atom forms an ionic bond it usually…", "options": ["loses electrons and becomes a positive ion", "gains electrons and becomes a negative ion", "shares electrons equally", "loses protons"], "answerIndex": 0, "explanation": "Metals lose their few outer electrons, becoming positive ions (cations).", "hint": "Lose electrons → fewer negatives → net positive charge." },
  { "id": "b-006", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "When a non-metal atom forms an ionic bond it usually…", "options": ["loses electrons and becomes a positive ion", "gains electrons and becomes a negative ion", "loses neutrons", "turns into a noble gas atom"], "answerIndex": 1, "explanation": "Non-metals gain electrons to complete their outer shell, becoming negative ions (anions).", "hint": "Gain electrons → more negatives → net negative charge." },
  { "id": "b-007", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Sodium chloride (table salt, NaCl) is an example of which kind of substance?", "options": ["A covalent molecule", "An ionic compound", "A metal", "A noble gas"], "answerIndex": 1, "explanation": "Na (a metal) transfers an electron to Cl (a non-metal): an ionic compound.", "hint": "A metal joined to a non-metal." },
  { "id": "b-008", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Which of these substances contains covalent bonds?", "options": ["Sodium chloride, NaCl", "Magnesium oxide, MgO", "Water, H₂O", "Potassium fluoride, KF"], "answerIndex": 2, "explanation": "Water is made of non-metals (hydrogen and oxygen) sharing electrons — covalent bonding.", "hint": "Find the one made only of non-metals." },
  { "id": "b-009", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "A typical property of ionic compounds is that they…", "options": ["have very low melting points", "have high melting and boiling points", "are always liquids at room temperature", "conduct electricity well as solids"], "answerIndex": 1, "explanation": "Strong attractions throughout the giant ionic lattice mean a lot of energy is needed to melt or boil them.", "hint": "Breaking up a giant 3-D lattice of ions takes a lot of energy." },
  { "id": "b-010", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Why does solid sodium chloride NOT conduct electricity?", "options": ["It contains no charged particles", "Its ions are locked in place and cannot move", "It is made of neutral molecules", "It is not cold enough"], "answerIndex": 1, "explanation": "In the solid the ions are fixed in the lattice; only when molten or dissolved can they move and carry charge.", "hint": "Conduction needs charged particles that are free to move." },
  { "id": "b-011", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "An ionic compound conducts electricity when it is…", "options": ["a dry solid", "frozen solid", "molten or dissolved in water", "cooled to absolute zero"], "answerIndex": 2, "explanation": "Melting or dissolving frees the ions so they can move and carry a current.", "hint": "The ions need to be free to move." },
  { "id": "b-012", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Metals are good conductors of electricity because they contain…", "options": ["delocalised electrons that are free to move", "free-moving protons", "loosely held neutrons", "trapped water molecules"], "answerIndex": 0, "explanation": "The 'sea' of delocalised electrons carries the electric current.", "hint": "Something negatively charged drifts through the metal lattice." },
  { "id": "b-013", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Which set of properties best describes most metals?", "options": ["Brittle, dull, non-conducting", "Malleable, lustrous, good conductors", "Gaseous, colourless, unreactive", "Soft, crumbly, insulating"], "answerIndex": 1, "explanation": "Metals are typically malleable, ductile, lustrous (shiny) and conduct heat and electricity.", "hint": "Think of copper wire or a steel beam." },
  { "id": "b-014", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "A single covalent bond consists of…", "options": ["one shared pair of electrons", "two electrons transferred from one atom to another", "a sea of electrons", "a shared proton"], "answerIndex": 0, "explanation": "A single covalent bond is one shared pair (two electrons) between two atoms.", "hint": "'Pair' means two." },
  { "id": "b-015", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "How many electrons are shared in a DOUBLE covalent bond?", "options": ["1", "2", "4", "8"], "answerIndex": 2, "explanation": "A double bond is two shared pairs = 4 electrons (as in O=O).", "hint": "Two pairs." },
  { "id": "b-016", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Covalent molecular substances such as carbon dioxide tend to have low melting points because…", "options": ["the bonds inside the molecules are weak", "the forces between separate molecules are weak", "they are made of ions", "they contain delocalised electrons"], "answerIndex": 1, "explanation": "The covalent bonds within a molecule are strong, but the attractions between separate molecules are weak — so little energy is needed to pull them apart.", "hint": "Melting separates whole molecules; it does not break the bonds inside them." },
  { "id": "b-017", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Which element is the LEAST likely to form chemical bonds?", "options": ["Sodium", "Oxygen", "Argon", "Fluorine"], "answerIndex": 2, "explanation": "Argon is a noble gas with a full outer shell, so it is almost completely unreactive.", "hint": "Look for the noble gas." },
  { "id": "b-018", "topic": "bonding", "difficulty": 1, "format": "mcq", "prompt": "Which substance is a giant covalent (network) structure?", "options": ["Sodium chloride", "Diamond", "Copper", "Argon"], "answerIndex": 1, "explanation": "Diamond is a giant covalent lattice of carbon atoms, each bonded to four others.", "hint": "It is a very hard form of pure carbon." },
  { "id": "b-019", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Magnesium (Group 2) reacts with chlorine (Group 17). What is the formula of the compound formed?", "options": ["MgCl", "MgCl₂", "Mg₂Cl", "Mg₂Cl₃"], "answerIndex": 1, "explanation": "Mg forms Mg²⁺ and Cl forms Cl⁻; you need two Cl⁻ to balance one Mg²⁺ → MgCl₂.", "hint": "Balance the charges: a 2+ ion needs two 1− ions." },
  { "id": "b-020", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "What is the formula of the ionic compound made from sodium ions (Na⁺) and oxide ions (O²⁻)?", "options": ["NaO", "Na₂O", "NaO₂", "Na₂O₃"], "answerIndex": 1, "explanation": "Two Na⁺ are needed to balance one O²⁻ → Na₂O.", "hint": "Two 1+ ions balance one 2− ion." },
  { "id": "b-021", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Which compound is held together by ionic bonds?", "options": ["CO₂", "H₂O", "CaO", "CH₄"], "answerIndex": 2, "explanation": "Calcium oxide (CaO) is a metal + a non-metal → ionic; the others contain only non-metals → covalent.", "hint": "Spot the one with a metal in it." },
  { "id": "b-022", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "An atom of element X (Group 1) reacts with an atom of element Y (Group 17). What happens to the electrons?", "options": ["Y transfers one electron to X", "X transfers one electron to Y", "X and Y share two electrons", "Neither atom changes"], "answerIndex": 1, "explanation": "Group 1 metals lose their single outer electron to Group 17 non-metals, forming X⁺ and Y⁻.", "hint": "The metal gives; the non-metal takes." },
  { "id": "b-023", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Why is an ionic compound such as magnesium oxide hard and brittle?", "options": ["The ions are only weakly attracted", "Strong forces hold the ions in a rigid lattice, which shatters when layers are forced to shift", "It is made of soft molecules", "It contains a sea of electrons"], "answerIndex": 1, "explanation": "Forcing the lattice to slide brings like-charges next to each other; they repel and the crystal cracks.", "hint": "What happens if a row of + ions slides next to another row of + ions?" },
  { "id": "b-024", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Why are metals malleable (can be hammered into shape) rather than brittle?", "options": ["Their ions repel each other strongly", "Layers of metal ions can slide over each other while the electron 'sea' still holds everything together", "They contain water", "Their covalent bonds simply bend"], "answerIndex": 1, "explanation": "The delocalised electrons let layers of cations slip past one another without the structure breaking apart.", "hint": "The electron sea keeps the lattice held together as the layers move." },
  { "id": "b-025", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Carbon dioxide has the formula CO₂. What kind of bonding holds a CO₂ molecule together?", "options": ["Ionic bonds", "Metallic bonds", "Covalent bonds (double bonds)", "Hydrogen bonds only"], "answerIndex": 2, "explanation": "C and O are both non-metals, so they share electrons; in CO₂ each C=O link is a double covalent bond.", "hint": "Two non-metals → sharing." },
  { "id": "b-026", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Which statement about a covalent molecular substance like O₂ is correct?", "options": ["It conducts electricity well", "It has a very high melting point", "It does not conduct electricity", "It is a giant lattice of ions"], "answerIndex": 2, "explanation": "Covalent molecular substances have no free charged particles, so they do not conduct.", "hint": "No free ions and no delocalised electrons = no conduction." },
  { "id": "b-027", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "What is the formula of calcium chloride, made from Ca²⁺ and Cl⁻?", "options": ["CaCl", "CaCl₂", "Ca₂Cl", "CaCl₃"], "answerIndex": 1, "explanation": "One Ca²⁺ needs two Cl⁻ to balance the charge → CaCl₂.", "hint": "A 2+ ion is balanced by two 1− ions." },
  { "id": "b-028", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "What is the formula of the ionic compound containing sodium ions (Na⁺) and sulfate ions (SO₄²⁻)?", "options": ["NaSO₄", "Na₂SO₄", "Na(SO₄)₂", "Na₂(SO₄)₃"], "answerIndex": 1, "explanation": "Two Na⁺ balance one SO₄²⁻ → Na₂SO₄ (sodium sulfate).", "hint": "Treat sulfate, SO₄²⁻, as one unit carrying a 2− charge." },
  { "id": "b-029", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Which of these is the formula of the ammonium ion?", "options": ["NH₃", "NH₄⁺", "NH₄⁻", "N₂H₄"], "answerIndex": 1, "explanation": "The ammonium ion is NH₄⁺ — a polyatomic cation.", "hint": "It is one of the few positively-charged polyatomic ions." },
  { "id": "b-030", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "An atom reaches a noble-gas configuration of 2,8 by gaining 2 electrons. Which ion does it form?", "options": ["A 2+ ion", "A 2− ion", "A 1+ ion", "A 1− ion"], "answerIndex": 1, "explanation": "Gaining 2 electrons gives a 2− charge (for example O²⁻ reaching the neon configuration).", "hint": "Gaining 2 negatives → a charge of 2−." },
  { "id": "b-031", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "Why does sodium form a 1+ ion rather than a 7− ion when it bonds?", "options": ["Losing one electron is far easier than gaining seven", "It has seven outer electrons", "It is a non-metal", "Noble gases always form 1+ ions"], "answerIndex": 0, "explanation": "Sodium has just one outer electron (2,8,1); losing it to reach 2,8 is much easier than gaining seven.", "hint": "Take the easier route to a full outer shell." },
  { "id": "b-032", "topic": "bonding", "difficulty": 2, "format": "mcq", "prompt": "How many covalent bonds does a carbon atom usually form?", "options": ["1", "2", "3", "4"], "answerIndex": 3, "explanation": "Carbon has 4 outer electrons, so it forms 4 covalent bonds to complete its outer shell (as in CH₄).", "hint": "Carbon needs 4 more electrons to fill its outer shell." },
  { "id": "b-033", "topic": "bonding", "difficulty": 2, "format": "balanceEquation", "prompt": "Balance the formation of magnesium chloride: __ Mg + __ Cl₂ → __ MgCl₂", "equation": { "reactants": [ { "formula": "Mg", "coeff": 1 }, { "formula": "Cl2", "coeff": 1 } ], "products": [ { "formula": "MgCl2", "coeff": 1 } ] }, "explanation": "Mg + Cl₂ → MgCl₂ — one magnesium atom, one Cl₂ molecule (2 Cl atoms), one MgCl₂.", "hint": "One Cl₂ molecule already supplies the two chlorines that MgCl₂ needs." },
  { "id": "b-034", "topic": "bonding", "difficulty": 2, "format": "balanceEquation", "prompt": "Balance the formation of sodium chloride: __ Na + __ Cl₂ → __ NaCl", "equation": { "reactants": [ { "formula": "Na", "coeff": 2 }, { "formula": "Cl2", "coeff": 1 } ], "products": [ { "formula": "NaCl", "coeff": 2 } ] }, "explanation": "2Na + Cl₂ → 2NaCl — the Cl₂ molecule gives 2 chlorine atoms, so you need 2 sodium atoms and make 2 NaCl.", "hint": "Start with the Cl₂: it provides 2 chlorine atoms." },
  { "id": "b-035", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Aluminium forms Al³⁺ ions and oxygen forms O²⁻ ions. What is the formula of aluminium oxide?", "options": ["AlO", "Al₂O₃", "Al₃O₂", "AlO₂"], "answerIndex": 1, "explanation": "Balance the charges: two Al³⁺ (total 6+) and three O²⁻ (total 6−) → Al₂O₃.", "hint": "Find the smallest whole numbers so the total + charge equals the total − charge (here, 6 each)." },
  { "id": "b-036", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "What is the formula of calcium hydroxide, built from Ca²⁺ and OH⁻?", "options": ["CaOH", "Ca(OH)₂", "Ca₂OH", "Ca(OH)₃"], "answerIndex": 1, "explanation": "One Ca²⁺ needs two OH⁻ → Ca(OH)₂; the brackets show two hydroxide units.", "hint": "Treat OH⁻ as one 1− unit; you need two of them for one 2+ ion." },
  { "id": "b-037", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "What is the formula of ammonium nitrate, made from NH₄⁺ and NO₃⁻?", "options": ["NH₄NO₃", "(NH₄)₂NO₃", "NH₄(NO₃)₂", "N₂H₄O₃"], "answerIndex": 0, "explanation": "A 1+ ion and a 1− ion combine 1:1 → NH₄NO₃.", "hint": "Both ions carry a charge of one — so one of each." },
  { "id": "b-038", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Substance Q has a very high melting point, does not conduct as a solid, but conducts when molten. Q is most likely…", "options": ["a metal", "an ionic compound", "a covalent molecular substance", "a noble gas"], "answerIndex": 1, "explanation": "High melting point + conducts only when molten or dissolved is the classic fingerprint of an ionic compound.", "hint": "Which class of substance only conducts once its ions are free to move?" },
  { "id": "b-039", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Substance R conducts electricity as a solid, is shiny, and can be bent into wires. R is best classified as…", "options": ["an ionic compound", "a covalent molecular substance", "a metal", "a noble gas"], "answerIndex": 2, "explanation": "Conducts as a solid + lustrous + ductile = metallic bonding.", "hint": "Only one type of solid conducts electricity while still solid." },
  { "id": "b-040", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Substance S is a gas at room temperature, does not conduct electricity, and has a very low boiling point. S is most likely…", "options": ["a metal", "an ionic compound", "a giant covalent network like diamond", "a covalent molecular substance"], "answerIndex": 3, "explanation": "Low boiling point + non-conducting + gaseous = a small-molecule covalent (molecular) substance.", "hint": "Weak forces between molecules → boils easily; no free charges → no conduction." },
  { "id": "b-041", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Why does magnesium oxide (MgO) have a much higher melting point than sodium chloride (NaCl)?", "options": ["MgO is covalent", "The 2+ and 2− ions in MgO attract each other much more strongly than the 1+ and 1− ions in NaCl", "NaCl is a metal", "MgO contains delocalised electrons"], "answerIndex": 1, "explanation": "Larger ionic charges (2+/2−) give stronger electrostatic forces, so more energy is needed to break the MgO lattice.", "hint": "Bigger charges → stronger attraction → higher melting point." },
  { "id": "b-042", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Nitrogen gas is N₂, with the structure N≡N. How many electrons are shared between the two nitrogen atoms?", "options": ["2", "3", "6", "8"], "answerIndex": 2, "explanation": "A triple bond is three shared pairs = 6 electrons; this gives each nitrogen a full outer shell of 8.", "hint": "Triple bond = three shared pairs." },
  { "id": "b-043", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Element Z has the electron configuration 2,8,7. When Z bonds with a Group 1 metal M, which compound forms?", "options": ["MZ (ionic, 1:1)", "MZ₂ (ionic, 1:2)", "M₂Z (ionic, 2:1)", "MZ (covalent)"], "answerIndex": 0, "explanation": "Z (7 outer electrons) gains one electron to form Z⁻; M loses one to form M⁺; they combine 1:1 as the ionic compound MZ.", "hint": "A 1+ ion and a 1− ion pair up one-to-one." },
  { "id": "b-044", "topic": "bonding", "difficulty": 3, "format": "mcq", "prompt": "Which statement correctly compares the bonding WITHIN a water molecule with the forces BETWEEN water molecules?", "options": ["Both are ionic", "The O–H bonds within the molecule are strong covalent bonds; the forces between molecules are much weaker", "The forces between molecules are stronger than the bonds within them", "Both are metallic"], "answerIndex": 1, "explanation": "Strong covalent O–H bonds hold each molecule together; weaker intermolecular forces hold separate molecules near each other — which is why water boils at only 100 °C.", "hint": "If melting or boiling broke the O–H bonds, water vapour would not still be H₂O." },
  { "id": "b-045", "topic": "bonding", "difficulty": 3, "format": "balanceEquation", "prompt": "Balance the formation of sodium oxide: __ Na + __ O₂ → __ Na₂O", "equation": { "reactants": [ { "formula": "Na", "coeff": 4 }, { "formula": "O2", "coeff": 1 } ], "products": [ { "formula": "Na2O", "coeff": 2 } ] }, "explanation": "4Na + O₂ → 2Na₂O — the O₂ molecule supplies 2 oxygen atoms, which need 4 sodium atoms and make 2 Na₂O.", "hint": "O₂ gives 2 oxygens; each Na₂O holds one oxygen, so make 2 of them — then count the sodiums." }
]
```

- [ ] **Step 2: Wire it into `loadGameContent.ts`.** Add the import alongside the existing `atomicStructure` import:

```ts
import atomicStructure from './data/questions/atomic-structure.json';
import bonding from './data/questions/bonding.json';
```

and change the `questions` line in the `ContentLoader.fromRaw({ … })` call from:

```ts
    questions: { 'atomic-structure': atomicStructure as unknown[] },
```

to:

```ts
    questions: { 'atomic-structure': atomicStructure as unknown[], 'bonding': bonding as unknown[] },
```

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` (139 pass — `bonding` is a known topic now, but no region uses it yet, so still no warnings); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/questions/bonding.json src/content/loadGameContent.ts
git commit -m "feat(content): bonding question bank (45 Q) + load it"
```

---

## Task 6: NPCs — 3 mentors

**Files:**
- Modify: `src/content/data/npcs.json`

Three mentors. `smith-valentia` is `npcIds[0]` (the region's quest NPC): both her teach-path final node and her skip node set `setFlag: "lesson_bonding_seen"` (which `OverworldScene` keys the welcome banner / ★ marker / objective off, after Task 7). `shrinekeeper-mortar` has a node with `launch: "shrine"` (mirroring `shrinekeeper-quanta`). Tiles match `bonding-forge.json`. `node[0]` is the entry node; every `next`/`choices.next` resolves to a real node; terminal nodes carry `end: true`.

- [ ] **Step 1: Add the 3 NPCs to `npcs.json`.** Append before the closing `}` of the object (comma after the existing last entry `shrinekeeper-quanta`):

```json
  "smith-valentia": {
    "id": "smith-valentia", "name": "Master Smith Valentia", "spriteKey": "npc_smith_valentia", "tile": { "x": 11, "y": 12 }, "facing": "down",
    "dialogue": [
      { "id": "v0", "speaker": "Master Smith Valentia", "text": "So — you cleared the Reaches. Good. But the Forge is where atoms learn to HOLD ON to one another. Want the basics, or are you ready to forge?", "choices": [ { "label": "Teach me.", "next": "v1" }, { "label": "I know bonding — let me forge.", "next": "v_skip" } ] },
      { "id": "v1", "speaker": "Master Smith Valentia", "text": "Atoms bond to fill their outer shells — to copy a noble gas. METALS have spare outer electrons; NON-METALS have spaces. Put them together and electrons MOVE.", "next": "v2" },
      { "id": "v2", "speaker": "Master Smith Valentia", "text": "That's an IONIC bond. The metal hands its electrons over and becomes a positive CATION; the non-metal takes them and becomes a negative ANION. Opposite charges lock into a giant LATTICE.", "next": "v3" },
      { "id": "v3", "speaker": "Master Smith Valentia", "text": "Ionic compounds are hard, brittle, and melt at high temperatures. Solid, they don't conduct — the ions are pinned. But molten, or dissolved in water, the ions are free to move, so they DO conduct.", "next": "v4" },
      { "id": "v4", "speaker": "Master Smith Valentia", "text": "Metals bond differently again: a lattice of positive ions in a SEA of loose, delocalised electrons. That sea is why metals conduct, why they bend instead of shatter, why they shine. Now — to the anvil.", "end": true, "setFlag": "lesson_bonding_seen" },
      { "id": "v_skip", "speaker": "Master Smith Valentia", "text": "Confident! Then prove it on the corrupted bonds ahead. Remember — a wrong answer just fizzles the move; it never hurts you. Go.", "end": true, "setFlag": "lesson_bonding_seen" }
    ]
  },
  "lorekeeper-octet": {
    "id": "lorekeeper-octet", "name": "Lorekeeper Octet", "spriteKey": "npc_lorekeeper_octet", "tile": { "x": 7, "y": 8 }, "facing": "down",
    "dialogue": [
      { "id": "o0", "speaker": "Lorekeeper Octet", "text": "Valentia bangs metal; I keep the rule that governs it all — the OCTET RULE. Eight electrons in the outer shell and an atom is content. Listen.", "next": "o1" },
      { "id": "o1", "speaker": "Lorekeeper Octet", "text": "When TWO NON-METALS meet, neither will give up electrons — so they SHARE. A shared pair is a COVALENT bond. Share two pairs and that's a double bond; three, a triple.", "next": "o2" },
      { "id": "o2", "speaker": "Lorekeeper Octet", "text": "Covalent atoms clump into small MOLECULES — H₂O, CO₂, O₂. The bonds INSIDE a molecule are strong, but molecules barely cling to one another, so these substances melt and boil low — many are gases or liquids — and they don't conduct.", "next": "o3" },
      { "id": "o3", "speaker": "Lorekeeper Octet", "text": "Why bond at all? Because a full outer shell is stable — the noble-gas configuration. Ionic, covalent, metallic: three roads, one destination.", "next": "o4" },
      { "id": "o4", "speaker": "Lorekeeper Octet", "text": "One last thing: some ions travel in packs — SO₄²⁻ sulfate, NO₃⁻ nitrate, CO₃²⁻ carbonate, OH⁻ hydroxide, NH₄⁺ ammonium. Treat each pack as one charged unit when you write a formula. Now go.", "end": true }
    ]
  },
  "shrinekeeper-mortar": {
    "id": "shrinekeeper-mortar", "name": "Shrinekeeper Mortar", "spriteKey": "npc_shrinekeeper_mortar", "tile": { "x": 4, "y": 12 }, "facing": "right",
    "dialogue": [
      { "id": "s0", "speaker": "Shrinekeeper Mortar", "text": "The Mortar Shrine — no monsters, just questions on bonding. Clear it and you'll carry off an Energy Cell and a fresh Buffer. Step in?", "choices": [ { "label": "Enter the Shrine.", "next": "s_enter" }, { "label": "Not yet.", "next": "s_later" } ] },
      { "id": "s_enter", "speaker": "Shrinekeeper Mortar", "text": "Six questions. One slip is forgiven; two and the Shrine spits you out. Begin when ready.", "end": true, "setFlag": "shrine_entered_bonding-forge", "launch": "shrine" },
      { "id": "s_later", "speaker": "Shrinekeeper Mortar", "text": "The Shrine is patient. Study, then return.", "end": true }
    ]
  }
```

- [ ] **Step 2: Gates.** `npx tsc --noEmit`; `npm test` (139 pass — `validateNpc` passes; the asset-key test now checks `npc_smith_valentia`/`npc_lorekeeper_octet`/`npc_shrinekeeper_mortar`, which got entries in Task 1); `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/content/data/npcs.json
git commit -m "feat(content): Region 2 mentors (Valentia, Octet, Mortar)"
```

---

## Task 7: `OverworldScene` — register the tilemap, generic lesson flag, biome palette

**Files:**
- Modify: `src/scenes/OverworldScene.ts`

Three changes: (a) import `bonding-forge.json` and add it to the `TILEMAPS` registry; (b) replace the 3 hard-coded `lesson_atomic_structure_seen` reads with a per-region `lesson_${region.topic}_seen`; (c) replace the `TILE_COLOR` const + the inline wall/water colours with a `BIOMES` palette map keyed by `region.tilesetKey`, defaulting to the existing (elemental-reaches) palette.

- [ ] **Step 1: Add the tilemap import + registry entry.** Change:

```ts
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';
```

to:

```ts
import elementalReaches from '../content/data/tilemaps/elemental-reaches.json';
import bondingForge from '../content/data/tilemaps/bonding-forge.json';
```

and change:

```ts
// In M1 there is one playable region; future regions add entries here.
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
};
```

to:

```ts
// One entry per playable region; new regions add their hand-authored grid here.
const TILEMAPS: Record<string, TilemapData> = {
  tilemap_elemental_reaches: elementalReaches as unknown as TilemapData,
  tilemap_bonding_forge: bondingForge as unknown as TilemapData,
};
```

- [ ] **Step 2: Replace `TILE_COLOR` with a biome palette.** Change:

```ts
// Walkable tile-id → colour: 0 grass · 1 path · 4 tall-grass. Blocked tiles (2 water, 3 wall) are
// drawn specially (water = dark + sunken outline; wall = a beveled stone block) so they read as impassable.
const TILE_COLOR: Record<number, number> = { 0: 0x4d7a5a, 1: 0xddc193, 4: 0x33623c };
```

to:

```ts
// Per-biome tile colours, keyed by region.tilesetKey. Walkable: floor (id 0), path (id 1),
// tallGrass (id 4). Blocked: walls (id 3, a beveled block — face/top-lit/base-shadow/outline)
// and water (id 2, a sunken pool). Placeholder-quality — just enough so regions read distinctly.
interface BiomePalette {
  floor: number; path: number; tallGrass: number;
  wallFace: number; wallTop: number; wallBase: number; wallLine: number;
  waterFill: number; waterLine: number;
}
const ELEMENTAL_BIOME: BiomePalette = {
  floor: 0x4d7a5a, path: 0xddc193, tallGrass: 0x33623c,
  wallFace: 0x4a443c, wallTop: 0x6b6258, wallBase: 0x2a2620, wallLine: 0x161210,
  waterFill: 0x163454, waterLine: 0x0c1e34,
};
const BIOMES: Record<string, BiomePalette> = {
  tiles_elemental_reaches: ELEMENTAL_BIOME,
  tiles_bonding_forge: {
    floor: 0x4f4a44, path: 0xa86b3a, tallGrass: 0x6e4126,
    wallFace: 0x33302a, wallTop: 0x4d4840, wallBase: 0x1a1814, wallLine: 0x0d0c0a,
    waterFill: 0x2a1810, waterLine: 0x140c08,
  },
};
```

- [ ] **Step 3: Use the palette in the ground-drawing loop.** In `create()`, just before the `// --- ground layer ...` block, add:

```ts
    const pal = BIOMES[region.tilesetKey] ?? ELEMENTAL_BIOME;
```

Then change the ground loop body from:

```ts
        if (id === 3) { // wall — a beveled stone block: clearly impassable
          ground.fillStyle(0x4a443c, 1); ground.fillRect(px, py, ts, ts);
          ground.fillStyle(0x6b6258, 1); ground.fillRect(px, py, ts, lip);             // lit top
          ground.fillStyle(0x2a2620, 1); ground.fillRect(px, py + ts - lip, ts, lip);  // shadowed base
          ground.lineStyle(2, 0x161210, 1); ground.strokeRect(px, py, ts, ts);
        } else if (id === 2) { // water — blocked, sunken
          ground.fillStyle(0x163454, 1); ground.fillRect(px, py, ts, ts);
          ground.lineStyle(3, 0x0c1e34, 1); ground.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        } else { // grass / path / tall-grass — walkable
          ground.fillStyle(TILE_COLOR[id] ?? 0xff00ff, 1); ground.fillRect(px, py, ts, ts);
        }
```

to:

```ts
        if (id === 3) { // wall — a beveled block: clearly impassable
          ground.fillStyle(pal.wallFace, 1); ground.fillRect(px, py, ts, ts);
          ground.fillStyle(pal.wallTop, 1); ground.fillRect(px, py, ts, lip);             // lit top
          ground.fillStyle(pal.wallBase, 1); ground.fillRect(px, py + ts - lip, ts, lip); // shadowed base
          ground.lineStyle(2, pal.wallLine, 1); ground.strokeRect(px, py, ts, ts);
        } else if (id === 2) { // water — blocked, sunken
          ground.fillStyle(pal.waterFill, 1); ground.fillRect(px, py, ts, ts);
          ground.lineStyle(3, pal.waterLine, 1); ground.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        } else { // floor / path / tall-grass — walkable
          ground.fillStyle(id === 1 ? pal.path : id === 4 ? pal.tallGrass : pal.floor, 1);
          ground.fillRect(px, py, ts, ts);
        }
```

- [ ] **Step 4: Per-region lesson flag — welcome banner + ★ marker.** Change the block in `create()` from:

```ts
    // --- mark the first-lesson NPC (a bobbing "★" while the lesson is unread) + a one-time welcome banner ---
    if (!this.flag('lesson_atomic_structure_seen')) {
```

to:

```ts
    // --- mark the first-lesson NPC (a bobbing "★" while the lesson is unread) + a one-time welcome banner ---
    if (!this.flag(`lesson_${region.topic}_seen`)) {
```

- [ ] **Step 5: Per-region lesson flag — `update()` ★ visibility.** Change in `override update()`:

```ts
      if (this.questNpc && !this.flag('lesson_atomic_structure_seen')) {
```

to:

```ts
      if (this.questNpc && !this.flag(`lesson_${this.region.topic}_seen`)) {
```

- [ ] **Step 6: Per-region lesson flag — `currentObjective()`.** Change:

```ts
    if (!this.flag('lesson_atomic_structure_seen')) return `Talk to ${this.content.npcs[this.region.npcIds[0] ?? '']?.name ?? 'the mentor'} (look for the ★)`;
```

to:

```ts
    if (!this.flag(`lesson_${this.region.topic}_seen`)) return `Talk to ${this.content.npcs[this.region.npcIds[0] ?? '']?.name ?? 'the mentor'} (look for the ★)`;
```

- [ ] **Step 7: Gates.** `npx tsc --noEmit` (clean — `pal` is `BiomePalette` via the `?? ELEMENTAL_BIOME` fallback; `region`/`this.region` are in scope at each edit site); `npm test` (139 pass — `overworld.test.ts` only covers `overworldHelpers`); `npm run build`.

- [ ] **Step 8: Commit.**

```bash
git add src/scenes/OverworldScene.ts
git commit -m "feat(scenes): OverworldScene — 2nd tilemap, per-region lesson flag, biome palette"
```

---

## Task 8: `WorldMapScene` — render all regions, unlock chain, START-HERE tracking

**Files:**
- Modify: `src/scenes/WorldMapScene.ts`

Render every `content.regions` entry as a real node, then fill the remaining of 8 slots from `LOCKED_REGION_LABELS` (which loses "The Bonding Forge" → 6 entries). A content node is unlocked when `region.index === 1` **or** some other content region whose `unlocksRegionId === node.id` has `bossDefeated`. "◀ START HERE" tracks the first not-yet-cleared unlocked content region (so it moves to Region 2 once Region 1 is cleared). The bottom completion banner shows once the last content region is cleared.

- [ ] **Step 1: Trim `LOCKED_REGION_LABELS`.** Change:

```ts
// Nodes 2–8 labels (Region 1 comes from content.regions[0])
const LOCKED_REGION_LABELS = [
  'The Bonding Forge',
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
  'Reaction Hollow',
  'The Balance Halls',
  'Catalyst Crags',
  'The Acid Wastes',
  'The Crucible',
  "Equilibrium's Heart",
];
```

- [ ] **Step 2: Rewrite the node build + per-node state.** Replace everything from `// Region 1 from content; nodes 2–8 from LOCKED_REGION_LABELS` down to (and including) the `nodes.forEach((node, i) => { … });` block with:

```ts
    // Real nodes for every shipped region, padded out to 8 with the locked labels.
    interface NodeInfo { id: string; label: string; region?: RegionDef; }
    const nodes: NodeInfo[] = content.regions.map(r => ({ id: r.id, label: r.name, region: r }));
    LOCKED_REGION_LABELS.forEach((label, i) => {
      nodes.push({ id: 'locked-region-' + (content.regions.length + i + 1), label });
    });

    // A content region is unlocked when it's the first region, or some other region whose
    // unlocksRegionId points at it has had its boss defeated.
    const isContentUnlocked = (r: RegionDef): boolean =>
      r.index === 1 || content.regions.some(prev => prev.unlocksRegionId === r.id && (save.regionProgress[prev.id]?.bossDefeated ?? false));

    // "◀ START HERE" follows the first unlocked content region that hasn't been cleared yet.
    const startHereId = (() => {
      for (const r of content.regions) {
        if (isContentUnlocked(r) && !(save.regionProgress[r.id]?.bossDefeated ?? false)) return r.id;
      }
      return null;
    })();

    // Layout: nodes arranged vertically, two columns (alternating left/right)
    const nodeW = 560;
    const nodeH = 90;
    const colLeft = 200;
    const colRight = W - 200 - nodeW;
    const startY = 72;
    const stepY = 110;

    nodes.forEach((node, i) => {
      const isLeft = i % 2 === 0;
      const nx = isLeft ? colLeft : colRight;
      const ny = startY + i * stepY;

      const regionProgress = save.regionProgress[node.id];
      const isUnlocked = node.region ? isContentUnlocked(node.region) : false;
      const isBossDefeated = regionProgress?.bossDefeated ?? false;
      const isCurrent = save.currentRegionId === node.id;

      const bgColor = isCurrent ? NODE_CURRENT : (isUnlocked ? NODE_UNLOCKED : NODE_LOCKED);
      const borderColor = isUnlocked ? NODE_BORDER_UNLOCKED : NODE_BORDER_LOCKED;

      const bg = this.add.rectangle(nx + nodeW / 2, ny + nodeH / 2, nodeW, nodeH, bgColor)
        .setStrokeStyle(4, borderColor);

      // Node label
      const labelColor = isUnlocked ? TEXT_COLOR : DIM_COLOR;
      const displayLabel = (isUnlocked ? '' : '🔒 ') + node.label;
      this.add.text(nx + 24, ny + nodeH / 2, displayLabel, {
        fontFamily: FONT, fontSize: '28px', color: labelColor
      }).setOrigin(0, 0.5);

      // ✓ on boss defeated
      if (isBossDefeated) {
        this.add.text(nx + nodeW - 24, ny + nodeH / 2, '✓', {
          fontFamily: FONT, fontSize: '32px', color: '#a6e3a1'
        }).setOrigin(1, 0.5);
      }

      // Player marker
      if (isCurrent) {
        this.add.text(nx + nodeW - 24, ny + nodeH / 2, '▶', {
          fontFamily: FONT, fontSize: '32px', color: '#f9e2af'
        }).setOrigin(1, 0.5);
      }

      // "Start here" hint on the first uncleared unlocked region
      if (node.id === startHereId) {
        this.add.text(nx + nodeW + 20, ny + nodeH / 2, '◀ START HERE', {
          fontFamily: FONT, fontSize: '24px', color: '#a6e3a1', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
      }

      // Connector line to next node
      if (i < nodes.length - 1) {
        const nextLeft = (i + 1) % 2 === 0;
        const nextNx = nextLeft ? colLeft : colRight;
        const nextNy = startY + (i + 1) * stepY;
        const g = this.add.graphics();
        g.lineStyle(4, DIM_COLOR_NUM, 0.4);
        g.beginPath();
        g.moveTo(nx + nodeW / 2, ny + nodeH);
        g.lineTo(nextNx + nodeW / 2, nextNy);
        g.strokePath();
      }

      // Interactivity
      bg.setInteractive({ useHandCursor: isUnlocked });
      bg.on('pointerdown', () => {
        if (isUnlocked) {
          this.enterRegion(node.id);
        } else {
          this.showToast('Restore the previous region\'s equilibrium first.');
        }
      });
    });
```

- [ ] **Step 3: Generalise the completion banner.** Replace:

```ts
    // Completion banner (Region 1 boss defeated — end of M1 slice)
    if (region1 && (save.regionProgress[region1.id]?.bossDefeated ?? false)) {
```

with:

```ts
    // Completion banner — shows once the last shipped region's boss is down.
    const lastRegion: RegionDef | undefined = content.regions[content.regions.length - 1];
    if (lastRegion && (save.regionProgress[lastRegion.id]?.bossDefeated ?? false)) {
```

(Remove the now-unused `const region1: RegionDef | undefined = content.regions[0];` line if it remains — the rewritten code no longer references `region1`.)

- [ ] **Step 4: Gates.** `npx tsc --noEmit` (clean — `RegionDef` is already imported; `nodes` uses `content.regions.length + i + 1` ids that can't collide with real region ids); `npm test` (139 pass — no WorldMapScene test); `npm run build`.

- [ ] **Step 5: Commit.**

```bash
git add src/scenes/WorldMapScene.ts
git commit -m "feat(scenes): WorldMapScene — render all regions + unlocksRegionId chain"
```

---

## Task 9: Region entry + Region-1 unlock flip — `regions.json`

**Files:**
- Modify: `src/content/data/regions.json`

Append the Region 2 object and flip Region 1's `unlocksRegionId`. By now `bonding` is a loaded question topic (Task 5) and every referenced enemy/sprite/tileset/bg key exists (Tasks 1, 4), so `loadGameContent().warnings` stays `[]`.

- [ ] **Step 1: Flip Region 1's `unlocksRegionId`.** In the first object, change:

```json
    "unlocksRegionId": null,
```

to:

```json
    "unlocksRegionId": "bonding-forge",
```

- [ ] **Step 2: Append the Region 2 object.** Add a comma after the first object's closing `}` and add:

```json
  {
    "id": "bonding-forge", "index": 2, "name": "The Bonding Forge", "topic": "bonding",
    "tilemapKey": "tilemap_bonding_forge", "tilesetKey": "tiles_bonding_forge", "battleBackgroundKey": "bg_battle_bonding_forge",
    "wildEnemyIds": ["bond-mote", "ion-shard", "covalent-wisp", "slag-golem"],
    "encounterRatePerStep": 0.10,
    "miniBossId": "unstable-halide",
    "regionBossId": "the-sundered-lattice",
    "npcIds": ["smith-valentia", "lorekeeper-octet", "shrinekeeper-mortar"],
    "shrine": { "questionTopic": "bonding", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 400, "rewardItemIds": ["energy-cell", "buffer"] },
    "unlocksRegionId": null,
    "bossReward": { "xp": 500, "itemIds": ["reagent", "isotope-core"], "skillId": "lattice-collapse" }
  }
```

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` (139 pass — `loadGameContent().warnings` is still `[]`; `realContent.test.ts`'s "Region 1 exists" test still passes since it finds `index === 1`; the asset-key test now also checks `tiles_bonding_forge` + `bg_battle_bonding_forge`, which got entries in Task 1); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/regions.json
git commit -m "feat(content): add Region 2 (Bonding Forge); Region 1 unlocks it"
```

---

## Task 10: Tests — Region 2 coverage in `realContent.test.ts`

**Files:**
- Modify: `tests/content/realContent.test.ts`

Add: a Region 2 existence/shape test; a bonding-bank size/difficulty test; a `bonding-forge.json` parses+shape test; an NPC-dialogue-walkability test (covers R1 + R2).

- [ ] **Step 1: Add the import for the new tilemap** at the top of the file, after the existing imports:

```ts
import bondingForge from '../../src/content/data/tilemaps/bonding-forge.json';
import type { DialogueNode } from '../../src/content/types';
```

- [ ] **Step 2: Add the new test cases** inside the existing `describe('shipped content', () => { … })` block (before its closing `});`):

```ts
  it('Region 2 (bonding-forge) exists, index 2, topic "bonding", with a valid mini-boss and region boss; Region 1 unlocks it', () => {
    const { content } = loadGameContent();
    const r2 = content.regions.find(r => r.index === 2)!;
    expect(r2.id).toBe('bonding-forge');
    expect(r2.topic).toBe('bonding');
    expect(content.enemies[r2.miniBossId]?.role).toBe('miniBoss');
    expect(content.enemies[r2.regionBossId]?.role).toBe('regionBoss');
    const r1 = content.regions.find(r => r.index === 1)!;
    expect(r1.unlocksRegionId).toBe('bonding-forge');
  });
  it('bonding question bank has 40–60 questions spanning all three difficulties (with at least one balanceEquation)', () => {
    const { content } = loadGameContent();
    const qs = content.questions['bonding']!;
    expect(qs.length).toBeGreaterThanOrEqual(40);
    expect(qs.length).toBeLessThanOrEqual(60);
    for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(5);
    expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
  });
  it('the bonding-forge tilemap parses to a 24×18 grid with the expected interactive objects', () => {
    const tm = bondingForge as { width: number; height: number; ground: number[][]; objects: { type: string }[] };
    expect(tm.width).toBe(24);
    expect(tm.height).toBe(18);
    expect(tm.ground.length).toBe(18);
    expect(tm.ground.every(row => row.length === 24)).toBe(true);
    const types = tm.objects.map(o => o.type);
    for (const t of ['player_spawn', 'exit', 'shrine_entrance', 'minibossTrigger', 'bossGate']) expect(types).toContain(t);
    expect(types.filter(t => t === 'npc').length).toBe(3);
  });
  it('every NPC dialogue tree is walkable to a terminal node down every branch', () => {
    const { content } = loadGameContent();
    const walk = (tree: DialogueNode[], id: string, seen: Set<string>): void => {
      if (seen.has(id)) return; // guard against cycles
      seen.add(id);
      const node = tree.find(n => n.id === id);
      expect(node, `dangling node "${id}"`).toBeDefined();
      if (!node) return;
      const terminal = node.end === true || (!node.next && !(node.choices && node.choices.length));
      if (terminal) return;
      if (node.choices && node.choices.length) for (const c of node.choices) walk(tree, c.next, new Set(seen));
      else if (node.next) walk(tree, node.next, new Set(seen));
    };
    for (const npc of Object.values(content.npcs)) {
      expect(npc.dialogue.length, `${npc.id} has no dialogue`).toBeGreaterThan(0);
      walk(npc.dialogue, npc.dialogue[0]!.id, new Set());
    }
  });
```

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` — Expected: **143 pass** (139 + 4 new). `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add tests/content/realContent.test.ts
git commit -m "test(content): Region 2 + bonding bank + tilemap + NPC-walkability coverage"
```

---

## Task 11 (bonus bugfix): Region 1 mini-boss flag consistency

**Files:**
- Modify: `src/content/data/tilemaps/elemental-reaches.json`

`battleVictory.ts` sets `s.storyFlags['miniboss_' + region.id + '_done']` on a mini-boss win — for Region 1 that is `miniboss_elemental-reaches_done` (region id is hyphenated). But the R1 tilemap's `minibossTrigger.flag` and `bossGate.requiresFlag` say the *under-scored* `miniboss_elemental_reaches_done`, which is never set — so `canEnter` keeps the tile north of the chokepoint sealed and the boss gate never unlocks. Align the tilemap to the hyphenated form that `battleVictory.ts` actually writes (and that `OverworldScene.currentObjective()` already reads). Region 2 was authored with the hyphenated form from the start, so this is purely a Region-1 fix.

- [ ] **Step 1: Fix both flag strings** in `src/content/data/tilemaps/elemental-reaches.json` — change the last two objects to:

```json
    { "type": "minibossTrigger", "x": 18, "y": 6, "enemyId": "unstable-deuteride", "flag": "miniboss_elemental-reaches_done" },
    { "type": "bossGate", "x": 12, "y": 2, "enemyId": "the-unstable-isotope", "requiresFlag": "miniboss_elemental-reaches_done" }
```

- [ ] **Step 2: Verify it parses.** Run: `node -e "JSON.parse(require('fs').readFileSync('src/content/data/tilemaps/elemental-reaches.json','utf8')); console.log('ok')"` — Expected: `ok`.

- [ ] **Step 3: Gates.** `npx tsc --noEmit`; `npm test` (143 pass — no test references the old under-scored string); `npm run build`.

- [ ] **Step 4: Commit.**

```bash
git add src/content/data/tilemaps/elemental-reaches.json
git commit -m "fix(content): align Region 1 mini-boss flag with battleVictory's miniboss_<region.id>_done"
```

---

## Task 12: Finish the branch — merge, deploy, tag

- [ ] **Step 1: Final full gate run.** `npx tsc --noEmit` (clean); `npm test` (143 pass); `npm run build` (succeeds).

- [ ] **Step 2: Merge to `main` and push** (push to `main` auto-deploys `dist/` to GitHub Pages):

```bash
git checkout main
git merge --no-ff feat/region2-bonding-forge -m "feat: Region 2 — The Bonding Forge (Milestone 2)"
git push origin main
```

- [ ] **Step 3: Tag the release and push the tag:**

```bash
git tag -a v0.3.0-region2 -m "Region 2 — The Bonding Forge"
git push origin v0.3.0-region2
```

- [ ] **Step 4: Manual smoke (deploy).** Visit https://irvincisneros-png.github.io/equilibrium-lost/ after the Pages build finishes: from a save with Region 1 cleared, the World Map shows "The Bonding Forge" unlocked with "◀ START HERE"; entering it shows the forge biome (iron-grey/copper), the 3 mentors (★ on Valentia until you talk to her), the lesson dialogue, tall-grass wild battles with bonding questions, the Mortar Shrine, the mini-boss chokepoint (confirm-to-engage; the gate north of it stays sealed until it's down), the boss gate, and beating *The Sundered Lattice* shows the "Equilibrium restored to The Bonding Forge!" banner + ✓ on the World Map, with `lattice-collapse` learned and the reward items in the bag; loading mid-Region-2 resumes correctly.

---

## Self-review notes

- **Spec coverage:** every bullet in §"Scope of the content" + §"Code changes" + §"Tests" of the design spec maps to a task above (regions.json → T9; bonding.json → T5; tilemap → T2; npcs → T6; enemies → T4; skills+classes → T3; assetManifest → T1; WorldMapScene → T8; OverworldScene → T7; loadGameContent → T5; main.ts → no change, as the spec says; tests → T10; the spec's `node -e JSON.parse` parses-check → T2 step 2 + T10 step 2). The R1 flag bug surfaced during planning → T11.
- **No placeholders:** all JSON content and code diffs are given in full.
- **Type consistency:** `BiomePalette` / `ELEMENTAL_BIOME` / `BIOMES` (T7) referenced consistently; `NodeInfo` (T8) carries an optional `region?: RegionDef`; the `loadGameContent` `questions` map uses `'bonding'` matching `regions.json`'s `topic` and `skills.json`'s `topic` and the shrine's `questionTopic`; the mini-boss flag `miniboss_bonding-forge_done` matches `battleVictory.ts`'s `miniboss_${region.id}_done` with `region.id === 'bonding-forge'`; all new enemy `spriteKey`s and npc `spriteKey`s match the placeholder keys added in T1; `the-sundered-lattice.spriteKey === 'enemy_sundered_lattice'` (no `the_` prefix, mirroring R1's `the-unstable-isotope` → `enemy_unstable_isotope`).
