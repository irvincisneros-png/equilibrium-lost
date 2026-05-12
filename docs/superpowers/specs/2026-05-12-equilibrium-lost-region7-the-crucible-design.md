# Design — Region 7: The Crucible

**Status:** approved (autonomous overnight build — follows the established Region-2…6 pattern; the user pre-authorised building Regions 5–7 without further input). This is the last region built by the overnight loop; Region 8 (the finale) is left for the user.
**Goal:** add the seventh playable region — *The Crucible* (NSW Year 10 Chemistry: energy in reactions — exothermic vs endothermic; bond breaking/making energy; energy-profile diagrams; activation energy; everyday examples) — fully playable end-to-end, wiring the World Map's unlock chain so clearing Region 6 opens Region 7. Content JSON + the same small code generalisations Regions 2–6 needed; no new scenes/engine changes.

**Source of truth:** the design-spec roadmap (`docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md` §3): Region 7 = *The Crucible*, topic *"Energy in reactions: exothermic vs endothermic; energy profile diagrams"*, region boss *The Heat Sink*. Built from the proven Region-6 pattern (`docs/superpowers/specs/.../region6-acid-wastes-design.md` + its plan). Player enters R7 ≈ Lv 24–25.

## Scope of the content

**Chemistry topic (`energy-changes`)** — NSW Year 10:
- **exothermic** reactions give out heat (surroundings warm up), ΔH negative, products lower in energy than reactants; **endothermic** reactions take in heat (surroundings cool down), ΔH positive, products higher
- **bond breaking absorbs energy** (an endothermic step); **bond making releases energy** (an exothermic step); the overall change = (energy in to break old bonds) − (energy out from making new bonds) — net out ⇒ exothermic, net in ⇒ endothermic
- **energy-profile / reaction-profile diagrams**: reactants → an activation-energy "hump" → products; exothermic profile dips down (products below reactants), endothermic rises up; a **catalyst lowers the hump** (activation energy) without changing the reactant/product levels or ΔH
- **activation energy** = the minimum energy a collision must have to react (why even exothermic reactions often need a spark)
- everyday **exothermic**: combustion, respiration, neutralisation, most oxidation, hand-warmers (iron rusting), thermite; everyday **endothermic**: thermal decomposition (heating carbonates), photosynthesis, electrolysis, dissolving ammonium nitrate (instant cold packs)
- classifying a reaction by the temperature change in a polystyrene-cup "calorimeter"

**`questions/energy-changes.json`** — ~45 questions, 16 d1 / 16 d2 / 13 d3 (≥5 each); **3 `balanceEquation` items** (`CH4 + 2O2 → CO2 + 2H2O` d2 [1,2,1,2] — combustion is exothermic; `2H2 + O2 → 2H2O` d2 [2,1,2] — exothermic; `CaCO3 → CaO + CO2` d3 [1,1,1] — thermal decomposition is endothermic). MCQ on exo/endo classification, ΔH sign, bond breaking/making energy, energy-profile diagrams, activation energy, the catalyst-on-the-profile point, everyday examples, temperature-change experiments. ASCII formula strings; a `hint` on every item; **vary the MCQ answer position** (spread across 0/1/2/3); all pass `validateQuestion`; Year-10 reading level.

**`tilemaps/the-crucible.json`** — the proven R2…R6 24×18 `ground` grid verbatim; only the `objects` differ: `player_spawn (11,14)`, `exit (11,17, to:"world")`, `npc thermologist-calor (11,12)`, `npc forgemaster-pyra (7,8)`, `npc shrinekeeper-ember (4,12)`, `shrine_entrance (3,12, regionId:"the-crucible")`, `minibossTrigger (11,4, enemyId:"the-flashpoint", flag:"miniboss_the-crucible_done")`, `bossGate (11,2, enemyId:"the-heat-sink", requiresFlag:"miniboss_the-crucible_done")`.

