# Design — Region 6: The Acid Wastes

**Status:** approved (autonomous overnight build — follows the established Region-2/3/4/5 pattern; the user pre-authorised building Regions 5–7 without further input).
**Goal:** add the sixth playable region — *The Acid Wastes* (NSW Year 10 Chemistry: acids & bases; the pH scale; indicators; the H⁺/OH⁻ ion difference; neutralisation — acid + base / acid + metal / acid + metal carbonate; strong vs weak vs dilute vs concentrated; naming salts) — fully playable end-to-end, wiring the World Map's unlock chain so clearing Region 5 opens Region 6. Content JSON + the same small code generalisations Regions 2–5 needed; no new scenes/engine changes.

**Source of truth:** the design-spec roadmap (`docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md` §3): Region 6 = *The Acid Wastes*, topic *"Acids & bases; the pH scale; indicators; neutralisation reactions"*, region boss *The pH Tyrant*. Built from the proven Region-5 pattern (`docs/superpowers/specs/.../region5-catalyst-crags-design.md` + its plan) with the playtest-audit fixes already in place. Player enters R6 ≈ Lv 21–22.

## Scope of the content

**Chemistry topic (`acids-bases`)** — NSW Year 10:
- acids release H⁺ (hydrogen ions) in solution; bases release OH⁻ (hydroxide ions); an *alkali* is a soluble base
- the pH scale 0–14: <7 acidic, 7 neutral, >7 alkaline; lower pH = more acidic; each pH unit ≈ a tenfold change in acidity
- indicators: litmus (red in acid / blue in alkali), universal indicator (a colour spectrum across the pH range), pH paper / pH meter (a number)
- neutralisation: **acid + base/alkali → salt + water** (e.g. HCl + NaOH → NaCl + H₂O); **acid + reactive metal → salt + hydrogen** (e.g. Mg + 2HCl → MgCl₂ + H₂); **acid + metal carbonate → salt + water + carbon dioxide** (e.g. 2HCl + CaCO₃ → CaCl₂ + H₂O + CO₂); acid + metal oxide → salt + water
- "strong vs weak" (degree of ionisation) is different from "dilute vs concentrated" (amount of water)
- everyday acids (citric/citrus, acetic/vinegar, sulfuric/car batteries, hydrochloric/stomach acid, carbonic/fizzy drinks) and bases (sodium hydroxide/drain cleaner, ammonia/cleaners, sodium bicarbonate/antacid, calcium hydroxide/lime, soaps)
- naming salts: the metal part comes from the base; the rest from the acid — hydrochloric→chlorides, sulfuric→sulfates, nitric→nitrates

**`questions/acids-bases.json`** — ~45 questions, 16 d1 / 16 d2 / 13 d3 (≥5 each); **4 `balanceEquation` items** (neutralisations: `HCl + NaOH → NaCl + H2O` d1 [1,1,1,1]; `Mg + 2HCl → MgCl2 + H2` d2 [1,2,1,1]; `H2SO4 + 2NaOH → Na2SO4 + 2H2O` d3 [1,2,1,2]; `2HCl + CaCO3 → CaCl2 + H2O + CO2` d3 [2,1,1,1,1]). MCQ on the H⁺/OH⁻ difference, the pH scale, indicator colours, neutralisation products, naming salts, strong-vs-weak-vs-dilute-vs-concentrated, everyday acids/bases. ASCII formula strings; a `hint` on every item; **vary the MCQ answer position**; all pass `validateQuestion`; Year-10 reading level.

**`tilemaps/acid-wastes.json`** — the proven R2–R5 24×18 `ground` grid verbatim; only the `objects` differ: `player_spawn (11,14)`, `exit (11,17, to:"world")`, `npc apothecary-vitra (11,12)`, `npc salter-mordant (7,8)`, `npc shrinekeeper-litmus (4,12)`, `shrine_entrance (3,12, regionId:"acid-wastes")`, `minibossTrigger (11,4, enemyId:"the-neutraliser", flag:"miniboss_acid-wastes_done")`, `bossGate (11,2, enemyId:"the-ph-tyrant", requiresFlag:"miniboss_acid-wastes_done")`.

