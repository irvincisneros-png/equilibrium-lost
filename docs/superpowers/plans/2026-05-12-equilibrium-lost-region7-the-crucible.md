# Region 7 — The Crucible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Mirrors the Region-6 plan; design in `docs/superpowers/specs/2026-05-12-equilibrium-lost-region7-the-crucible-design.md`. Gates `npx tsc --noEmit` && `npm test` && `npm run build` green at EVERY commit. This is the last region in the overnight loop — after it deploys, STOP the loop and leave the end-of-night summary.

**Goal:** add Region 7 — *The Crucible* (energy in reactions: exo/endothermic, bond energy, energy-profile diagrams, activation energy, everyday examples), wiring the World Map's unlock chain so clearing Region 6 opens Region 7. No new scenes/engine changes.

## Decisions

| # | Decision |
|---|----------|
| Region | `id:"the-crucible"`, `index:7`, name `"The Crucible"`, topic `"energy-changes"` |
| Asset keys | `tiles_the_crucible`, `bg_battle_the_crucible`, `tilemap_the_crucible` |
| Mini-boss flag | `miniboss_the-crucible_done` |
| Biome `tiles_the_crucible` | floor `0x3a322a` (dark forge), path `0xc25a18` (molten orange), tallGrass `0x8a4a14` (glowing slag), wallFace `0x2a2420` / wallTop `0x443a30` / wallBase `0x161210` / wallLine `0x0a0806`, waterFill `0x6e2c08` / waterLine `0x3a1404` |
| Region 6 change | `regions[index===6].unlocksRegionId`: `null` → `"the-crucible"` |
| Shrine | `{questionTopic:"energy-changes",questionCount:6,passRatio:0.8333,rewardXp:1300,rewardItemIds:["energy-cell","buffer"]}` |
| Boss reward | `{xp:1450,itemIds:["reagent","isotope-core"],skillId:"endothermic-drain"}` |
| Question bank | 45 Q, 16 d1 / 16 d2 / 13 d3; 3 `balanceEquation`: `CH4 + 2O2 → CO2 + 2H2O` d2 [1,2,1,2]; `2H2 + O2 → 2H2O` d2 [2,1,2]; `CaCO3 → CaO + CO2` d3 [1,1,1]. Rest MCQ on exo/endo classification, ΔH sign, bond breaking/making energy, energy-profile diagrams, activation energy, the catalyst-on-the-profile point, everyday examples, temperature-change experiments. Hint on every item; ASCII formula strings; VARY the MCQ answer position; all pass `validateQuestion`; Year-10 reading level. |

## Enemy stats (Task 4)

```json
"cinderling":       { "id": "cinderling", "name": "Cinderling", "affinity": "Exothermic", "baseStats": { "hp": 46, "atk": 14, "def": 8, "spd": 16 }, "level": 21, "attackPower": 30, "skillIds": ["exothermic-burst"], "xpYield": 162, "role": "wild", "spriteKey": "enemy_cinderling" },
"exotherm":         { "id": "exotherm", "name": "Exotherm", "affinity": "Exothermic", "baseStats": { "hp": 70, "atk": 20, "def": 13, "spd": 14 }, "level": 22, "attackPower": 34, "skillIds": ["thermal-vent", "exothermic-burst"], "xpYield": 180, "role": "wild", "spriteKey": "enemy_exotherm" },
"cracklith":        { "id": "cracklith", "name": "Cracklith", "affinity": "Decomposition", "baseStats": { "hp": 92, "atk": 18, "def": 16, "spd": 10 }, "level": 23, "attackPower": 36, "skillIds": ["decompose", "endothermic-drain"], "xpYield": 192, "role": "wild", "spriteKey": "enemy_cracklith", "splitIntoId": "cracklith-half" },
"cracklith-half":   { "id": "cracklith-half", "name": "Cracked Shard", "affinity": "Decomposition", "baseStats": { "hp": 30, "atk": 15, "def": 9, "spd": 12 }, "level": 23, "attackPower": 28, "skillIds": [], "xpYield": 28, "role": "wild", "spriteKey": "enemy_cracklith_half" },
"endotherm":        { "id": "endotherm", "name": "Endotherm", "affinity": "Endothermic", "baseStats": { "hp": 84, "atk": 23, "def": 17, "spd": 13 }, "level": 24, "attackPower": 38, "skillIds": ["ionize", "endothermic-drain"], "xpYield": 204, "role": "wild", "spriteKey": "enemy_endotherm", "teachesSkillId": "exothermic-burst" },
"the-flashpoint":   { "id": "the-flashpoint", "name": "The Flashpoint", "affinity": "Exothermic", "baseStats": { "hp": 215, "atk": 27, "def": 18, "spd": 15 }, "level": 25, "attackPower": 38, "skillIds": ["exothermic-burst", "thermal-vent"], "xpYield": 400, "role": "miniBoss", "spriteKey": "enemy_flashpoint", "bossSoftScale": false },
"the-heat-sink":    { "id": "the-heat-sink", "name": "The Heat Sink", "affinity": "Endothermic", "baseStats": { "hp": 360, "atk": 36, "def": 21, "spd": 15 }, "level": 27, "attackPower": 42, "skillIds": ["endothermic-drain", "ionize", "heat-flux"], "xpYield": 700, "role": "regionBoss", "spriteKey": "enemy_heat_sink", "bossSoftScale": true, "teachesSkillId": "endothermic-drain" }
```

