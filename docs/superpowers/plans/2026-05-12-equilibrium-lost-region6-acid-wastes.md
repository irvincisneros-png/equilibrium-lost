# Region 6 — The Acid Wastes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Mirrors the Region-5 plan; design in `docs/superpowers/specs/2026-05-12-equilibrium-lost-region6-acid-wastes-design.md`. Gates `npx tsc --noEmit` && `npm test` && `npm run build` green at EVERY commit.

**Goal:** add Region 6 — *The Acid Wastes* (acids & bases, the pH scale, indicators, neutralisation, naming salts), wiring the World Map's unlock chain so clearing Region 5 opens Region 6. No new scenes/engine changes.

## Decisions

| # | Decision |
|---|----------|
| Region | `id:"acid-wastes"`, `index:6`, name `"The Acid Wastes"`, topic `"acids-bases"` |
| Asset keys | `tiles_acid_wastes`, `bg_battle_acid_wastes`, `tilemap_acid_wastes` |
| Mini-boss flag | `miniboss_acid-wastes_done` |
| Biome `tiles_acid_wastes` | floor `0x4a5238` (olive), path `0x9aaa3a` (acid yellow-green), tallGrass `0x5a6a28` (ochre), wallFace `0x33392a` / wallTop `0x4d5440` / wallBase `0x1c2016` / wallLine `0x0e110a`, waterFill `0x4a5a14` / waterLine `0x2a3408` |
| Region 5 change | `regions[index===5].unlocksRegionId`: `null` → `"acid-wastes"` |
| Shrine | `{questionTopic:"acids-bases",questionCount:6,passRatio:0.8333,rewardXp:1150,rewardItemIds:["energy-cell","buffer"]}` |
| Boss reward | `{xp:1300,itemIds:["reagent","isotope-core"],skillId:"corrosive-burn"}` |
| Question bank | 45 Q, 16 d1 / 16 d2 / 13 d3; 4 `balanceEquation`: `HCl + NaOH → NaCl + H2O` d1 [1,1,1,1]; `Mg + 2HCl → MgCl2 + H2` d2 [1,2,1,1]; `H2SO4 + 2NaOH → Na2SO4 + 2H2O` d3 [1,2,1,2]; `2HCl + CaCO3 → CaCl2 + H2O + CO2` d3 [2,1,1,1,1]. Rest MCQ on H⁺/OH⁻, the pH scale, indicators, neutralisation products, naming salts, strong-vs-weak-vs-dilute-vs-concentrated, everyday acids/bases. Hint on every item; ASCII formula strings; VARY the MCQ answer position; all pass `validateQuestion`; Year-10 reading level. |

## Enemy stats (Task 4)

```json
"litmuse":          { "id": "litmuse", "name": "Litmuse", "affinity": "Acid", "baseStats": { "hp": 42, "atk": 13, "def": 7, "spd": 15 }, "level": 18, "attackPower": 28, "skillIds": ["corrosive-burn"], "xpYield": 150, "role": "wild", "spriteKey": "enemy_litmuse" },
"protolyte":        { "id": "protolyte", "name": "Protolyte", "affinity": "Acid", "baseStats": { "hp": 64, "atk": 18, "def": 12, "spd": 13 }, "level": 19, "attackPower": 32, "skillIds": ["acid-splash", "corrosive-burn"], "xpYield": 168, "role": "wild", "spriteKey": "enemy_protolyte" },
"corrodent":        { "id": "corrodent", "name": "Corrodent", "affinity": "Decomposition", "baseStats": { "hp": 86, "atk": 17, "def": 15, "spd": 9 }, "level": 20, "attackPower": 34, "skillIds": ["decompose", "corrosive-burn"], "xpYield": 180, "role": "wild", "spriteKey": "enemy_corrodent", "splitIntoId": "corrodent-half" },
"corrodent-half":   { "id": "corrodent-half", "name": "Corrosion Shard", "affinity": "Decomposition", "baseStats": { "hp": 28, "atk": 14, "def": 8, "spd": 11 }, "level": 20, "attackPower": 26, "skillIds": [], "xpYield": 26, "role": "wild", "spriteKey": "enemy_corrodent_half" },
"alkalith":         { "id": "alkalith", "name": "Alkalith", "affinity": "Base", "baseStats": { "hp": 78, "atk": 21, "def": 16, "spd": 12 }, "level": 21, "attackPower": 36, "skillIds": ["neutralize", "alkali-wash"], "xpYield": 192, "role": "wild", "spriteKey": "enemy_alkalith", "teachesSkillId": "alkali-wash" },
"the-neutraliser":  { "id": "the-neutraliser", "name": "The Neutraliser", "affinity": "Base", "baseStats": { "hp": 205, "atk": 25, "def": 17, "spd": 14 }, "level": 22, "attackPower": 36, "skillIds": ["alkali-wash", "neutralize"], "xpYield": 350, "role": "miniBoss", "spriteKey": "enemy_neutraliser", "bossSoftScale": false },
"the-ph-tyrant":    { "id": "the-ph-tyrant", "name": "The pH Tyrant", "affinity": "Acid", "baseStats": { "hp": 340, "atk": 34, "def": 20, "spd": 14 }, "level": 24, "attackPower": 40, "skillIds": ["corrosive-burn", "acid-splash", "ph-surge"], "xpYield": 660, "role": "regionBoss", "spriteKey": "enemy_ph_tyrant", "bossSoftScale": true, "teachesSkillId": "corrosive-burn" }
```

