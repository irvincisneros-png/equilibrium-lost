# Design — Region 3: Reaction Hollow

**Status:** approved.
**Goal:** add the third playable region — *Reaction Hollow* — fully playable end-to-end (lesson NPCs → wild battles → Challenge Shrine → mini-boss → region boss → "equilibrium restored"), and wire the World Map's unlock chain so clearing Region 2 opens Region 3. Mostly content (JSON) plus the same handful of small code generalisations Region 2 needed; no new scenes, no engine changes.

**Source of truth for the region:** the design-spec roadmap (`docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md`): Region 3 = *Reaction Hollow*, topic *"Reaction types: synthesis, decomposition, combustion, displacement, precipitation"*, region boss *The Eternal Flame*. Built from the proven Region-2 pattern (`docs/superpowers/specs/2026-05-12-equilibrium-lost-region2-bonding-forge-design.md` + its plan) with the playtest-audit fixes already folded in (first mentor reachable before the mini-boss; hyphenated chokepoint flag matching `battleVictory.ts`; per-region `lesson_<topic>_seen`; enemies get distinct theme-fitting movesets; levels chosen for what the player can plausibly reach, not just round spec numbers).

## Scope of the content

**Chemistry topic (`reaction-types`)** — NSW Year 10 Chemistry, classifying reactions:
- synthesis / combination (A + B → AB; e.g. metal + oxygen → metal oxide; 2H₂ + O₂ → 2H₂O)
- decomposition (AB → A + B; e.g. thermal decomposition of carbonates, CaCO₃ → CaO + CO₂; electrolysis as decomposition)
- combustion (fuel + O₂ → CO₂ + H₂O, exothermic; complete vs incomplete combustion of hydrocarbons)
- single displacement (a more reactive metal displaces a less reactive one from its compound; e.g. Zn + CuSO₄ → ZnSO₄ + Cu); the metal reactivity series basics (K > Na > Ca > Mg > Al > Zn > Fe > Cu > Ag > Au)
- precipitation (two soluble salts → an insoluble precipitate; e.g. AgNO₃ + NaCl → AgCl↓ + NaNO₃; recognising "↓" / "(s)")
- classifying a reaction from a word or symbol equation; predicting the products of common reactions; spotting which reactions are exothermic

**`questions/reaction-types.json`** — ~45 questions spanning difficulties 1–3 (≥5 each), mostly `mcq`; include 2–4 `balanceEquation` items (a combustion one e.g. `2H₂ + O₂ → 2H₂O` or `CH₄ + 2O₂ → CO₂ + 2H₂O`, a decomposition one e.g. `2H₂O → 2H₂ + O₂`, a displacement one e.g. `Zn + CuSO₄ → ZnSO₄ + Cu`) so the widget and the boss have something to use. Every item passes `validateQuestion`; a `hint` on each (Study Mode); Year-10 reading level.

**`tilemaps/reaction-hollow.json`** — a hand-authored 24×18 grid (same format as `bonding-forge.json`): a volcanic-cavern layout — `player_spawn` near the bottom; a path winding up past the first mentor (placed on a tile **reachable from spawn before the mini-boss**); an ember-vent tall-grass stretch on the way to the chokepoint; 3 `npc` objects where `npcs.json` puts them; a `shrine_entrance` off to one side (with `regionId: "reaction-hollow"`); a `minibossTrigger` at a 1-wide chokepoint running **north** (`enemyId`, `flag: "miniboss_reaction-hollow_done"`); a `bossGate` near the top (`enemyId`, `requiresFlag: "miniboss_reaction-hollow_done"`); an `exit` (`to: "world"`). The Forge-Gate wall row is all walls except the chokepoint column; `canEnter` seals the tile directly north of the undefeated trigger.