## New skills (Task 3)

```json
"exothermic-burst":  { "id": "exothermic-burst", "name": "Exothermic Burst", "affinity": "Exothermic", "power": 42, "energyCost": 26, "topic": "energy-changes", "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "combusting", "chance": 35, "turns": 2, "magnitude": 5 } }, "description": "Releases all the reaction's stored energy at once. May set the target alight (Combusting)." },
"endothermic-drain": { "id": "endothermic-drain", "name": "Endothermic Drain", "affinity": "Endothermic", "power": 40, "energyCost": 26, "topic": "energy-changes", "questionDifficulty": 2, "accuracy": 95, "isSignature": false, "isCatalystBurst": false, "behavior": { "applyStatus": { "id": "endothermicChill", "chance": 40, "turns": 2, "magnitude": 0 } }, "description": "Pulls heat and energy out of the target. May reduce its ATK (Endothermic Chill)." },
"heat-flux":         { "id": "heat-flux", "name": "Heat Flux", "affinity": "Exothermic", "power": 38, "energyCost": 0, "topic": null, "questionDifficulty": 1, "accuracy": 100, "isSignature": false, "isCatalystBurst": false, "description": "The Heat Sink's attack — a backwash of vented thermal energy." }
```
Class `skillUnlocks` to append: pyron `{25,exothermic-burst},{27,endothermic-drain}`; aqualis `{25,exothermic-burst},{26,endothermic-drain}`; ionix `{26,exothermic-burst},{27,endothermic-drain}`.

## NPC dialogue (Task 6 — `node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`)