## New skills (Task 3)

```json
"corrosive-burn":   { "id": "corrosive-burn", "name": "Corrosive Burn", "affinity": "Acid", "power": 42, "energyCost": 26, "topic": "acids-bases", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "dissolved", "chance": 35, "turns": 3, "magnitude": 5 } }, "description": "Eats into the target with concentrated acid. May leave it Dissolved (taking damage each turn)." },
"alkali-wash":      { "id": "alkali-wash", "name": "Alkali Wash", "affinity": "Base", "power": 40, "energyCost": 26, "topic": "acids-bases", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "oxidised", "chance": 35, "turns": 3, "magnitude": 0 } }, "description": "A caustic wash strips the target's surface bare. May inflict Oxidised (DEF drain)." },
"ph-surge":         { "id": "ph-surge", "name": "pH Surge", "affinity": "Acid", "power": 38, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The pH Tyrant's attack — a flood of free protons." }
```
Class `skillUnlocks` to append: pyron `{22,corrosive-burn},{24,alkali-wash}`; aqualis `{22,corrosive-burn},{23,alkali-wash}`; ionix `{23,corrosive-burn},{24,alkali-wash}`.

## NPC dialogue (Task 6 — `node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`)

- **apothecary-vitra** (`npc_apothecary_vitra`; tile `{x:11,y:12}`, facing down): `v0` choice ("Show me the chemistry." → `v1` / "I know acids and bases — let me through." → `v_skip`); `v1` what makes an acid/base (acids release H⁺ in water; bases release OH⁻; a base that dissolves is an alkali); `v2` the pH scale (0–14; below 7 acidic, 7 neutral, above 7 alkaline; lower = more acidic; each step ≈ ×10); `v3` indicators (litmus: red in acid, blue in alkali; universal indicator: red→green→purple across the range; pH paper/meter give a number); `v4` "Mind the wording — STRONG vs WEAK is about how fully it ionises; DILUTE vs CONCENTRATED is just about water. Salter Mordant up ahead has neutralisation and naming salts. Off you go." (`setFlag:"lesson_acids-bases_seen"`, `end`); `v_skip` (`setFlag:"lesson_acids-bases_seen"`, `end`).
- **salter-mordant** (`npc_salter_mordant`; tile `{x:7,y:8}`, facing down): `o0` intro → `o1` NEUTRALISATION (acid + base → salt + water; the H⁺ meets the OH⁻ and makes water, leaving the salt; add just enough base and pH hits 7) → `o2` other reactions (acid + reactive METAL → salt + HYDROGEN [the gas that pops]; acid + metal CARBONATE → salt + water + CARBON DIOXIDE [fizzes, turns limewater milky]; acid + metal OXIDE → salt + water) → `o3` NAMING the salt (metal from the base, the rest from the acid: hydrochloric → chlorides, sulfuric → sulfates, nitric → nitrates; so sodium hydroxide + hydrochloric acid → sodium chloride) → `o4` "Acids, bases, pH, indicators, neutralisation, salts — that's the lot. The pH Tyrant has cranked everything to pH 0. Neutralise it. Go." (`end`).
- **shrinekeeper-litmus** (`npc_shrinekeeper_litmus`; tile `{x:4,y:12}`, facing right): `s0` choice ("Enter the Shrine." → `s_enter` / "Not yet." → `s_later`); `s_enter` "Six questions on acids, bases and neutralisation. One miss forgiven; two and the indicator turns you out." (`end`, `setFlag:"shrine_entered_acid-wastes"`, `launch:"shrine"`); `s_later` (`end`).

