# Region 4 — The Balance Halls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fourth playable region — *The Balance Halls* (NSW Year 10 Chemistry: conservation of mass; writing & balancing chemical equations; state symbols; reading a balanced equation as a ratio) — fully playable end-to-end, wiring the World Map's unlock chain so clearing Region 3 opens Region 4.

**Architecture:** Content JSON + the same small code generalisations Regions 2–3 needed. Mirrors `docs/superpowers/plans/2026-05-12-equilibrium-lost-region3-reaction-hollow.md` exactly; design in `docs/superpowers/specs/2026-05-12-equilibrium-lost-region4-balance-halls-design.md`. No new scenes/engine changes.

**Tech Stack:** Phaser 3 · TypeScript (strict, `noUncheckedIndexedAccess`) · Vite · Vitest. Gates: `npx tsc --noEmit` && `npm test` && `npm run build` green at EVERY commit.

---

## Decisions locked for Region 4

| # | Decision |
|---|----------|
| Region | `id: "balance-halls"`, `index: 4`, name `"The Balance Halls"`, topic `"balancing-equations"` |
| Asset keys | tileset `tiles_balance_halls`, battle bg `bg_battle_balance_halls`, tilemap `tilemap_balance_halls` |
| Wild enemies | `equilet` (Atomic, Lv 13 — pushover), `coeffix` (Synthesis, Lv 14), `tilted-flask` (Decomposition, Lv 15 — `splitIntoId: "tilted-flask-half"`), `mass-thief` (Neutral, Lv 16 — `teachesSkillId: "mass-strike"`) |
| Split half | `tilted-flask-half` (Decomposition, Lv 15, low HP, `role: "wild"`, `xpYield 22`, no skills, no split) |
| Mini-boss | `the-unbalanced-flask` (Atomic, Lv 16, `role: "miniBoss"`, `bossSoftScale: false`) |
| Region boss | `the-lopsided-equation` (Atomic, Lv 18, `role: "regionBoss"`, `bossSoftScale: true`, `teachesSkillId: "equilibrate"`) |
| New skills | `equilibrate` (Neutral, topic `balancing-equations`, `behavior.stripBuffs`), `mass-strike` (Atomic, topic `balancing-equations`, `behavior.applyStatus` `oxidised`); enemy-only filler `lopsided-surge` (Atomic, topic `null`) |
| Class unlocks (added) | pyron L16 `synthesis-fuse` already there → add L17 `mass-strike`, L18 `equilibrate`; aqualis add L17 `equilibrate`, L18 `mass-strike`; ionix add L16 `mass-strike`, L17 `equilibrate` |
| Mentors | `archivist-pollux` (conservation of mass + word→symbol equations + state symbols + ratio reading — **quest NPC**, sets `lesson_balancing-equations_seen`), `weighmaster-libra` (the balancing technique), `shrinekeeper-scale` (shrine intro, `launch: "shrine"`) |
| Shrine | `{ questionTopic: "balancing-equations", questionCount: 6, passRatio: 0.8333, rewardXp: 850, rewardItemIds: ["energy-cell", "buffer"] }` |
| Boss reward | `{ xp: 1000, itemIds: ["reagent", "isotope-core"], skillId: "equilibrate" }` |
| Region 3 change | `regions[index===3].unlocksRegionId`: `null` → `"balance-halls"` |
| Mini-boss flag | `miniboss_balance-halls_done` (hyphenated, matches `battleVictory.ts`) |
| Tilemap | the proven R2/R3 24×18 grid verbatim; only the `objects` differ |
| Biome palette `tiles_balance_halls` | floor `0x6b6a5e` (pale marble), path `0x9a8a4a` (brass), tallGrass `0x4a5e4e` (verdigris), wallFace `0x3a3a34` / wallTop `0x55554c` / wallBase `0x1e1e1a` / wallLine `0x0e0e0c`, waterFill `0x2a3a44` / waterLine `0x141e24` |
| Question bank | 45 questions, 16 d1 / 16 d2 / 13 d3; **12 `balanceEquation` items** (it's the topic): 3 d1 (`H2+Cl2→HCl`, `Na+Cl2→NaCl`, `Mg+O2→MgO`), 4 d2 (`H2+O2→H2O`, Haber `N2+H2→NH3`, `Mg+HCl→MgCl2+H2`, `CaCO3→CaO+CO2` [already balanced]), 5 d3 (`Al+O2→Al2O3`, ethane `C2H6+O2→CO2+H2O`, `Fe2O3+CO→Fe+CO2`, neutralisation `NaOH+H2SO4→Na2SO4+H2O`, propane `C3H8+O2→CO2+H2O`); the rest MCQ on conservation of mass (incl. mass-conservation calculations), coefficients-vs-subscripts, state symbols, "is this balanced?", reading coefficients/ratios, atom-counting. Hint on each; all pass `validateQuestion`; Year-10 reading level. ASCII-clean formula strings (`Al2O3`, `H2SO4`, etc.). |

## Enemy stats (pin these in Task 4)

```json
"equilet":            { "id": "equilet", "name": "Equilet", "affinity": "Atomic", "baseStats": { "hp": 34, "atk": 10, "def": 6, "spd": 10 }, "level": 13, "attackPower": 24, "skillIds": ["mass-strike"], "xpYield": 110, "role": "wild", "spriteKey": "enemy_equilet" },
"coeffix":            { "id": "coeffix", "name": "Coeffix", "affinity": "Synthesis", "baseStats": { "hp": 54, "atk": 14, "def": 9, "spd": 13 }, "level": 14, "attackPower": 28, "skillIds": ["synthesis-fuse", "shell-shatter"], "xpYield": 125, "role": "wild", "spriteKey": "enemy_coeffix" },
"tilted-flask":       { "id": "tilted-flask", "name": "Tilted Flask", "affinity": "Decomposition", "baseStats": { "hp": 76, "atk": 13, "def": 12, "spd": 7 }, "level": 15, "attackPower": 30, "skillIds": ["decompose", "mass-strike"], "xpYield": 135, "role": "wild", "spriteKey": "enemy_tilted_flask", "splitIntoId": "tilted-flask-half" },
"tilted-flask-half":  { "id": "tilted-flask-half", "name": "Flask Shard", "affinity": "Decomposition", "baseStats": { "hp": 24, "atk": 11, "def": 6, "spd": 9 }, "level": 15, "attackPower": 22, "skillIds": [], "xpYield": 22, "role": "wild", "spriteKey": "enemy_tilted_flask_half" },
"mass-thief":         { "id": "mass-thief", "name": "Mass Thief", "affinity": "Neutral", "baseStats": { "hp": 62, "atk": 17, "def": 13, "spd": 11 }, "level": 16, "attackPower": 32, "skillIds": ["precipitate", "equilibrate"], "xpYield": 155, "role": "wild", "spriteKey": "enemy_mass_thief", "teachesSkillId": "mass-strike" },
"the-unbalanced-flask": { "id": "the-unbalanced-flask", "name": "The Unbalanced Flask", "affinity": "Atomic", "baseStats": { "hp": 185, "atk": 21, "def": 14, "spd": 10 }, "level": 16, "attackPower": 32, "skillIds": ["mass-strike", "synthesis-fuse"], "xpYield": 280, "role": "miniBoss", "spriteKey": "enemy_unbalanced_flask", "bossSoftScale": false },
"the-lopsided-equation": { "id": "the-lopsided-equation", "name": "The Lopsided Equation", "affinity": "Atomic", "baseStats": { "hp": 300, "atk": 30, "def": 18, "spd": 12 }, "level": 18, "attackPower": 36, "skillIds": ["equilibrate", "mass-strike", "lopsided-surge"], "xpYield": 560, "role": "regionBoss", "spriteKey": "enemy_lopsided_equation", "bossSoftScale": true, "teachesSkillId": "equilibrate" }
```

## New skills (pin these in Task 3)

```json
"equilibrate":     { "id": "equilibrate", "name": "Equilibrate", "affinity": "Neutral", "power": 38, "energyCost": 28, "topic": "balancing-equations", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "stripBuffs": true }, "description": "Re-balances the equation around the target — crashes its stat boosts back to baseline." },
"mass-strike":     { "id": "mass-strike", "name": "Mass Strike", "affinity": "Atomic", "power": 42, "energyCost": 26, "topic": "balancing-equations", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "oxidised", "chance": 35, "turns": 3, "magnitude": 0 } }, "description": "Drives conserved mass straight through the target's defences. May inflict Oxidised." },
"lopsided-surge":  { "id": "lopsided-surge", "name": "Lopsided Surge", "affinity": "Atomic", "power": 38, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Lopsided Equation's attack — an uneven cascade of atoms." }
```

## NPC dialogue (pin in Task 6 — `node[0]` entry; every `next`/`choices.next` resolves; terminals `end: true`)

- **archivist-pollux** (`npc_archivist_vera`→ NO, `npc_archivist_pollux`; tile `{x:11,y:12}`, facing down): `p0` choice ("Show me the rules." → `p1` / "I can balance equations — let me through." → `p_skip`); `p1` conservation of mass (atoms rearranged not created/destroyed; total mass before = after; a gas escaping only *looks* like mass loss); `p2` word→symbol equations (name→formula for each substance); `p3` state symbols `(s)(l)(g)(aq)`; `p4` reading a balanced equation as a ratio + "Weighmaster Libra up ahead drills the actual balancing — go" (`setFlag: "lesson_balancing-equations_seen"`, `end`); `p_skip` (`setFlag: "lesson_balancing-equations_seen"`, `end`).
- **weighmaster-libra** (`npc_weighmaster_libra`; tile `{x:7,y:8}`, facing down): `o0` intro → `o1` golden rule (balance with COEFFICIENTS, never change subscripts — that changes the substance) → `o2` the method (count each element both sides, add a coefficient, re-count, repeat; save the awkward one — often O or H — for last) → `o3` treat polyatomic ions (SO₄, NO₃, OH) as single units when they survive intact → `o4` worked example `4Fe + 3O₂ → 2Fe₂O₃` + "the Lopsided Equation at the top has never been balanced — fix it" (`end`).
- **shrinekeeper-scale** (`npc_shrinekeeper_scale`; tile `{x:4,y:12}`, facing right): `s0` choice ("Enter the Shrine." → `s_enter` / "Not yet." → `s_later`); `s_enter` "Six questions on conservation and balancing. One miss forgiven; two and the scales tip you out." (`end`, `setFlag: "shrine_entered_balance-halls"`, `launch: "shrine"`); `s_later` (`end`).

## Tilemap `objects` (pin in Task 2 — `ground` grid = the R3 `reaction-hollow.json` grid verbatim)

```json
[
  { "type": "player_spawn", "x": 11, "y": 14 },
  { "type": "exit", "x": 11, "y": 17, "to": "world" },
  { "type": "npc", "id": "archivist-pollux", "x": 11, "y": 12 },
  { "type": "npc", "id": "weighmaster-libra", "x": 7, "y": 8 },
  { "type": "npc", "id": "shrinekeeper-scale", "x": 4, "y": 12 },
  { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "balance-halls" },
  { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "the-unbalanced-flask", "flag": "miniboss_balance-halls_done" },
  { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-lopsided-equation", "requiresFlag": "miniboss_balance-halls_done" }
]
```

## assetManifest entries (pin in Task 1 — `images` + `placeholders` + `tilemaps`)

`images`: `tiles_balance_halls`→`assets/images/tiles_balance_halls.png`, `bg_battle_balance_halls`→…, `enemy_equilet`/`enemy_coeffix`/`enemy_tilted_flask`/`enemy_tilted_flask_half`/`enemy_mass_thief`/`enemy_unbalanced_flask`/`enemy_lopsided_equation`→…, `npc_archivist_pollux`/`npc_weighmaster_libra`/`npc_shrinekeeper_scale`→…; `tilemaps.tilemap_balance_halls`→`src/content/data/tilemaps/balance-halls.json`. `placeholders` (w,h,color,label): `tiles_balance_halls`(64,64,`#6b6a5e`,""), `bg_battle_balance_halls`(1920,896,`#2e2e28`,""), `enemy_equilet`(96,96,`#9a9a8a`,"Equilet"), `enemy_coeffix`(128,128,`#a4b07a`,"Coeffix"), `enemy_tilted_flask`(160,160,`#7a8a8e`,"Tilted Flask"), `enemy_tilted_flask_half`(96,96,`#8d9a9c`,"Frag"), `enemy_mass_thief`(128,128,`#8a7a9a`,"Mass Thief"), `enemy_unbalanced_flask`(192,192,`#b09a5a`,"Unbal. Flask"), `enemy_lopsided_equation`(256,256,`#c2a23a`,"LOPSIDED EQUATION"), `npc_archivist_pollux`(64,96,`#6a8a9a`,"Po"), `npc_weighmaster_libra`(64,96,`#b0903a`,"Li"), `npc_shrinekeeper_scale`(64,96,`#8a8a6a`,"Sc").

## regions.json entry (pin in Task 9)

```json
{
  "id": "balance-halls", "index": 4, "name": "The Balance Halls", "topic": "balancing-equations",
  "tilemapKey": "tilemap_balance_halls", "tilesetKey": "tiles_balance_halls", "battleBackgroundKey": "bg_battle_balance_halls",
  "wildEnemyIds": ["equilet", "coeffix", "tilted-flask", "mass-thief"],
  "encounterRatePerStep": 0.10,
  "miniBossId": "the-unbalanced-flask",
  "regionBossId": "the-lopsided-equation",
  "npcIds": ["archivist-pollux", "weighmaster-libra", "shrinekeeper-scale"],
  "shrine": { "questionTopic": "balancing-equations", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 850, "rewardItemIds": ["energy-cell", "buffer"] },
  "unlocksRegionId": null,
  "bossReward": { "xp": 1000, "itemIds": ["reagent", "isotope-core"], "skillId": "equilibrate" }
}
```
…and flip the existing `reaction-hollow` entry's `"unlocksRegionId": null` → `"unlocksRegionId": "balance-halls"`.

---

## Tasks (mirror the Region-3 plan's structure & gating; commit per task; gates green every time)

- [ ] **Task 0** — `git checkout main && git pull && git checkout -b feat/region4-balance-halls`; confirm `tsc`/`test`(148)/`build` green.
- [ ] **Task 1** — `assetManifest.json`: add the `images` + `tilemaps` + `placeholders` entries above. Commit `feat(content): asset manifest entries for Region 4 (Balance Halls)`.
- [ ] **Task 2** — create `src/content/data/tilemaps/balance-halls.json`: copy the `ground` grid from `reaction-hollow.json` verbatim, swap in the `objects` above. `node -e "JSON.parse(...)"` check. Commit `feat(content): Region 4 tilemap (the Balance Halls grid)`.
- [ ] **Task 3** — `skills.json`: append the 3 new skills above. `classes.json`: append the new `skillUnlocks` (pyron `{17,mass-strike},{18,equilibrate}`; aqualis `{17,equilibrate},{18,mass-strike}`; ionix `{16,mass-strike},{17,equilibrate}`). Commit `feat(content): balancing-equations skills + class unlocks (L16-18)`.
- [ ] **Task 4** — `enemies.json`: append the 7 new entries above. Commit `feat(content): Region 4 enemies (4 wild + split-half + mini-boss + The Lopsided Equation)`.
- [ ] **Task 5** — create `src/content/data/questions/balancing-equations.json` with the **45-question bank** (16 d1 / 16 d2 / 13 d3; 12 `balanceEquation` items as listed in the decisions table; every item a `hint`; all pass `validateQuestion`; ASCII formula strings). Then `loadGameContent.ts`: `import balancingEquations from './data/questions/balancing-equations.json'` + add `'balancing-equations': balancingEquations as unknown[]` to the `questions` map. Verify: `node -e "..."` → 45, {1:16,2:16,3:13}, 12 balanceEquation ids, all-hints true, unique ids true. Commit `feat(content): balancing-equations question bank (45 Q) + load it`.
- [ ] **Task 6** — `npcs.json`: append the 3 mentors above (full dialogue trees, Year-10 reading level). Commit `feat(content): Region 4 mentors (Pollux, Libra, Scale)`.
- [ ] **Task 7** — `OverworldScene.ts`: `import balanceHalls from '../content/data/tilemaps/balance-halls.json'`; add `tilemap_balance_halls: balanceHalls as unknown as TilemapData` to `TILEMAPS`; add the `tiles_balance_halls` entry to `BIOMES`. Commit `feat(scenes): OverworldScene — register the Balance Halls tilemap + biome palette`.
- [ ] **Task 8** — `WorldMapScene.ts`: remove `"The Balance Halls"` from `LOCKED_REGION_LABELS` (→ 4 left: *Catalyst Crags*, *The Acid Wastes*, *The Crucible*, *Equilibrium's Heart*). Commit `feat(scenes): WorldMapScene — The Balance Halls is a real node now`.
- [ ] **Task 9** — `regions.json`: flip `reaction-hollow`'s `unlocksRegionId` → `"balance-halls"`; append the Region 4 entry above. Commit `feat(content): add Region 4 (Balance Halls); Region 3 unlocks it`.
- [ ] **Task 10** — `realContent.test.ts`: add `import balanceHalls from '../../src/content/data/tilemaps/balance-halls.json'`; add `'balance-halls': balanceHalls as AuditTilemap` to the reachability test's `maps` record; add a "Region 4 exists, index 4, topic balancing-equations, valid mini-boss + region boss, regions[index===3].unlocksRegionId === 'balance-halls'" test; a "balancing-equations bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; a "balance-halls tilemap parses to 24×18 with the expected objects (5 fixed types + 3 npc)" test. Expect **151 passing**. Commit `test(content): Region 4 + balancing-equations bank + tilemap coverage`.
- [ ] **Task 11** — `git checkout main` (verify `git branch --show-current` says `main`), `git merge --no-ff feat/region4-balance-halls -m "feat: Region 4 — The Balance Halls"`, `tsc`/`test`/`build` green, `git push origin main`, `git tag -a v0.5.0-region4 -m "Region 4 — The Balance Halls" && git push origin v0.5.0-region4`, `git branch -d feat/region4-balance-halls`, `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`. Update `MEMORY.md` + `equilibrium-lost-project.md` to note Region 4 done (tag `v0.5.0-region4`, World Map now has 4 real nodes + 3 locked, next = Region 5 Catalyst Crags). Then continue the overnight loop with Region 5.

## Self-review

- Spec coverage: every §"Scope" / §"Code changes" / §"Tests" item maps to a task. The `balanceEquation`-heavy bank (12 items) is captured in Task 5 + the decisions table. Ordering keeps `loadGameContent().warnings === []` (manifest before enemies/NPCs/region; question import before the region entry). The reachability/first-lesson-flag/walkability/asset-key tests auto-cover Region 4.
- Type consistency: `tiles_balance_halls` used identically as `tilesetKey` / manifest key / `BIOMES` key; `tilemap_balance_halls` as `tilemapKey` / `TILEMAPS` key / manifest tilemaps key; mini-boss flag `miniboss_balance-halls_done` = `battleVictory.ts`'s `miniboss_${region.id}_done`; `the-lopsided-equation.spriteKey === 'enemy_lopsided_equation'` (no `the_` prefix); `tilted-flask.splitIntoId === 'tilted-flask-half'` (a defined enemy); `mass-thief.teachesSkillId === 'mass-strike'` and `the-lopsided-equation.teachesSkillId === bossReward.skillId === 'equilibrate'` (both defined skills); the `archivist-pollux` sprite key is `npc_archivist_pollux` (note: NOT `npc_archivist_vera`).
