# Region 5 — Catalyst Crags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Mirrors the Region-4 plan exactly; design in `docs/superpowers/specs/2026-05-12-equilibrium-lost-region5-catalyst-crags-design.md`. Gates `npx tsc --noEmit` && `npm test` && `npm run build` green at EVERY commit.

**Goal:** add Region 5 — *Catalyst Crags* (rates of reaction: collision theory; temperature/concentration/surface area/catalysts; reading rate graphs), wiring the World Map's unlock chain so clearing Region 4 opens Region 5. No new scenes/engine changes.

## Decisions

| # | Decision |
|---|----------|
| Region | `id:"catalyst-crags"`, `index:5`, name `"Catalyst Crags"`, topic `"reaction-rates"` |
| Asset keys | `tiles_catalyst_crags`, `bg_battle_catalyst_crags`, `tilemap_catalyst_crags` |
| Mini-boss flag | `miniboss_catalyst-crags_done` |
| Biome `tiles_catalyst_crags` | floor `0x4a4d52` (slate), path `0xb0a838` (sulfur), tallGrass `0x6a5a2a` (ochre), wallFace `0x2e3035` / wallTop `0x46484e` / wallBase `0x18191c` / wallLine `0x0c0d0f`, waterFill `0x2a3a30` / waterLine `0x141e18` |
| Region 4 change | `regions[index===4].unlocksRegionId`: `null` → `"catalyst-crags"` |
| Shrine | `{questionTopic:"reaction-rates",questionCount:6,passRatio:0.8333,rewardXp:1000,rewardItemIds:["energy-cell","buffer"]}` |
| Boss reward | `{xp:1150,itemIds:["reagent","isotope-core"],skillId:"activation-flare"}` |
| Question bank | 45 Q, 16 d1 / 16 d2 / 13 d3; 3 `balanceEquation` (`2H2O2 → 2H2O + O2` d2 [2,2,1]; `Mg + 2HCl → MgCl2 + H2` d2 [1,2,1,1]; `CaCO3 + 2HCl → CaCl2 + H2O + CO2` d3 [1,2,1,1,1]); rest MCQ on collision theory / the rate factors / "which speeds it up?" / catalyst facts / reading rate graphs / particle theory / powder-vs-lump / activation energy. Hint on every item; ASCII formula strings; all pass `validateQuestion`; Year-10 reading level. |

## Enemy stats (Task 4)

```json
"sparkrate":            { "id": "sparkrate", "name": "Sparkrate", "affinity": "Atomic", "baseStats": { "hp": 38, "atk": 11, "def": 6, "spd": 14 }, "level": 15, "attackPower": 26, "skillIds": ["kinetic-strike"], "xpYield": 130, "role": "wild", "spriteKey": "enemy_sparkrate" },
"collidon":             { "id": "collidon", "name": "Collidon", "affinity": "Atomic", "baseStats": { "hp": 60, "atk": 16, "def": 11, "spd": 12 }, "level": 16, "attackPower": 30, "skillIds": ["shell-shatter", "kinetic-strike"], "xpYield": 145, "role": "wild", "spriteKey": "enemy_collidon" },
"surfax":               { "id": "surfax", "name": "Surfax", "affinity": "Decomposition", "baseStats": { "hp": 82, "atk": 15, "def": 14, "spd": 8 }, "level": 17, "attackPower": 32, "skillIds": ["decompose", "activation-flare"], "xpYield": 158, "role": "wild", "spriteKey": "enemy_surfax", "splitIntoId": "surfax-half" },
"surfax-half":          { "id": "surfax-half", "name": "Surface Shard", "affinity": "Decomposition", "baseStats": { "hp": 26, "atk": 13, "def": 7, "spd": 10 }, "level": 17, "attackPower": 24, "skillIds": [], "xpYield": 24, "role": "wild", "spriteKey": "enemy_surfax_half" },
"enzymoid":             { "id": "enzymoid", "name": "Enzymoid", "affinity": "Catalyst", "baseStats": { "hp": 70, "atk": 19, "def": 14, "spd": 13 }, "level": 18, "attackPower": 34, "skillIds": ["catalyze", "kinetic-strike"], "xpYield": 172, "role": "wild", "spriteKey": "enemy_enzymoid", "teachesSkillId": "kinetic-strike" },
"the-rate-spike":       { "id": "the-rate-spike", "name": "The Rate Spike", "affinity": "Catalyst", "baseStats": { "hp": 195, "atk": 23, "def": 15, "spd": 13 }, "level": 19, "attackPower": 34, "skillIds": ["kinetic-strike", "activation-flare"], "xpYield": 300, "role": "miniBoss", "spriteKey": "enemy_rate_spike", "bossSoftScale": false },
"the-runaway-reaction": { "id": "the-runaway-reaction", "name": "The Runaway Reaction", "affinity": "Combustion", "baseStats": { "hp": 320, "atk": 32, "def": 19, "spd": 13 }, "level": 21, "attackPower": 38, "skillIds": ["activation-flare", "spark-flare", "rate-surge"], "xpYield": 600, "role": "regionBoss", "spriteKey": "enemy_runaway_reaction", "bossSoftScale": true, "teachesSkillId": "activation-flare" }
```