## Tilemap `objects` (Task 2 — `ground` grid = `reaction-hollow.json` grid verbatim; `node -e` assert byte-identical)

```json
[
  { "type": "player_spawn", "x": 11, "y": 14 },
  { "type": "exit", "x": 11, "y": 17, "to": "world" },
  { "type": "npc", "id": "apothecary-vitra", "x": 11, "y": 12 },
  { "type": "npc", "id": "salter-mordant", "x": 7, "y": 8 },
  { "type": "npc", "id": "shrinekeeper-litmus", "x": 4, "y": 12 },
  { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "acid-wastes" },
  { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "the-neutraliser", "flag": "miniboss_acid-wastes_done" },
  { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-ph-tyrant", "requiresFlag": "miniboss_acid-wastes_done" }
]
```

## assetManifest entries (Task 1)

`images`: `tiles_acid_wastes`→`assets/images/tiles_acid_wastes.png`, `bg_battle_acid_wastes`→…, `enemy_litmuse`/`enemy_protolyte`/`enemy_corrodent`/`enemy_corrodent_half`/`enemy_alkalith`/`enemy_neutraliser`/`enemy_ph_tyrant`→…, `npc_apothecary_vitra`/`npc_salter_mordant`/`npc_shrinekeeper_litmus`→…; `tilemaps.tilemap_acid_wastes`→`src/content/data/tilemaps/acid-wastes.json`. `placeholders` (w,h,color,label): `tiles_acid_wastes`(64,64,`#4a5238`,""), `bg_battle_acid_wastes`(1920,896,`#24281c`,""), `enemy_litmuse`(96,96,`#aab86a`,"Litmuse"), `enemy_protolyte`(128,128,`#c2a05a`,"Protolyte"), `enemy_corrodent`(160,160,`#7a7e5a`,"Corrodent"), `enemy_corrodent_half`(96,96,`#8e926a`,"Frag"), `enemy_alkalith`(128,128,`#6a9aaa`,"Alkalith"), `enemy_neutraliser`(192,192,`#5aa0a0`,"Neutraliser"), `enemy_ph_tyrant`(256,256,`#c2c23a`,"pH TYRANT"), `npc_apothecary_vitra`(64,96,`#9aaa5a`,"Vi"), `npc_salter_mordant`(64,96,`#aa8a5a`,"Mo"), `npc_shrinekeeper_litmus`(64,96,`#7a8aaa`,"Li").

## regions.json entry (Task 9)

```json
{
  "id": "acid-wastes", "index": 6, "name": "The Acid Wastes", "topic": "acids-bases",
  "tilemapKey": "tilemap_acid_wastes", "tilesetKey": "tiles_acid_wastes", "battleBackgroundKey": "bg_battle_acid_wastes",
  "wildEnemyIds": ["litmuse", "protolyte", "corrodent", "alkalith"],
  "encounterRatePerStep": 0.10,
  "miniBossId": "the-neutraliser",
  "regionBossId": "the-ph-tyrant",
  "npcIds": ["apothecary-vitra", "salter-mordant", "shrinekeeper-litmus"],
  "shrine": { "questionTopic": "acids-bases", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 1150, "rewardItemIds": ["energy-cell", "buffer"] },
  "unlocksRegionId": null,
  "bossReward": { "xp": 1300, "itemIds": ["reagent", "isotope-core"], "skillId": "corrosive-burn" }
}
```
…and flip the existing `catalyst-crags` entry's `"unlocksRegionId": null` → `"unlocksRegionId": "acid-wastes"`.

## Tasks (commit per task; gates green every time)

