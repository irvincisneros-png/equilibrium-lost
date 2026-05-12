# Design — Region 5: Catalyst Crags

**Status:** approved (autonomous overnight build — follows the established Region-2/3/4 pattern; the user pre-authorised building Regions 5–7 without further input).
**Goal:** add the fifth playable region — *Catalyst Crags* (NSW Year 10 Chemistry: rates of reaction — collision/particle theory; the effects of temperature, concentration, surface area and catalysts; measuring rate from graphs) — fully playable end-to-end, wiring the World Map's unlock chain so clearing Region 4 opens Region 5. Content JSON + the same small code generalisations Regions 2–4 needed; no new scenes/engine changes.

**Source of truth:** the design-spec roadmap (`docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md` §3): Region 5 = *Catalyst Crags*, topic *"Rates of reaction: temperature, concentration, surface area, catalysts"*, region boss *The Runaway Reaction*. Built from the proven Region-4 pattern (`docs/superpowers/specs/.../region4-balance-halls-design.md` + its plan) with the playtest-audit fixes already in place (first mentor reachable before the mini-boss; hyphenated chokepoint flag; per-region `lesson_<topic>_seen`; theme-fitting enemy movesets; levels tuned to what the player can plausibly reach given `xpToNextLevel = 100*level` — player enters R5 ≈ Lv 18–20).

## Scope of the content

**Chemistry topic (`reaction-rates`)** — NSW Year 10:
- collision (particle) theory of rate: reactions occur when particles collide with enough energy (≥ the activation energy) and a suitable orientation; anything that makes collisions more *frequent* or more *energetic* speeds the reaction up
- temperature ↑ → particles move faster → collide more often AND harder → rate ↑ a lot
- concentration ↑ (and pressure ↑ for gases) → particles more crowded → more collisions per second → rate ↑
- surface area ↑ (a solid broken up / powdered) → more exposed surface → more collisions → rate ↑
- catalysts: provide an alternative reaction pathway with a *lower activation energy*, so more collisions succeed; the catalyst is **not used up** (it can be recovered/reused); **enzymes** are biological catalysts; a catalyst changes the *rate*, not the *amount* of product
- measuring rate: gas volume vs time, mass loss vs time, "disappearing cross" (time to obscure a mark); a steeper graph = faster rate; the line flattens (rate → 0) when a reactant runs out

**`questions/reaction-rates.json`** — ~45 questions, ~16 d1 / ~16 d2 / ~13 d3 (≥5 each); 3 `balanceEquation` items tied to classic rate experiments (`2H2O2 → 2H2O + O2` — catalysed decomposition; `Mg + 2HCl → MgCl2 + H2`; `CaCO3 + 2HCl → CaCl2 + H2O + CO2` — marble chips & acid). MCQ on collision theory, each rate factor, "which speeds it up?", catalyst facts, reading a rate graph, particle theory, powder-vs-lump, activation energy. ASCII-clean formula strings; a `hint` on every item; all pass `validateQuestion`; Year-10 reading level.

**`tilemaps/catalyst-crags.json`** — the proven R2/R3/R4 24×18 `ground` grid verbatim; only the `objects` differ: `player_spawn (11,14)`, `exit (11,17, to:"world")`, `npc kineticist-vasco (11,12)`, `npc chemurge-sela (7,8)`, `npc shrinekeeper-tally (4,12)`, `shrine_entrance (3,12, regionId:"catalyst-crags")`, `minibossTrigger (11,4, enemyId:"the-rate-spike", flag:"miniboss_catalyst-crags_done")`, `bossGate (11,2, enemyId:"the-runaway-reaction", requiresFlag:"miniboss_catalyst-crags_done")`.

