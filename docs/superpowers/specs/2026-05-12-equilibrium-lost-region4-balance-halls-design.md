# Design — Region 4: The Balance Halls

**Status:** approved (autonomous overnight build — follows the established Region-2/3 pattern; the user pre-authorised building Regions 4–7 without further input).
**Goal:** add the fourth playable region — *The Balance Halls* — fully playable end-to-end (lesson NPCs → wild battles → Challenge Shrine → mini-boss → region boss → "equilibrium restored"), and wire the World Map's unlock chain so clearing Region 3 opens Region 4. Mostly content (JSON) plus the same small code generalisations Regions 2–3 needed; no new scenes, no engine changes.

**Source of truth for the region:** the design-spec roadmap (`docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md` §3): Region 4 = *The Balance Halls*, topic *"Conservation of mass; writing & balancing chemical equations"*, region boss *The Lopsided Equation*. Built from the proven Region-3 pattern (`docs/superpowers/specs/2026-05-12-equilibrium-lost-region3-reaction-hollow-design.md` + its plan) with the playtest-audit fixes already in place (first mentor reachable before the mini-boss; hyphenated chokepoint flag matching `battleVictory.ts`; per-region `lesson_<topic>_seen`; distinct theme-fitting enemy movesets; levels chosen for what the player can plausibly reach given `xpToNextLevel = 100*level`).

## Scope of the content

**Chemistry topic (`balancing-equations`)** — NSW Year 10 Chemistry:
- the law of conservation of mass — atoms are rearranged in a reaction, never created or destroyed, so the total mass is unchanged; closed vs open systems (a gas escaping looks like mass loss)
- word equations ↔ skeleton symbol equations; reading reactant + product formulae
- balancing by **coefficients** (the big numbers in front), never by changing subscripts (that would change the substance); check each element in turn; treat polyatomic ions (SO₄, NO₃, OH, CO₃, NH₄) as single units when they survive the reaction; "balance the awkward element / oxygen last" heuristic
- state symbols `(s)`, `(l)`, `(g)`, `(aq)`
- interpreting a balanced equation as a mole/particle ratio (2H₂ + O₂ → 2H₂O means 2 : 1 : 2)

**`questions/balancing-equations.json`** — ~45 questions, difficulties 1–3 (≥5 each). This is the one topic where the `balanceEquation` widget is the *star*, so include **8–14 `balanceEquation` items** spanning easy (`Mg + Cl₂ → MgCl₂`, `2H₂ + O₂ → 2H₂O`) to harder (`2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O`, `2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu` — keep formula strings ASCII-clean like `Al2(SO4)3`), plus MCQ items on conservation of mass, "which is balanced?", "what coefficient goes here?", state symbols, and ratio reading. Every item passes `validateQuestion`; a `hint` on each; Year-10 reading level.

**`tilemaps/balance-halls.json`** — a hand-authored 24×18 grid: re-use the proven Region-2/3 `ground` grid verbatim (connectivity / the north-running chokepoint / first-NPC-reachable-before-the-guardian already validated by tests); only the `objects` differ — `player_spawn` near the bottom, the first mentor on a tile reachable from spawn, an encounter-tile stretch on the way up, 3 `npc` objects where `npcs.json` puts them, a `shrine_entrance` off to one side (`regionId: "balance-halls"`), a `minibossTrigger` at the chokepoint (`enemyId`, `flag: "miniboss_balance-halls_done"`), a `bossGate` near the top (`enemyId`, `requiresFlag: "miniboss_balance-halls_done"`), an `exit` (`to: "world"`).

**`npcs.json`** — 3 new mentors (`node[0]` entry; every `next`/`choices.next` resolves; terminal nodes `end: true`; `spriteKey`s new `npc_<id>`; `tile`s match the tilemap):
- `archivist-pollux` — Archivist Pollux (conservation of mass + word→symbol equations; **quest NPC** = `npcIds[0]`; teach-path final node and skip node both set `setFlag: "lesson_balancing-equations_seen"`).
- `weighmaster-libra` — Weighmaster Libra (the balancing technique — coefficients not subscripts, check each element, polyatomic ions as units, balance the awkward one / oxygen last).
- `shrinekeeper-scale` — Shrinekeeper Scale (shrine intro; a node with `launch: "shrine"`).