**`npcs.json`** — 3 new mentors (`node[0]` entry; every `next`/`choices.next` resolves; terminals `end:true`; new `npc_<id>` sprite keys; tiles match the tilemap):
- `thermologist-calor` — Thermologist Calor (exo/endo, ΔH, energy-profile diagrams, activation energy, catalysts-on-the-profile; **quest NPC** = `npcIds[0]`; teach-path final node + skip node both set `setFlag:"lesson_energy-changes_seen"`).
- `forgemaster-pyra` — Forgemaster Pyra (bond breaking/making energy + everyday exo/endo examples).
- `shrinekeeper-ember` — Shrinekeeper Ember (shrine intro; a node with `launch:"shrine"`, `setFlag:"shrine_entered_the-crucible"`).

**`enemies.json`** — 7 new entries (≈ Lv 21–24 wild, Lv 25 mini-boss, Lv 27 region boss; one deliberate low-HP pushover; one with a `teachesSkillId`; the decomposition wild enemy has a `splitIntoId` half):
- `cinderling` (Exothermic, Lv 21 — pushover, fast, low HP), `exotherm` (Exothermic, Lv 22), `cracklith` (Decomposition, Lv 23 — `splitIntoId:"cracklith-half"`), `endotherm` (Endothermic, Lv 24 — `teachesSkillId:"exothermic-burst"`); `cracklith-half` (Decomposition, Lv 23, low HP, no skills, `role:"wild"`, `xpYield 28`); mini-boss `the-flashpoint` (Exothermic, Lv 25, `bossSoftScale:false`); region boss `the-heat-sink` (Endothermic, Lv 27, `bossSoftScale:true`, `teachesSkillId:"endothermic-drain"`; `spriteKey:"enemy_heat_sink"`; `skillIds` incl. the no-quiz filler `heat-flux`).