**`npcs.json`** — 3 new mentors (`node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`; `spriteKey`s new `npc_<id>`; `tile`s match the tilemap):
- `kineticist-vasco` — Kineticist Vasco (collision/particle theory + temperature + concentration; **quest NPC** = `npcIds[0]`; teach-path final node + skip node both set `setFlag:"lesson_reaction-rates_seen"`).
- `chemurge-sela` — Chemurge Sela (surface area + catalysts/enzymes + measuring rate from graphs).
- `shrinekeeper-tally` — Shrinekeeper Tally (shrine intro; a node with `launch:"shrine"`, `setFlag:"shrine_entered_catalyst-crags"`).

**`enemies.json`** — 7 new entries (≈ Lv 15–18 wild, Lv 19 mini-boss, Lv 21 region boss; one deliberate low-HP pushover; one with a `teachesSkillId`; the decomposition wild enemy has a `splitIntoId` half):
- `sparkrate` (Atomic, Lv 15 — pushover, fast, low HP), `collidon` (Atomic, Lv 16), `surfax` (Decomposition, Lv 17 — `splitIntoId:"surfax-half"`), `enzymoid` (Catalyst, Lv 18 — `teachesSkillId:"kinetic-strike"`); `surfax-half` (Decomposition, Lv 17, low HP, no skills, `role:"wild"`, `xpYield 24`); mini-boss `the-rate-spike` (Catalyst, Lv 19, `bossSoftScale:false`); region boss `the-runaway-reaction` (Combustion, Lv 21, `bossSoftScale:true`, `teachesSkillId:"activation-flare"`; `skillIds` incl. the no-quiz filler `rate-surge`).