**`npcs.json`** — 3 new mentors (`node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`; new `npc_<id>` sprite keys; tiles match the tilemap):
- `apothecary-vitra` — Apothecary Vitra (acids/bases/the pH scale/indicators/strong-weak-dilute-concentrated; **quest NPC** = `npcIds[0]`; teach-path final node + skip node both set `setFlag:"lesson_acids-bases_seen"`).
- `salter-mordant` — Salter Mordant (neutralisation reactions + naming salts).
- `shrinekeeper-litmus` — Shrinekeeper Litmus (shrine intro; a node with `launch:"shrine"`, `setFlag:"shrine_entered_acid-wastes"`).

**`enemies.json`** — 7 new entries (≈ Lv 18–21 wild, Lv 22 mini-boss, Lv 24 region boss; one deliberate low-HP pushover; one with a `teachesSkillId`; the decomposition wild enemy has a `splitIntoId` half):
- `litmuse` (Acid, Lv 18 — pushover, fast, low HP), `protolyte` (Acid, Lv 19), `corrodent` (Decomposition, Lv 20 — `splitIntoId:"corrodent-half"`), `alkalith` (Base, Lv 21 — `teachesSkillId:"alkali-wash"`); `corrodent-half` (Decomposition, Lv 20, low HP, no skills, `role:"wild"`, `xpYield 26`); mini-boss `the-neutraliser` (Base, Lv 22, `bossSoftScale:false`); region boss `the-ph-tyrant` (Acid, Lv 24, `bossSoftScale:true`, `teachesSkillId:"corrosive-burn"`; `skillIds` incl. the no-quiz filler `ph-surge`).