- **thermologist-calor** (`npc_thermologist_calor`; tile `{x:11,y:12}`, facing down): `v0` choice ("Show me the energy." → `v1` / "I know exo and endo — let me through." → `v_skip`); `v1` exo vs endo (gives out heat ⇒ exothermic, surroundings warm; takes in heat ⇒ endothermic, surroundings cool; combustion/neutralisation = exo, thermal decomposition/photosynthesis = endo); `v2` the ENERGY PROFILE (reactants → activation-energy hump → products; exothermic: products LOWER than reactants; endothermic: products HIGHER); `v3` ACTIVATION ENERGY (the minimum a collision needs — why even exo reactions often need a spark; a CATALYST lowers the hump but doesn't move the reactants/products, so ΔH is unchanged); `v4` "Forgemaster Pyra up ahead has the bonds side — why energy goes in and comes out. Off you go." (`setFlag:"lesson_energy-changes_seen"`, `end`); `v_skip` (`setFlag:"lesson_energy-changes_seen"`, `end`).
- **forgemaster-pyra** (`npc_forgemaster_pyra`; tile `{x:7,y:8}`, facing down): `o0` intro → `o1` BREAKING bonds ABSORBS energy (endothermic step); MAKING bonds RELEASES energy (exothermic step); every reaction does both → `o2` so the OVERALL change is the balance: making releases more than breaking absorbed ⇒ exothermic; the other way ⇒ endothermic; that's all ΔH is → `o3` everyday EXO (burning fuels, respiration, neutralisation, rusting/hand-warmers) vs everyday ENDO (heating a carbonate, photosynthesis, electrolysis, an instant cold pack) → `o4` "Exo gives out, endo takes in; breaking absorbs, making releases. The Heat Sink at the top drinks every joule it touches. Out-energy it. Go." (`end`).
- **shrinekeeper-ember** (`npc_shrinekeeper_ember`; tile `{x:4,y:12}`, facing right): `s0` choice ("Enter the Shrine." → `s_enter` / "Not yet." → `s_later`); `s_enter` "Six questions on energy in reactions. One miss forgiven; two and the furnace shuts on you." (`end`, `setFlag:"shrine_entered_the-crucible"`, `launch:"shrine"`); `s_later` (`end`).

## Tilemap `objects` (Task 2 — `ground` grid = `reaction-hollow.json` grid verbatim; `node -e` assert byte-identical)

```json
[
  { "type": "player_spawn", "x": 11, "y": 14 },
  { "type": "exit", "x": 11, "y": 17, "to": "world" },
  { "type": "npc", "id": "thermologist-calor", "x": 11, "y": 12 },
  { "type": "npc", "id": "forgemaster-pyra", "x": 7, "y": 8 },
  { "type": "npc", "id": "shrinekeeper-ember", "x": 4, "y": 12 },
  { "type": "shrine_entrance", "x": 3, "y": 12, "regionId": "the-crucible" },
  { "type": "minibossTrigger", "x": 11, "y": 4, "enemyId": "the-flashpoint", "flag": "miniboss_the-crucible_done" },
  { "type": "bossGate", "x": 11, "y": 2, "enemyId": "the-heat-sink", "requiresFlag": "miniboss_the-crucible_done" }
]
```

## assetManifest entries (Task 1)

`images`: `tiles_the_crucible`→`assets/images/tiles_the_crucible.png`, `bg_battle_the_crucible`→…, `enemy_cinderling`/`enemy_exotherm`/`enemy_cracklith`/`enemy_cracklith_half`/`enemy_endotherm`/`enemy_flashpoint`/`enemy_heat_sink`→…, `npc_thermologist_calor`/`npc_forgemaster_pyra`/`npc_shrinekeeper_ember`→…; `tilemaps.tilemap_the_crucible`→`src/content/data/tilemaps/the-crucible.json`. `placeholders` (w,h,color,label): `tiles_the_crucible`(64,64,`#3a322a`,""), `bg_battle_the_crucible`(1920,896,`#1e1812`,""), `enemy_cinderling`(96,96,`#e2864a`,"Cinderling"), `enemy_exotherm`(128,128,`#e2562a`,"Exotherm"), `enemy_cracklith`(160,160,`#7a6e5a`,"Cracklith"), `enemy_cracklith_half`(96,96,`#8e826a`,"Frag"), `enemy_endotherm`(128,128,`#5a7aaa`,"Endotherm"), `enemy_flashpoint`(192,192,`#e26a1a`,"Flashpoint"), `enemy_heat_sink`(256,256,`#3a6aaa`,"HEAT SINK"), `npc_thermologist_calor`(64,96,`#aa7a4a`,"Ca"), `npc_forgemaster_pyra`(64,96,`#c2562a`,"Py"), `npc_shrinekeeper_ember`(64,96,`#aa5a2a`,"Em").

## regions.json entry (Task 9)

```json
{
  "id": "the-crucible", "index": 7, "name": "The Crucible", "topic": "energy-changes",
  "tilemapKey": "tilemap_the_crucible", "tilesetKey": "tiles_the_crucible", "battleBackgroundKey": "bg_battle_the_crucible",
  "wildEnemyIds": ["cinderling", "exotherm", "cracklith", "endotherm"],
  "encounterRatePerStep": 0.10,
  "miniBossId": "the-flashpoint",
  "regionBossId": "the-heat-sink",
  "npcIds": ["thermologist-calor", "forgemaster-pyra", "shrinekeeper-ember"],
  "shrine": { "questionTopic": "energy-changes", "questionCount": 6, "passRatio": 0.8333, "rewardXp": 1300, "rewardItemIds": ["energy-cell", "buffer"] },
  "unlocksRegionId": null,
  "bossReward": { "xp": 1450, "itemIds": ["reagent", "isotope-core"], "skillId": "endothermic-drain" }
}
```
…and flip the existing `acid-wastes` entry's `"unlocksRegionId": null` → `"unlocksRegionId": "the-crucible"`.

## Tasks (commit per task; gates green every time)

- [ ] **T0** — `git checkout main && git pull && git checkout -b feat/region7-the-crucible`; confirm `tsc`/`test`(157)/`build` green.
- [ ] **T1** — `assetManifest.json`: add `images` + `tilemaps` + `placeholders` above. Commit `feat(content): asset manifest entries for Region 7 (The Crucible)`.
- [ ] **T2** — create `src/content/data/tilemaps/the-crucible.json`: copy `reaction-hollow.json` `ground` grid verbatim, swap in the `objects` above. `node -e` assert grid byte-identical + 24×18 + 8 objects. Commit `feat(content): Region 7 tilemap (the Crucible grid)`.
- [ ] **T3** — `skills.json`: append the 3 skills above. `classes.json`: append the `skillUnlocks`. Commit `feat(content): energy-changes skills + class unlocks (L25-27)`.
- [ ] **T4** — `enemies.json`: append the 7 entries above. Commit `feat(content): Region 7 enemies (4 wild + split-half + mini-boss + The Heat Sink)`.
- [ ] **T5** — create `src/content/data/questions/energy-changes.json` (45 Q per the decisions table). `loadGameContent.ts`: `import energyChanges from './data/questions/energy-changes.json'` + add `'energy-changes': energyChanges as unknown[]` to `questions`. Verify `node -e` → 45, {1:16,2:16,3:13}, ≥3 balanceEquation, all-hints, unique ids, all mcq 4-opt. Commit `feat(content): energy-changes question bank (45 Q) + load it`.
- [ ] **T6** — `npcs.json`: append the 3 mentors above (full dialogue, Year-10 reading level). Commit `feat(content): Region 7 mentors (Calor, Pyra, Ember)`.
- [ ] **T7** — `OverworldScene.ts`: import + `TILEMAPS` entry + `BIOMES` entry (`tiles_the_crucible` colours above). Commit `feat(scenes): OverworldScene — register the Crucible tilemap + biome palette`.
- [ ] **T8** — `WorldMapScene.ts`: remove `"The Crucible"` from `LOCKED_REGION_LABELS` (→ 1 left: `"Equilibrium's Heart"`). Commit `feat(scenes): WorldMapScene — The Crucible is a real node now`.
- [ ] **T9** — `regions.json`: flip `acid-wastes` `unlocksRegionId` → `"the-crucible"`; append the Region 7 entry above. Commit `feat(content): add Region 7 (The Crucible); Region 6 unlocks it`.
- [ ] **T10** — `realContent.test.ts`: add `import theCrucible from '../../src/content/data/tilemaps/the-crucible.json'`; add `'the-crucible': theCrucible as AuditTilemap` to the reachability test's `maps` record; add a "Region 7 exists, index 7, topic energy-changes, valid mini-boss + region boss, `regions[index===6].unlocksRegionId === 'the-crucible'`" test; an "energy-changes bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; a "the-crucible tilemap parses to 24×18 with the expected objects (5 fixed types + 3 npc)" test. Expect **160 passing**. Commit `test(content): Region 7 + energy-changes bank + tilemap coverage`.
- [ ] **T11** — `git checkout main` (verify `git branch --show-current` == `main`), `git merge --no-ff feat/region7-the-crucible -m "feat: Region 7 — The Crucible"`, `tsc`/`test`/`build` green, `git push origin main`, `git tag -a v0.8.0-region7 -m "Region 7 — The Crucible" && git push origin v0.8.0-region7`, `git branch -d feat/region7-the-crucible`, `gh run watch ...`. Update `equilibrium-lost-project.md` (Regions 1–7 done, tag `v0.8.0-region7`; only Region 8 the finale remains, left for the user; World Map now 7 real nodes + 1 locked). **STOP the loop** — no further ScheduleWakeup — and leave the user the end-of-night summary.

## Self-review
Spec coverage: every §"Scope"/§"Code changes"/§"Tests" item maps to a task; ordering keeps `loadGameContent().warnings === []` (manifest before enemies/NPCs/region; question import before the region entry; reachability test goes red between T9 and T10 — fixed in T10). Type consistency: `tiles_the_crucible` used identically as `tilesetKey`/manifest key/`BIOMES` key; `tilemap_the_crucible` as `tilemapKey`/`TILEMAPS`/manifest tilemaps key; flag `miniboss_the-crucible_done` = `battleVictory.ts`'s `miniboss_${region.id}_done`; `the-heat-sink.spriteKey === 'enemy_heat_sink'` (no `the_` prefix); `cracklith.splitIntoId === 'cracklith-half'` (defined enemy); `endotherm.teachesSkillId === 'exothermic-burst'` & `the-heat-sink.teachesSkillId === bossReward.skillId === 'endothermic-drain'` (both defined skills); affinities `Exothermic`/`Endothermic` chosen (existing type-chart entries: `Endothermic → Exothermic/Combustion = 2`).