## New skills (Task 3)

```json
"kinetic-strike":   { "id": "kinetic-strike", "name": "Kinetic Strike", "affinity": "Atomic", "power": 38, "energyCost": 26, "topic": "reaction-rates", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "endothermicChill", "chance": 30, "turns": 2, "magnitude": 0 } }, "description": "A flurry of fast collisions batters the target and scatters its energy. May reduce ATK." },
"activation-flare": { "id": "activation-flare", "name": "Activation Flare", "affinity": "Combustion", "power": 42, "energyCost": 26, "topic": "reaction-rates", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "combusting", "chance": 35, "turns": 2, "magnitude": 5 } }, "description": "Forces the reaction past its activation energy in one violent flare. May set the target alight." },
"rate-surge":       { "id": "rate-surge", "name": "Rate Surge", "affinity": "Combustion", "power": 38, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Runaway Reaction's attack — a self-accelerating cascade of fire." }
```
Class `skillUnlocks` to append: pyron `{19,activation-flare},{21,kinetic-strike}`; aqualis `{19,kinetic-strike},{20,activation-flare}`; ionix `{18,kinetic-strike},{20,activation-flare}`.

## NPC dialogue (Task 6 — `node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`)

- **kineticist-vasco** (`npc_kineticist_vasco`; tile `{x:11,y:12}`, facing down): `v0` choice ("Show me the levers." → `v1` / "I know reaction rates — let me through." → `v_skip`); `v1` collision/particle theory (reactions need particles to COLLIDE with enough energy and the right way; more frequent/energetic collisions ⇒ faster); `v2` TEMPERATURE (heat ⇒ particles faster ⇒ collide more often AND harder ⇒ rate ↑ a lot); `v3` CONCENTRATION/pressure (more crowded particles ⇒ more collisions/second ⇒ rate ↑); `v4` "Chemurge Sela up ahead has SURFACE AREA and CATALYSTS — get all four and the Runaway Reaction can't outpace you. Off you go." (`setFlag:"lesson_reaction-rates_seen"`, `end`); `v_skip` (`setFlag:"lesson_reaction-rates_seen"`, `end`).
- **chemurge-sela** (`npc_chemurge_sela`; tile `{x:7,y:8}`, facing down): `o0` intro → `o1` SURFACE AREA (break/powder a solid ⇒ more exposed surface ⇒ more collisions ⇒ faster; a marble chip is slow, marble powder fizzes) → `o2` CATALYSTS (offer a lower-activation-energy pathway; NOT used up — reusable; ENZYMES = biological catalysts; a catalyst changes the rate, not the amount of product) → `o3` MEASURING RATE (gas volume vs time, mass loss vs time, "disappearing cross"; steeper graph = faster; the line flattens when a reactant runs out) → `o4` "Five levers on speed: collisions, temperature, concentration, surface area, catalysts. The Runaway Reaction pulled every one. Slow it down. Go." (`end`).
- **shrinekeeper-tally** (`npc_shrinekeeper_tally`; tile `{x:4,y:12}`, facing right): `s0` choice ("Enter the Shrine." → `s_enter` / "Not yet." → `s_later`); `s_enter` "Six questions on what makes reactions fast or slow. One miss forgiven; two and the clock stops you." (`end`, `setFlag:"shrine_entered_catalyst-crags"`, `launch:"shrine"`); `s_later` (`end`).