**`skills.json` + `classes.json`** — 2 new quizzed skills (`topic:"acids-bases"`) + 1 enemy-only filler (`topic:null`):
- `corrosive-burn` (`affinity:"Acid"`, power ≈ 42, energy ≈ 26, `behavior.applyStatus` `dissolved` — eats into the target over time). Boss reward / `teachesSkillId`. (Acid → aqualis's signature 1.25×; also `Acid → Metal/Ionic = 2×` from the type chart.)
- `alkali-wash` (`affinity:"Base"`, power ≈ 40, energy ≈ 26, `behavior.applyStatus` `oxidised` — a caustic wash strips DEF). (`Base → Acid = 2×`, so it's strong against the region's Acid enemies and the boss.)
- `ph-surge` (`affinity:"Acid"`, `topic:null`, power ≈ 38, energy 0) — *The pH Tyrant*'s filler; enemy-only.
Added to the classes' `skillUnlocks` at levels ≈ 22–24 (all ≤ the boss level): pyron L22 `corrosive-burn` / L24 `alkali-wash`; aqualis L22 `corrosive-burn` / L23 `alkali-wash`; ionix L23 `corrosive-burn` / L24 `alkali-wash`.

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` for `tiles_acid_wastes`, `bg_battle_acid_wastes`, the 7 new `enemy_*` (`enemy_litmuse`, `enemy_protolyte`, `enemy_corrodent`, `enemy_corrodent_half`, `enemy_alkalith`, `enemy_neutraliser`, `enemy_ph_tyrant`), the 3 new `npc_*` (`npc_apothecary_vitra`, `npc_salter_mordant`, `npc_shrinekeeper_litmus`) — coloured-rect placeholders in a corroded-wasteland palette (sickly olive, acid yellow-green, toxic ochre, dark corroded metal); plus `tilemaps.tilemap_acid_wastes`.
- `regions.json`: append the Region 6 entry — `id:"acid-wastes"`, `index:6`, `name:"The Acid Wastes"`, `topic:"acids-bases"`, `tilemapKey:"tilemap_acid_wastes"`, `tilesetKey:"tiles_acid_wastes"`, `battleBackgroundKey:"bg_battle_acid_wastes"`, `wildEnemyIds:["litmuse","protolyte","corrodent","alkalith"]`, `encounterRatePerStep:0.10`, `miniBossId:"the-neutraliser"`, `regionBossId:"the-ph-tyrant"`, `npcIds:["apothecary-vitra","salter-mordant","shrinekeeper-litmus"]`, `shrine:{questionTopic:"acids-bases",questionCount:6,passRatio:0.8333,rewardXp:1150,rewardItemIds:["energy-cell","buffer"]}`, `unlocksRegionId:null`, `bossReward:{xp:1300,itemIds:["reagent","isotope-core"],skillId:"corrosive-burn"}`. **Also change Region 5's (`catalyst-crags`) `unlocksRegionId` from `null` → `"acid-wastes"`.**

## Code changes (small — same shape as Regions 2–5)
- `OverworldScene.ts` — `import acidWastes from '../content/data/tilemaps/acid-wastes.json'`; add `tilemap_acid_wastes: acidWastes as unknown as TilemapData` to `TILEMAPS`; add a `tiles_acid_wastes` `BIOMES` entry (sickly-olive floor `0x4a5238`, acid-yellow-green path `0x9aaa3a`, toxic-ochre tallGrass `0x5a6a28`, dark-corroded walls, acid-green water).
- `WorldMapScene.ts` — remove `"The Acid Wastes"` from `LOCKED_REGION_LABELS` (→ 2 left: *The Crucible*, *Equilibrium's Heart*).
- `loadGameContent.ts` — `import acidsBases from './data/questions/acids-bases.json'`; add `'acids-bases': acidsBases` to the `questions` map.

## Tests
`realContent.test.ts` — add the `acid-wastes.json` import; add `'acid-wastes'` to the reachability test's `maps` record; a "Region 6 exists, index 6, topic acids-bases, valid mini-boss + region boss, `regions[index===5].unlocksRegionId === 'acid-wastes'`" test; an "acids-bases bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; an `acid-wastes.json` parses+shape test. The asset-key / NPC-walkability / first-NPC-reachability / first-lesson-flag tests auto-cover Region 6. `loadGameContent().warnings` stays `[]` (manifest before enemies/NPCs/region; question import before the region entry — the reachability test goes red between adding the region and adding its `maps` entry; fixed in the same task as the region tests). `tsc` clean; `npm test` green (154 + 3 new = 157); `npm run build` succeeds.

## Balance
Player enters R6 ≈ Lv 21–22 (after clearing Region 5). Fixed rewards (shrine 1150, mini-boss `xpYield` 350, boss `xpYield` 660 + `bossReward.xp` 1300) + ~15 wild fights ≈ 150–192 + quiz bonuses bring a grinding player to ≈ Lv 24–26 by *The pH Tyrant* (≈ Lv 24) — a fair fight; new-skill unlocks (Lv 22–24) reached. Mini-boss ≈ Lv 22; wild Lv 18–21 with `litmuse` the deliberate Lv-18 pushover. `bossSoftScale:true` scales the boss up for an over-levelled player, leaves it at Lv 24 otherwise. Full balance tuning remains Milestone 4.

## Out of scope
Region 7 (next loop iteration) and Region 8 (the finale, left for the user); real art/audio (separate asset milestone — BootScene auto-picks up real PNGs once they exist; the coloured-rect fallback covers the new keys); any new battle mechanic/scene/engine change; stage-2 class evolutions; the "Skill Progression" milestone.

## Verification
`npm run dev`: from a save with Region 5 cleared, the World Map shows "The Acid Wastes" unlocked with "◀ START HERE"; entering it shows the corroded-olive wasteland biome, the 3 mentors (★ on Apothecary Vitra until you talk to them — reachable from spawn before the mini-boss), the acids-bases lesson dialogue, encounter-tile wild battles with acids-bases questions, the Litmus Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The pH Tyrant* shows the "Equilibrium restored to The Acid Wastes!" banner + ✓ on the World Map, learns `corrosive-burn`, lands the reward items; loading mid-Region-6 resumes correctly.