**`enemies.json`** — 7 new entries:
- 4 wild "imbalance" enemies, ≈ Lv 13–16, distinct theme-fitting movesets, roughly equal `xpYield` (≈ 110–170), one deliberate Lv-13 pushover (low HP/atk), `role: "wild"`. Suggested cast: `equilet` (Atomic, Lv 13 — pushover), `coeffix` (Synthesis, Lv 14), `tilted-flask` (Decomposition, Lv 15 — `splitIntoId: "tilted-flask-half"`), `mass-thief` (Neutral, Lv 16 — `teachesSkillId` set to one of the new skills).
- `tilted-flask-half` (Decomposition, Lv 15, low HP, no skills, no split, `role: "wild"`, `xpYield ≈ 22`).
- 1 mini-boss `the-unbalanced-flask` (Atomic, ≈ Lv 16, `role: "miniBoss"`, `bossSoftScale: false`; uses 1–2 of the new/reaction-types/atomic skills).
- *The Lopsided Equation* (Atomic, ≈ Lv 18, `role: "regionBoss"`, `bossSoftScale: true`, `teachesSkillId` = one new skill; uses 2–3 skills incl. a quizzed balancing-equations one + the no-quiz filler).

**`skills.json` + `classes.json`** — 2 new quizzed skills (`topic: "balancing-equations"`) + 1 enemy-only filler (`topic: null`). Keep it minimal — only genuinely-new flavour:
- `equilibrate` (`affinity: "Neutral"`, power ≈ 38, energyCost ≈ 28, `behavior.stripBuffs` — re-balances the equation, crashing the target's stat boosts out). Boss reward / `teachesSkillId`.
- `mass-strike` (`affinity: "Atomic"`, power ≈ 42, energyCost ≈ 26, `behavior.applyStatus` of `oxidised`).
- `lopsided-surge` (`affinity: "Atomic"`, `topic: null`, power ≈ 38, energyCost 0, no behavior) — *The Lopsided Equation*'s filler; enemy-only.
Added to the classes' `skillUnlocks` at levels ≈ 16–18 (all ≤ the boss level): e.g. pyron L16 `mass-strike` / L18 `equilibrate`; aqualis L17 `equilibrate` / L18 `mass-strike`; ionix L16 `mass-strike` / L17 `equilibrate` (ionix's signature is Atomic, so `mass-strike` benefits from the 1.25× — fitting).

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` for `tiles_balance_halls`, `bg_battle_balance_halls`, the 7 new `enemy_*` (`enemy_equilet`, `enemy_coeffix`, `enemy_tilted_flask`, `enemy_tilted_flask_half`, `enemy_mass_thief`, `enemy_unbalanced_flask`, `enemy_lopsided_equation`), the 3 new `npc_*` (`npc_archivist_pollux`, `npc_weighmaster_libra`, `npc_shrinekeeper_scale`) — coloured-rect placeholders in a "hall of scales" palette (pale marble, brass, verdigris/patina, dark marble); plus `tilemaps.tilemap_balance_halls`.
- `regions.json`: append the Region 4 entry — `id: "balance-halls"`, `index: 4`, `name: "The Balance Halls"`, `topic: "balancing-equations"`, `tilemapKey: "tilemap_balance_halls"`, `tilesetKey: "tiles_balance_halls"`, `battleBackgroundKey: "bg_battle_balance_halls"`, `wildEnemyIds: ["equilet", "coeffix", "tilted-flask", "mass-thief"]`, `encounterRatePerStep: 0.10`, `miniBossId: "the-unbalanced-flask"`, `regionBossId: "the-lopsided-equation"`, `npcIds: ["archivist-pollux", "weighmaster-libra", "shrinekeeper-scale"]`, `shrine: { questionTopic: "balancing-equations", questionCount: 6, passRatio: 0.8333, rewardXp: ~850, rewardItemIds: ["energy-cell", "buffer"] }`, `unlocksRegionId: null`, `bossReward: { xp: ~1000, itemIds: ["reagent", "isotope-core"], skillId: "equilibrate" }`. **Also change Region 3's (`reaction-hollow`) `unlocksRegionId` from `null` → `"balance-halls"`.**

## Code changes (small — same shape as Regions 2–3)

- **`OverworldScene.ts`** — add the 4th tilemap to `TILEMAPS` (`import balanceHalls from '../content/data/tilemaps/balance-halls.json'; …`); add a `tiles_balance_halls` entry to the `BIOMES` palette map (pale-marble floor, brass paths, verdigris encounter tiles, dark-marble walls).
- **`WorldMapScene.ts`** — remove `"The Balance Halls"` from `LOCKED_REGION_LABELS` (→ 4 entries: *Catalyst Crags*, *The Acid Wastes*, *The Crucible*, *Equilibrium's Heart*).
- **`loadGameContent.ts`** — `import balancingEquations from './data/questions/balancing-equations.json'`; add `'balancing-equations': balancingEquations` to the `questions` map.
- **`main.ts` / battle / dialogue / shrine / menu scenes** — no change.

## Tests

- `realContent.test.ts` — add: the `balance-halls.json` import; add `'balance-halls'` to the first-NPC-reachability test's `maps` record; a "Region 4 (`balance-halls`) exists, `index === 4`, `topic === "balancing-equations"`, valid mini-boss + region boss, `regions[2].unlocksRegionId === "balance-halls"`" test; a "balancing-equations bank has 40–60 questions, ≥5 per difficulty (and at least one `balanceEquation`)" test; a `tilemaps/balance-halls.json` parses+shape test (24×18, expected interactive objects, 3 npc objects). The existing asset-key cross-ref, NPC-walkability, first-NPC-reachability, and first-lesson-flag tests already iterate every region, so they auto-cover Region 4.
- `loadGameContent().warnings` must stay `[]`; order the implementation so the assetManifest placeholders land before the enemies/NPCs/region that reference their sprite keys, and the `balancing-equations.json` import lands before the region entry whose `topic` is `"balancing-equations"`.
- `npx tsc --noEmit` clean; `npm test` green (existing + the new region tests); `npm run build` succeeds.

## Balance

The player enters Region 4 around **Lv 16–17** (after clearing Region 3). With the `100*level` XP curve, the Region-4 fixed rewards (shrine ≈ 850, mini-boss `xpYield` ≈ 280, boss `xpYield` ≈ 560 + `bossReward.xp` ≈ 1000) plus ~15 wild fights at ≈ 110–170 plus per-correct quiz bonuses bring a grinding player to ≈ **Lv 19–20** by *The Lopsided Equation* (≈ Lv 18) — a fair fight, and the new-skill unlocks (Lv 16–18) are reached. Mini-boss ≈ Lv 16; wild enemies Lv 13–16 with `equilet` the deliberate Lv-13 pushover. `bossSoftScale: true` scales the boss up for an over-levelled player and leaves it at Lv 18 for an under-levelled one. Full balance tuning remains Milestone 4.

## Out of scope
- Regions 5–8 and the finale — same pattern, later overnight-loop iterations / future milestones.
- Real art/audio (a separate asset milestone; the BootScene loader auto-picks up real PNGs at the manifest's `images` paths once they exist — the coloured-rect placeholder fallback covers the new keys until then).
- Any new battle mechanic, scene, or engine change; stage-2 class evolutions; the "Skill Progression" milestone.

## Verification
- `npm run dev`: from a save with Region 3 cleared, the World Map shows "The Balance Halls" unlocked with "◀ START HERE"; entering it shows the marble-and-brass biome, the 3 mentors (★ on Archivist Pollux until you talk to her — reachable from spawn before the mini-boss), the balancing-equations lesson dialogue, encounter-tile wild battles with balancing-equations questions (heavy on the balance-the-equation widget), the Scale Shrine, the mini-boss chokepoint (confirm-to-engage; the tile north sealed until it's down), the boss gate (sealed until the mini-boss is beaten), and beating *The Lopsided Equation* shows the "Equilibrium restored to The Balance Halls!" banner + ✓ on the World Map, learns `equilibrate`, lands the reward items; loading mid-Region-4 resumes correctly.