## Tilemap `objects` (Task 2 — `ground` grid = `reaction-hollow.json` grid verbatim; `node -e` assert byte-identical)

```json
[
  { "type": "player_spawn", "x": 11, "y": 14 },
  { "type": "exit", "x": 11, "y": 17, "to": "world" },
  { "type": "npc", "id": "kineticist-vasco", "x": 11, "y": 12 },
  { "type": "npc", "id": "chemurge-sela", "x": 7, "y": 8 },
  { "type": "npc", "id": "shrinekeeper-tally", "x": 4, "y": 12 },
  { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "catalyst-crags" },
  { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "the-rate-spike", "flag": "miniboss_catalyst-crags_done" },
  { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-runaway-reaction", "requiresFlag": "miniboss_catalyst-crags_done" }
]
```

## assetManifest entries (Task 1)

`images`: `tiles_catalyst_crags`→`assets/images/tiles_catalyst_crags.png`, `bg_battle_catalyst_crags`→…, `enemy_sparkrate`/`enemy_collidon`/`enemy_surfax`/`enemy_surfax_half`/`enemy_enzymoid`/`enemy_rate_spike`/`enemy_runaway_reaction`→…, `npc_kineticist_vasco`/`npc_chemurge_sela`/`npc_shrinekeeper_tally`→…; `tilemaps.tilemap_catalyst_crags`→`src/content/data/tilemaps/catalyst-crags.json`. `placeholders` (w,h,color,label): `tiles_catalyst_crags`(64,64,`#4a4d52`,""), `bg_battle_catalyst_crags`(1920,896,`#262830`,""), `enemy_sparkrate`(96,96,`#c2b85a`,"Sparkrate"), `enemy_collidon`(128,128,`#8a9aa6`,"Collidon"), `enemy_surfax`(160,160,`#7a7e6a`,"Surfax"), `enemy_surfax_half`(96,96,`#8e9282`,"Frag"), `enemy_enzymoid`(128,128,`#9aa05a`,"Enzymoid"), `enemy_rate_spike`(192,192,`#c2a83a`,"Rate Spike"), `enemy_runaway_reaction`(256,256,`#e2562a`,"RUNAWAY REACTION"), `npc_kineticist_vasco`(64,96,`#7a8a9a`,"Va"), `npc_chemurge_sela`(64,96,`#8aaa5a`,"Se"), `npc_shrinekeeper_tally`(64,96,`#b0a83a`,"Ta").

## regions.json entry (Task 9)

```json
{
  "id": "catalyst-crags", "index": 5, "name": "Catalyst Crags", "topic": "reaction-rates",
  "tilemapKey": "tilemap_catalyst_crags", "tilesetKey": "tiles_catalyst_crags", "battleBackgroundKey": "bg_battle_catalyst_crags",
  "wildEnemyIds": ["sparkrate", "collidon", "surfax", "enzymoid"],
  "encounterRatePerStep": 0.10,
  "miniBossId": "the-rate-spike",
  "regionBossId": "the-runaway-reaction",
  "npcIds": ["kineticist-vasco", "chemurge-sela", "shrinekeeper-tally"],
  "shrine": { "questionTopic": "reaction-rates", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 1000, "rewardItemIds": ["energy-cell", "buffer"] },
  "unlocksRegionId": null,
  "bossReward": { "xp": 1150, "itemIds": ["reagent", "isotope-core"], "skillId": "activation-flare" }
}
```
…and flip the existing `balance-halls` entry's `"unlocksRegionId": null` → `"unlocksRegionId": "catalyst-crags"`.

## Tasks (commit per task; gates green every time)