**`npcs.json`** — 3 new mentors. `node[0]` is the entry node; every `next`/`choices.next` resolves; terminal nodes carry `end: true`. `spriteKey`s are new `npc_<id>` keys; `tile`s match the tilemap.
- `alchemist-vera` — Alchemist Vera (synthesis & decomposition lesson; **quest NPC** = `npcIds[0]`; both her teach-path final node and her skip node set `setFlag: "lesson_reaction-types_seen"`).
- `pyrologist-ignis` — Pyrologist Ignis (combustion + the metal reactivity series / single displacement).
- `shrinekeeper-cinder` — Shrinekeeper Cinder (shrine intro; a node with `launch: "shrine"`, mirroring R1/R2's shrinekeeper).

**`enemies.json`** — 7 new entries:
- 4 wild "corrupted reaction" enemies, ≈ Lv 11–14, distinct theme-fitting movesets, roughly equal `xpYield` (≈ 95–140 — the player's higher level here, so yields are larger than R2's), one deliberate Lv-11 pushover so the early Hollow isn't a wall, `role: "wild"`:
  - `synthor` (Synthesis, Lv 11 — the pushover, low HP/atk; `skillIds: ["synthesis-fuse"]`)
  - `combustix` (Combustion, Lv 12; `skillIds: ["spark-flare", "combustion-flare"]`)
  - `decomposeer` (Decomposition, Lv 13; `splitIntoId: "decomposeer-half"`; `skillIds: ["decompose", "shell-shatter"]`)
  - `displacid` (Metal, Lv 14; `skillIds: ["ionic-bond", "precipitate"]`; `teachesSkillId: "synthesis-fuse"` so the player can pick up a new skill from a wild fight, like Region 2's covalent-wisp)
- `decomposeer-half` (Decomposition, Lv 13, low HP, no `skillIds`, no `splitIntoId`, `role: "wild"`, `xpYield ≈ 20`) — what `decomposeer` becomes when hit by a `splitTarget` skill (the player's `decompose`); mirrors R1's `shellfracture-half`.
- 1 mini-boss `volatile-mixture` (Synthesis, ≈ Lv 14, `role: "miniBoss"`, `bossSoftScale: false`; uses 1–2 reaction-types skills, e.g. `["synthesis-fuse", "combustion-flare"]`).
- *The Eternal Flame* (Combustion, ≈ Lv 16, `role: "regionBoss"`, `bossSoftScale: true`, `teachesSkillId: "combustion-flare"`; uses 2–3 skills incl. a quizzed reaction-types one (`combustion-flare`), `spark-flare`, and the no-quiz filler `flame-surge`).

**`skills.json` + `classes.json`** — 2 new quizzed reaction-types skills + 1 enemy-only filler. Keep it minimal — `decompose` (Decomposition) and `precipitate` (Precipitation) already exist and fit the topic, so only the genuinely-new affinities get new moves:
- `synthesis-fuse` (`affinity: "Synthesis"`, `topic: "reaction-types"`, power ≈ 36, energyCost ≈ 28, `behavior.applyStatus` of `endothermicChill` — the fused compound is inert ⇒ target's ATK drops)
- `combustion-flare` (`affinity: "Combustion"`, `topic: "reaction-types"`, power ≈ 42, energyCost ≈ 26, `behavior.applyStatus` of `combusting` — chance to set the target alight). This is the boss's `teachesSkillId` and the region's `bossReward.skillId`.
- `flame-surge` (`affinity: "Combustion"`, `topic: null`, power ≈ 38, energyCost 0, no behavior) — *The Eternal Flame*'s `isotope-flux`-style filler; enemy-only, not in any class.
Added to the classes' `skillUnlocks` at levels ≈ 14–16 (all ≤ the boss's level so they're plausibly reached): pyron L14 `combustion-flare` / L16 `synthesis-fuse`; aqualis L15 `synthesis-fuse` / L16 `combustion-flare`; ionix L14 `combustion-flare` / L15 `synthesis-fuse`. (Pyron's signature affinity is Combustion, so `combustion-flare` benefits from the 1.25× bonus — fitting.)

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` for `tiles_reaction_hollow`, `bg_battle_reaction_hollow`, the 7 new `enemy_*` (`enemy_synthor`, `enemy_combustix`, `enemy_decomposeer`, `enemy_displacid`, `enemy_decomposeer_half`, `enemy_volatile_mixture`, `enemy_eternal_flame`), and the 3 new `npc_*` (`npc_alchemist_vera`, `npc_pyrologist_ignis`, `npc_shrinekeeper_cinder`) — coloured-rect placeholders in volcanic tones (obsidian black, basalt grey, lava/ember orange, ash), sized like their Region-1/2 counterparts; plus `tilemaps.tilemap_reaction_hollow`.
- `regions.json`: append the Region 3 entry — `id: "reaction-hollow"`, `index: 3`, `name: "Reaction Hollow"`, `topic: "reaction-types"`, `tilemapKey: "tilemap_reaction_hollow"`, `tilesetKey: "tiles_reaction_hollow"`, `battleBackgroundKey: "bg_battle_reaction_hollow"`, `wildEnemyIds: ["synthor", "combustix", "decomposeer", "displacid"]`, `encounterRatePerStep: 0.10`, `miniBossId: "volatile-mixture"`, `regionBossId: "the-eternal-flame"`, `npcIds: ["alchemist-vera", "pyrologist-ignis", "shrinekeeper-cinder"]`, `shrine: { questionTopic: "reaction-types", questionCount: 6, passRatio: 0.8333, rewardXp: ~700, rewardItemIds: ["energy-cell", "buffer"] }`, `unlocksRegionId: null`, `bossReward: { xp: ~850, itemIds: ["reagent", "isotope-core"], skillId: "combustion-flare" }`. **Also change Region 2's `unlocksRegionId` from `null` → `"reaction-hollow"`.**

## Code changes (small — same shape as Region 2)

- **`OverworldScene.ts`** — add the 3rd tilemap to the `TILEMAPS` registry (`import reactionHollow from '../content/data/tilemaps/reaction-hollow.json'; TILEMAPS = { …, tilemap_reaction_hollow: … }`); add a `tiles_reaction_hollow` entry to the `BIOMES` palette map (obsidian floor, lava-ember path, ash-grey tall-grass, basalt walls). No other changes — the per-region `lesson_${region.topic}_seen` flag and the chokepoint logic are already generic.
- **`WorldMapScene.ts`** — remove `"Reaction Hollow"` from `LOCKED_REGION_LABELS` (→ 5 entries: *The Balance Halls*, *Catalyst Crags*, *The Acid Wastes*, *The Crucible*, *Equilibrium's Heart*). The node-rendering / unlock-chain / "◀ START HERE" logic already iterates `content.regions`, so Region 3 lights up as a real node, unlocked once Region 2's boss is down.
- **`loadGameContent.ts`** — `import reactionTypes from './data/questions/reaction-types.json'`; add `'reaction-types': reactionTypes` to the `questions` map.
- **`main.ts`** — no change (no new scenes).
- **Battle / Dialogue / Shrine / Menu / World Map scenes** — no other change (data-driven; the new enemies, NPCs, skills, shrine, region all just work).

## Tests

- `realContent.test.ts` — add: a "Region 3 (`reaction-hollow`) exists, `index === 3`, `topic === "reaction-types"`, has a valid mini-boss and region boss, and `regions[1].unlocksRegionId === "reaction-hollow"`" test; a "reaction-types question bank has 40–60 questions, ≥5 per difficulty" test; a parses+shape check for `tilemaps/reaction-hollow.json` (24×18, expected interactive objects, 3 npc objects). The existing asset-key cross-ref, NPC-walkability, first-NPC-reachability-before-the-guardian, and first-lesson-flag-matches-`region.topic` tests already iterate every region, so they auto-cover Region 3.
- `loadGameContent().warnings` must stay `[]` (all new ids resolve; `reaction-types` is a loaded topic before the region entry references it — order the implementation accordingly).
- `npx tsc --noEmit` clean; `npm test` green (existing + the new region tests); `npm run build` succeeds.
- Ordering note (so no commit leaves `warnings` non-empty): land the new `assetManifest` placeholders before the enemies/NPCs/region that reference their sprite keys; land the `reaction-types.json` import in `loadGameContent.ts` before the region entry whose `topic` is `"reaction-types"`.

## Balance

The player enters Region 3 around **Lv 12–13** (after clearing Region 2). With the `xpToNextLevel = 100*level` curve, the Region-3 fixed rewards (shrine ≈ 700, mini-boss `xpYield` ≈ 230, boss `xpYield` ≈ 480 + `bossReward.xp` ≈ 850) plus ~15 wild fights at ≈ 95–140 XP plus per-correct quiz bonuses bring a player who does the required content + moderate grinding to ≈ **Lv 16** by the time they reach *The Eternal Flame* (≈ Lv 16) — so the boss is a fair fight and the new-skill unlocks (Lv 14–16) are plausibly reached. Mini-boss ≈ Lv 14 (player ≈ Lv 14–15 by then); wild enemies Lv 11–14 with `synthor` the deliberate Lv-11 pushover (low HP/atk). `bossSoftScale: true` on the boss scales it *up* for an over-levelled player and leaves it at Lv 16 for an under-levelled one (gap ≈ 3 if they're Lv 13 — tight but winnable with items, the R1/R2 pattern). Full balance tuning remains Milestone 4.

## Out of scope
- Regions 4–8 and the finale (*Equilibrium's Heart* / *The Great Imbalance*) — same pattern, future milestones.
- Real art/audio (a separate asset milestone is in flight).
- Any new battle mechanic, scene, or engine change.
- Stage-2 class evolutions (the roadmap ties those to *The Crucible* / Region 7) — a future milestone.
- The "Skill Progression" milestone (auto-scaling + per-skill refine + a richer type chart) — already drafted at `docs/superpowers/specs/2026-05-12-equilibrium-lost-skill-progression-design.md`; not part of this region.

## Verification
- `npm run dev`: from a save with Region 2 cleared, the World Map shows "Reaction Hollow" unlocked with "◀ START HERE"; entering it shows the volcanic biome (obsidian/ember, distinct from the Forge), the 3 mentors (★ on Alchemist Vera until you talk to her — and she's reachable from spawn before the mini-boss), the reaction-types lesson dialogue (which pauses page-to-page and node-to-node, waiting for a press), tall-grass wild battles with reaction-types questions (incl. the balance-equation widget items), the Cinder Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north stays sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The Eternal Flame* shows the "Equilibrium restored to Reaction Hollow!" banner + ✓ on the World Map, learns `combustion-flare`, lands the reward items; loading mid-Region-3 resumes correctly.