**`skills.json` + `classes.json`** — 2 new quizzed skills (`topic:"reaction-rates"`) + 1 enemy-only filler (`topic:null`):
- `kinetic-strike` (`affinity:"Atomic"`, power ≈ 38, energy ≈ 26, `behavior.applyStatus` `endothermicChill` — fast collisions scatter the target's energy ⇒ ATK drop). (Not `Catalyst` affinity — the type chart makes `Catalyst` 0.5× vs everything; the catalyst *theme* is carried by the existing `catalyze` skill, the boss name, and the region name.)
- `activation-flare` (`affinity:"Combustion"`, power ≈ 42, energy ≈ 26, `behavior.applyStatus` `combusting` — forces the reaction past its activation energy). Boss reward / `teachesSkillId`. (Combustion → pyron's signature 1.25×.)
- `rate-surge` (`affinity:"Combustion"`, `topic:null`, power ≈ 38, energy 0) — *The Runaway Reaction*'s filler; enemy-only.
Added to the classes' `skillUnlocks` at levels ≈ 18–21 (all ≤ the boss level): e.g. pyron L19 `activation-flare` / L21 `kinetic-strike`; aqualis L19 `kinetic-strike` / L20 `activation-flare`; ionix L18 `kinetic-strike` / L20 `activation-flare`.

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` for `tiles_catalyst_crags`, `bg_battle_catalyst_crags`, the 7 new `enemy_*` (`enemy_sparkrate`, `enemy_collidon`, `enemy_surfax`, `enemy_surfax_half`, `enemy_enzymoid`, `enemy_rate_spike`, `enemy_runaway_reaction`), the 3 new `npc_*` (`npc_kineticist_vasco`, `npc_chemurge_sela`, `npc_shrinekeeper_tally`) — coloured-rect placeholders in a rocky-crags palette (slate grey, sulfur yellow, mineral ochre, dark rock); plus `tilemaps.tilemap_catalyst_crags`.
- `regions.json`: append the Region 5 entry — `id:"catalyst-crags"`, `index:5`, `name:"Catalyst Crags"`, `topic:"reaction-rates"`, `tilemapKey:"tilemap_catalyst_crags"`, `tilesetKey:"tiles_catalyst_crags"`, `battleBackgroundKey:"bg_battle_catalyst_crags"`, `wildEnemyIds:["sparkrate","collidon","surfax","enzymoid"]`, `encounterRatePerStep:0.10`, `miniBossId:"the-rate-spike"`, `regionBossId:"the-runaway-reaction"`, `npcIds:["kineticist-vasco","chemurge-sela","shrinekeeper-tally"]`, `shrine:{questionTopic:"reaction-rates",questionCount:6,passRatio:0.8333,rewardXp:1000,rewardItemIds:["energy-cell","buffer"]}`, `unlocksRegionId:null`, `bossReward:{xp:1150,itemIds:["reagent","isotope-core"],skillId:"activation-flare"}`. **Also change Region 4's (`balance-halls`) `unlocksRegionId` from `null` → `"catalyst-crags"`.**

## Code changes (small — same shape as Regions 2–4)
- `OverworldScene.ts` — `import catalystCrags from '../content/data/tilemaps/catalyst-crags.json'`; add `tilemap_catalyst_crags: catalystCrags as unknown as TilemapData` to `TILEMAPS`; add a `tiles_catalyst_crags` `BIOMES` entry (slate floor `0x4a4d52`, sulfur-yellow path `0xb0a838`, mineral-ochre tallGrass `0x6a5a2a`, dark-rock walls).
- `WorldMapScene.ts` — remove `"Catalyst Crags"` from `LOCKED_REGION_LABELS` (→ 3 left: *The Acid Wastes*, *The Crucible*, *Equilibrium's Heart*).
- `loadGameContent.ts` — `import reactionRates from './data/questions/reaction-rates.json'`; add `'reaction-rates': reactionRates` to the `questions` map.

## Tests
`realContent.test.ts` — add the `catalyst-crags.json` import; add `'catalyst-crags'` to the reachability test's `maps` record; a "Region 5 exists, index 5, topic reaction-rates, valid mini-boss + region boss, `regions[index===4].unlocksRegionId === 'catalyst-crags'`" test; a "reaction-rates bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; a `catalyst-crags.json` parses+shape test. The asset-key / NPC-walkability / first-NPC-reachability / first-lesson-flag tests auto-cover Region 5. `loadGameContent().warnings` stays `[]` (manifest before enemies/NPCs/region; question import before the region entry — note the reachability test goes red between adding the region and adding its `maps` entry; that's fixed in the same task as the region tests). `tsc` clean; `npm test` green (151 + 3 new = 154); `npm run build` succeeds.

## Balance
Player enters R5 ≈ Lv 18–20 (after clearing Region 4). Fixed rewards (shrine 1000, mini-boss `xpYield` 300, boss `xpYield` 600 + `bossReward.xp` 1150) + ~15 wild fights ≈ 130–172 + quiz bonuses bring a grinding player to ≈ Lv 21–23 by *The Runaway Reaction* (≈ Lv 21) — a fair fight; new-skill unlocks (Lv 18–21) reached. Mini-boss ≈ Lv 19; wild Lv 15–18 with `sparkrate` the deliberate Lv-15 pushover. `bossSoftScale:true` scales the boss up for an over-levelled player, leaves it at Lv 21 otherwise. Full balance tuning remains Milestone 4.

## Out of scope
Regions 6–8 (later loop iterations / the finale, left for the user); real art/audio (separate asset milestone; BootScene auto-picks up real PNGs at the manifest paths once they exist — the coloured-rect fallback covers the new keys); any new battle mechanic/scene/engine change; stage-2 class evolutions; the "Skill Progression" milestone.

## Verification
`npm run dev`: from a save with Region 4 cleared, the World Map shows "Catalyst Crags" unlocked with "◀ START HERE"; entering it shows the slate-and-sulfur crags biome, the 3 mentors (★ on Kineticist Vasco until you talk to them — reachable from spawn before the mini-boss), the reaction-rates lesson dialogue, encounter-tile wild battles with reaction-rates questions, the Tally Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The Runaway Reaction* shows the "Equilibrium restored to Catalyst Crags!" banner + ✓ on the World Map, learns `activation-flare`, lands the reward items; loading mid-Region-5 resumes correctly.