- [ ] **T0** — `git checkout main && git pull && git checkout -b feat/region6-acid-wastes`; confirm `tsc`/`test`(154)/`build` green.
- [ ] **T1** — `assetManifest.json`: add `images` + `tilemaps` + `placeholders` above. Commit `feat(content): asset manifest entries for Region 6 (The Acid Wastes)`.
- [ ] **T2** — create `src/content/data/tilemaps/acid-wastes.json`: copy `reaction-hollow.json` `ground` grid verbatim, swap in the `objects` above. `node -e` assert grid byte-identical + 24×18 + 8 objects. Commit `feat(content): Region 6 tilemap (the Acid Wastes grid)`.
- [ ] **T3** — `skills.json`: append the 3 skills above. `classes.json`: append the `skillUnlocks`. Commit `feat(content): acids-bases skills + class unlocks (L22-24)`.
- [ ] **T4** — `enemies.json`: append the 7 entries above. Commit `feat(content): Region 6 enemies (4 wild + split-half + mini-boss + The pH Tyrant)`.
- [ ] **T5** — create `src/content/data/questions/acids-bases.json` (45 Q per the decisions table). `loadGameContent.ts`: `import acidsBases from './data/questions/acids-bases.json'` + add `'acids-bases': acidsBases as unknown[]` to `questions`. Verify `node -e` → 45, {1:16,2:16,3:13}, ≥4 balanceEquation, all-hints, unique ids, all mcq 4-opt. Commit `feat(content): acids-bases question bank (45 Q) + load it`.
- [ ] **T6** — `npcs.json`: append the 3 mentors above (full dialogue, Year-10 reading level). Commit `feat(content): Region 6 mentors (Vitra, Mordant, Litmus)`.
- [ ] **T7** — `OverworldScene.ts`: import + `TILEMAPS` entry + `BIOMES` entry (`tiles_acid_wastes` colours above). Commit `feat(scenes): OverworldScene — register the Acid Wastes tilemap + biome palette`.
- [ ] **T8** — `WorldMapScene.ts`: remove `"The Acid Wastes"` from `LOCKED_REGION_LABELS` (→ 2 left). Commit `feat(scenes): WorldMapScene — The Acid Wastes is a real node now`.
- [ ] **T9** — `regions.json`: flip `catalyst-crags` `unlocksRegionId` → `"acid-wastes"`; append the Region 6 entry above. Commit `feat(content): add Region 6 (The Acid Wastes); Region 5 unlocks it`.
- [ ] **T10** — `realContent.test.ts`: add `import acidWastes from '../../src/content/data/tilemaps/acid-wastes.json'`; add `'acid-wastes': acidWastes as AuditTilemap` to the reachability test's `maps` record; add a "Region 6 exists, index 6, topic acids-bases, valid mini-boss + region boss, `regions[index===5].unlocksRegionId === 'acid-wastes'`" test; an "acids-bases bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; an "acid-wastes tilemap parses to 24×18 with the expected objects (5 fixed types + 3 npc)" test. Expect **157 passing**. Commit `test(content): Region 6 + acids-bases bank + tilemap coverage`.
- [ ] **T11** — `git checkout main` (verify `git branch --show-current` == `main`), `git merge --no-ff feat/region6-acid-wastes -m "feat: Region 6 — The Acid Wastes"`, `tsc`/`test`/`build` green, `git push origin main`, `git tag -a v0.7.0-region6 -m "Region 6 — The Acid Wastes" && git push origin v0.7.0-region6`, `git branch -d feat/region6-acid-wastes`, `gh run watch ...`. Update `equilibrium-lost-project.md` (Region 6 done, tag `v0.7.0-region6`; World Map 6 real nodes + 1 locked; next = Region 7 The Crucible). Then continue the loop with Region 7.

## Self-review
Spec coverage: every §"Scope"/§"Code changes"/§"Tests" item maps to a task; ordering keeps `loadGameContent().warnings === []` (manifest before enemies/NPCs/region; question import before the region entry; reachability test goes red between T9 and T10 — fixed in T10). Type consistency: `tiles_acid_wastes` used identically as `tilesetKey`/manifest key/`BIOMES` key; `tilemap_acid_wastes` as `tilemapKey`/`TILEMAPS`/manifest tilemaps key; flag `miniboss_acid-wastes_done` = `battleVictory.ts`'s `miniboss_${region.id}_done`; `the-ph-tyrant.spriteKey === 'enemy_ph_tyrant'` (no `the_` prefix; the kebab id `the-ph-tyrant` slugifies fine); `corrodent.splitIntoId === 'corrodent-half'` (defined enemy); `alkalith.teachesSkillId === 'alkali-wash'` & `the-ph-tyrant.teachesSkillId === bossReward.skillId === 'corrosive-burn'` (both defined skills); affinities `Acid`/`Base` chosen (not `Catalyst`, which the type chart makes 0.5×).