- [ ] **T0** — `git checkout main && git pull && git checkout -b feat/region5-catalyst-crags`; confirm `tsc`/`test`(151)/`build` green.
- [ ] **T1** — `assetManifest.json`: add the `images` + `tilemaps` + `placeholders` entries above. Commit `feat(content): asset manifest entries for Region 5 (Catalyst Crags)`.
- [ ] **T2** — create `src/content/data/tilemaps/catalyst-crags.json`: copy the `ground` grid from `reaction-hollow.json` verbatim, swap in the `objects` above. `node -e` assert grid byte-identical + 24×18 + 8 objects. Commit `feat(content): Region 5 tilemap (the Catalyst Crags grid)`.
- [ ] **T3** — `skills.json`: append the 3 skills above. `classes.json`: append the `skillUnlocks`. Commit `feat(content): reaction-rates skills + class unlocks (L18-21)`.
- [ ] **T4** — `enemies.json`: append the 7 entries above. Commit `feat(content): Region 5 enemies (4 wild + split-half + mini-boss + The Runaway Reaction)`.
- [ ] **T5** — create `src/content/data/questions/reaction-rates.json` (45 Q per the decisions table). `loadGameContent.ts`: `import reactionRates from './data/questions/reaction-rates.json'` + add `'reaction-rates': reactionRates as unknown[]` to `questions`. Verify `node -e` → 45, {1:16,2:16,3:13}, ≥3 balanceEquation, all-hints, unique ids, all mcq 4-opt. Commit `feat(content): reaction-rates question bank (45 Q) + load it`.
- [ ] **T6** — `npcs.json`: append the 3 mentors above (full dialogue, Year-10 reading level). Commit `feat(content): Region 5 mentors (Vasco, Sela, Tally)`.
- [ ] **T7** — `OverworldScene.ts`: import + `TILEMAPS` entry + `BIOMES` entry (`tiles_catalyst_crags` colours above). Commit `feat(scenes): OverworldScene — register the Catalyst Crags tilemap + biome palette`.
- [ ] **T8** — `WorldMapScene.ts`: remove `"Catalyst Crags"` from `LOCKED_REGION_LABELS` (→ 3 left). Commit `feat(scenes): WorldMapScene — Catalyst Crags is a real node now`.
- [ ] **T9** — `regions.json`: flip `balance-halls` `unlocksRegionId` → `"catalyst-crags"`; append the Region 5 entry above. Commit `feat(content): add Region 5 (Catalyst Crags); Region 4 unlocks it`.
- [ ] **T10** — `realContent.test.ts`: add `import catalystCrags from '../../src/content/data/tilemaps/catalyst-crags.json'`; add `'catalyst-crags': catalystCrags as AuditTilemap` to the reachability test's `maps` record; add a "Region 5 exists, index 5, topic reaction-rates, valid mini-boss + region boss, `regions[index===4].unlocksRegionId === 'catalyst-crags'`" test; a "reaction-rates bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; a "catalyst-crags tilemap parses to 24×18 with the expected objects (5 fixed types + 3 npc)" test. Expect **154 passing**. Commit `test(content): Region 5 + reaction-rates bank + tilemap coverage`.
- [ ] **T11** — `git checkout main` (verify `git branch --show-current` == `main`), `git merge --no-ff feat/region5-catalyst-crags -m "feat: Region 5 — Catalyst Crags"`, `tsc`/`test`/`build` green, `git push origin main`, `git tag -a v0.6.0-region5 -m "Region 5 — Catalyst Crags" && git push origin v0.6.0-region5`, `git branch -d feat/region5-catalyst-crags`, `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`. Update `equilibrium-lost-project.md` to note Region 5 done (tag `v0.6.0-region5`; World Map now 5 real nodes + 2 locked; next = Region 6 The Acid Wastes). Then continue the loop with Region 6.

## Self-review
Spec coverage: every §"Scope" / §"Code changes" / §"Tests" item maps to a task; ordering keeps `loadGameContent().warnings === []` (manifest before enemies/NPCs/region; question import before the region entry; the reachability test goes red between T9 and T10 — fixed in T10). Type consistency: `tiles_catalyst_crags` used identically as `tilesetKey`/manifest key/`BIOMES` key; `tilemap_catalyst_crags` as `tilemapKey`/`TILEMAPS`/manifest tilemaps key; flag `miniboss_catalyst-crags_done` = `battleVictory.ts`'s `miniboss_${region.id}_done`; `the-runaway-reaction.spriteKey === 'enemy_runaway_reaction'` (no `the_` prefix); `surfax.splitIntoId === 'surfax-half'` (defined enemy); `enzymoid.teachesSkillId === 'kinetic-strike'` & `the-runaway-reaction.teachesSkillId === bossReward.skillId === 'activation-flare'` (both defined skills); `kinetic-strike` is `Atomic` affinity, not `Catalyst` (which the type chart makes 0.5×).