**`skills.json` + `classes.json`** — 2 new quizzed skills (`topic:"energy-changes"`) + 1 enemy-only filler (`topic:null`):
- `exothermic-burst` (`affinity:"Exothermic"`, power ≈ 42, energy ≈ 26, `behavior.applyStatus` `combusting` — releases stored energy as a burst). (`endotherm` teaches it; lore: defeating an endotherm lets the energy out.)
- `endothermic-drain` (`affinity:"Endothermic"`, power ≈ 40, energy ≈ 26, `behavior.applyStatus` `endothermicChill` — pulls heat/energy out of the target ⇒ ATK drop). Boss reward / `teachesSkillId`. (`Endothermic → Exothermic/Combustion = 2×` in the type chart, so it's strong against the region's Exothermic enemies.)
- `heat-flux` (`affinity:"Exothermic"`, `topic:null`, power ≈ 38, energy 0) — *The Heat Sink*'s filler; enemy-only.
Added to the classes' `skillUnlocks` at levels ≈ 25–27 (all ≤ the boss level): pyron L25 `exothermic-burst` / L27 `endothermic-drain`; aqualis L25 `exothermic-burst` / L26 `endothermic-drain`; ionix L26 `exothermic-burst` / L27 `endothermic-drain`.

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` for `tiles_the_crucible`, `bg_battle_the_crucible`, the 7 new `enemy_*` (`enemy_cinderling`, `enemy_exotherm`, `enemy_cracklith`, `enemy_cracklith_half`, `enemy_endotherm`, `enemy_flashpoint`, `enemy_heat_sink`), the 3 new `npc_*` (`npc_thermologist_calor`, `npc_forgemaster_pyra`, `npc_shrinekeeper_ember`) — coloured-rect placeholders in a molten-forge palette (dark forge floor, molten orange, glowing slag, dark forge metal); plus `tilemaps.tilemap_the_crucible`.
- `regions.json`: append the Region 7 entry — `id:"the-crucible"`, `index:7`, `name:"The Crucible"`, `topic:"energy-changes"`, `tilemapKey:"tilemap_the_crucible"`, `tilesetKey:"tiles_the_crucible"`, `battleBackgroundKey:"bg_battle_the_crucible"`, `wildEnemyIds:["cinderling","exotherm","cracklith","endotherm"]`, `encounterRatePerStep:0.10`, `miniBossId:"the-flashpoint"`, `regionBossId:"the-heat-sink"`, `npcIds:["thermologist-calor","forgemaster-pyra","shrinekeeper-ember"]`, `shrine:{questionTopic:"energy-changes",questionCount:6,passRatio:0.8333,rewardXp:1300,rewardItemIds:["energy-cell","buffer"]}`, `unlocksRegionId:null`, `bossReward:{xp:1450,itemIds:["reagent","isotope-core"],skillId:"endothermic-drain"}`. **Also change Region 6's (`acid-wastes`) `unlocksRegionId` from `null` → `"the-crucible"`.**

## Code changes (small — same shape as Regions 2–6)
- `OverworldScene.ts` — `import theCrucible from '../content/data/tilemaps/the-crucible.json'`; add `tilemap_the_crucible: theCrucible as unknown as TilemapData` to `TILEMAPS`; add a `tiles_the_crucible` `BIOMES` entry (dark-forge floor `0x3a322a`, molten-orange path `0xc25a18`, glowing-slag tallGrass `0x8a4a14`, dark-forge walls, molten-metal water).
- `WorldMapScene.ts` — remove `"The Crucible"` from `LOCKED_REGION_LABELS` (→ 1 left: *Equilibrium's Heart*).
- `loadGameContent.ts` — `import energyChanges from './data/questions/energy-changes.json'`; add `'energy-changes': energyChanges` to the `questions` map.

## Tests
`realContent.test.ts` — add the `the-crucible.json` import; add `'the-crucible'` to the reachability test's `maps` record; a "Region 7 exists, index 7, topic energy-changes, valid mini-boss + region boss, `regions[index===6].unlocksRegionId === 'the-crucible'`" test; an "energy-changes bank 40–60 Q, ≥5 per difficulty, ≥1 balanceEquation" test; a `the-crucible.json` parses+shape test. The asset-key / NPC-walkability / first-NPC-reachability / first-lesson-flag tests auto-cover Region 7. `loadGameContent().warnings` stays `[]` (manifest before enemies/NPCs/region; question import before the region entry — the reachability test goes red between adding the region and adding its `maps` entry; fixed in the same task as the region tests). `tsc` clean; `npm test` green (157 + 3 new = 160); `npm run build` succeeds.

## Balance
Player enters R7 ≈ Lv 24–25 (after clearing Region 6). Fixed rewards (shrine 1300, mini-boss `xpYield` 400, boss `xpYield` 700 + `bossReward.xp` 1450) + ~15 wild fights ≈ 162–204 + quiz bonuses bring a grinding player to ≈ Lv 27–29 by *The Heat Sink* (≈ Lv 27) — a fair fight; new-skill unlocks (Lv 25–27) reached. Mini-boss ≈ Lv 25; wild Lv 21–24 with `cinderling` the deliberate Lv-21 pushover. `bossSoftScale:true` scales the boss up for an over-levelled player, leaves it at Lv 27 otherwise. Full balance tuning remains Milestone 4.

## Out of scope
Region 8 (the finale — *Equilibrium's Heart* / *The Great Imbalance* + the "game complete" ending; left for the user — wants their design input); real art/audio (separate asset milestone — BootScene auto-picks up real PNGs once they exist; the coloured-rect fallback covers the new keys); any new battle mechanic/scene/engine change; stage-2 class evolutions; the "Skill Progression" milestone.

## Verification
`npm run dev`: from a save with Region 6 cleared, the World Map shows "The Crucible" unlocked with "◀ START HERE"; entering it shows the molten-forge biome, the 3 mentors (★ on Thermologist Calor until you talk to them — reachable from spawn before the mini-boss), the energy-changes lesson dialogue, encounter-tile wild battles with energy-changes questions, the Ember Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The Heat Sink* shows the "Equilibrium restored to The Crucible!" banner + ✓ on the World Map, learns `endothermic-drain`, lands the reward items; loading mid-Region-7 resumes correctly. After this, 7 of the 8 regions are playable end-to-end; only the finale (Region 8) remains.
