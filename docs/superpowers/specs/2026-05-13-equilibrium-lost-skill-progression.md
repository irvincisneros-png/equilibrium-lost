# Design — Skill Progression milestone

**Status:** approved 2026-05-13. Supersedes the 2026-05-12 draft (`2026-05-12-equilibrium-lost-skill-progression-design.md`, deleted). Ships all three pillars together as one coherent rebalance.

**Why:** playtest feedback — *"your personal skills should be upgradable, otherwise you are just choosing the highest attacking skill every time."* Two problems: (1) a skill learned at Lv 3 becomes dead weight by Lv 14; (2) with the type chart nearly empty there's no *decision* in the skill menu — the highest `power` always wins. This milestone fixes both without touching the educational core (the chemistry quizzes). It also lands the M4-earmarked type-chart + difficulty pass, done once.

**Where it fits:** its own milestone, before R8 (R8's final-boss design leans on it) and before the next playtest pass.

---

## Pillar A — Skill auto-scaling

Every skill's *effective* power grows modestly with the wielder's level so old moves stay viable:

```
effectivePower(skill, wielderLevel) = round(skill.power * (1 + SCALE_PER_LEVEL * (wielderLevel - 1)))
```

- `SCALE_PER_LEVEL = 0.04` (Lv 10 ⇒ ×1.36, Lv 20 ⇒ ×1.76). A named constant; tune in playtest.
- Applies symmetrically to **enemy** skills using the *enemy's* level — enemies already soft-scale stats, so this keeps the curve consistent on both sides.
- **Catalyst Bursts do NOT scale** (`isCatalystBurst: true`) — they already carry large `power` + `chainMult 3.0`; scaling them would blow up the ceiling.
- Pure-utility skills (`power === 0`, e.g. `precipitate`/`equilibrate` carry their value in `behavior`) are untouched — `round(0 * anything) = 0`.
- **Touch points:** `src/systems/battle/damage.ts` (the only damage call site; already receives the attacker's level via `DamageParams`) and/or `src/systems/battle/engine.ts` (compute `effectivePower` where the skill action is built and pass it through). Add `SCALE_PER_LEVEL` next to the other battle tuning constants. No save changes, no scene changes (Pillar C *displays* the scaled number).
- **Risk:** rebalances every fight slightly. Re-check Region 1–7 boss-entry math — the steep `xpToNextLevel = 100*level` curve means players are usually a few levels under the boss, so a +x% bump on their kit is welcome. If anything tips over, nudge boss level/HP in the affected region's data (this is the Pillar-C re-tune anyway).

## Pillar B — "Refine Skills" screen (the playtest ask)

Each unlocked skill has a **tier** `0 → MAX_TIER`. Each tier nudges a couple of stats by a uniform delta. Tiers are bought with a new currency, **Reagent Points (RP)**, in a new MenuScene screen.

### Mechanics
- `MAX_TIER = 3`. **Uniform per-tier deltas** (named constants):
  - `power += 4`
  - status `behavior.applyStatus.chance += 5` (capped at 100; skills with no `applyStatus` ignore this)
  - `energyCost -= 2` (floored at 0)
  - Tier 3 cumulative: +12 power / +15 status chance / −6 energy cost.
- Tier deltas apply **on top of** Pillar A's scaling and **on top of** Pillar C's effectiveness multiplier — so the in-battle effective power is `round((skill.power + 4*tier) * (1 + 0.04*(lvl-1))) * typeMult`.
- **One shared RP pool**; cost rises per tier: **tier 1 = 20 RP, tier 2 = 40 RP, tier 3 = 70 RP** (130 RP to fully max a single skill). Named constant array `REFINE_TIER_COSTS = [20, 40, 70]`.
- **RP awards** (in `src/scenes/battleVictory.ts`, alongside XP): wild win **+2**, mini-boss **+8**, region boss **+15**, Challenge Shrine clear **+5** (added wherever the shrine grants its reward — see `ChallengeShrineScene` / `shrineScoring.ts`). Rough whole-game total ≈ 200–230 RP ⇒ a player maxes ~1–2 favourites or spreads tier-1 across many skills. All four award amounts are named constants; tune in playtest.

### Save (version 2)
- Add to `SaveData`: `skillTiers: Record<string, number>` (a skill absent from the map ⇒ tier 0) and `reagentPoints: number`.
- `CURRENT_SAVE_VERSION: 1 → 2`. Add the migration step at the `// Milestone 2 appends` placeholder in `SaveManager.migrate`:
  ```ts
  (o) => { o.skillTiers ??= {}; o.reagentPoints ??= 0; o.version = 2; }
  ```
- New games initialise `skillTiers: {}`, `reagentPoints: 0` in the `newGame` factory.
- v1 saves load unchanged and play normally (the migration backfills the new fields).

### Pure helper — `src/scenes/skillRefine.ts`
Mirrors the `loadout.ts` pattern (Phaser-free, fully unit-tested):
- `previewRefine(save, skillId, content)` → `{ tier: number; atMax: boolean; nextTier: number | null; cost: number | null; canAfford: boolean; delta: { power: number; statusChance: number; energyCost: number } | null }` — pure, no mutation.
- `applyRefine(save, skillId, content)` → `{ ok: true; tier: number; reagentPoints: number } | { ok: false; reason: string }` — validates (skill known & unlocked, not at max, enough RP), then mutates `save.skillTiers[skillId]` and `save.reagentPoints`. (Caller persists via `SaveManager`.)
- `effectiveSkill(skill, tier)` → a shallow copy of the `SkillDef` with the tier deltas applied (used by the battle engine and the loadout/refine UIs so the math lives in one place). Clamps as above.

### UI — MenuScene "Refine Skills"
- New entry in `MenuScene`'s top-level menu (next to Loadout / Items / Settings — match the existing menu's style).
- Lists every **unlocked** skill (`save.unlockedSkillIds`): name, affinity, current tier (`●●○` style or `Tier n/3`), and for non-maxed skills the next-tier preview (`+4 power, +5% status, −2 energy → 20 RP`) and whether you can afford it. Shows the RP balance in a header.
- Selecting an affordable skill spends RP and bumps the tier (calls `applyRefine`, then `SaveManager.save`), updates the row in place.
- The Loadout screen also shows each skill's current tier (and effective power) so the player sees the payoff.

## Pillar C — Richer type chart, surfaced in battle

### The matrix (`src/content/data/typeChart.json`)
Fill it into a chemistry-coherent attacker→defender matrix. Implementation does a deliberate *"what does this matchup teach?"* pedagogy pass (same care as the question banks — a subagent drafts it, then it's reviewed). Agreed shape (×2 = super-effective, ×0.5 = resisted; everything else ×1):

| Attacker | ×2 super-effective | ×0.5 resisted | rationale |
|---|---|---|---|
| Acid | Metal, Ionic | Base | acid + metal → salt + H₂; acids dissolve ionic salts; bases neutralise acid |
| Base | Acid | Metal, Covalent | neutralises acid; alkalis leave most metals & molecular substances alone |
| Combustion | Covalent, Decomposition | Endothermic, Metal | combustion breaks covalent fuel bonds; it *is* decomposition by fire; heat-absorbers soak it; metals resist burning |
| Endothermic | Exothermic, Combustion | Endothermic | absorbs the released/ignition heat; like vs like fizzles |
| Exothermic | Endothermic, Metal | Exothermic | overwhelms heat-sinks; metals conduct the heat in; like vs like fizzles |
| Precipitation | Ionic | Acid | precipitates ions out of solution; acids keep them dissolved |
| Synthesis | Decomposition, Atomic | Synthesis | re-assembles what was broken / loose atoms; like vs like fizzles |
| Decomposition | Synthesis, Ionic, Metal | Decomposition | undoes synthesis; shatters ionic & metallic lattices; like vs like fizzles |
| Metal | Covalent | Acid | metallic structure crushes molecular; reactive metals corroded by acid |
| Covalent | Atomic | Combustion | shared pairs pin loose atoms; molecular fuels feed combustion |
| Atomic | Ionic | — | strips electrons → ions; otherwise the neutral all-rounder |
| Catalyst | — | *every affinity* | unchanged — Catalyst is the low-damage setup affinity by design |
| Neutral | — | — | unchanged — `proton-jab` is the reliable always-works fallback |

Enemy affinity distribution skews **Decomposition (12) / Atomic (9)**, then Ionic/Metal/Synthesis/Combustion/Acid/Exothermic (≈3 each), so Synthesis, Combustion and Covalent become genuinely valuable picks — that's the point. (Self-resist entries like `Decomposition→Decomposition ×0.5` discourage mono-affinity loadouts.)

### Surface it in battle
- `BattleScene`'s skill submenu (`refreshSkillMenu` / via `battlePresenter.ts`): tag each skill row vs `this.state.enemy.affinity` — `×2 super-effective!` / `½ resisted` / no tag. `effectiveness(attackAffinity, defenderAffinity)` already exists in `src/systems/battle/typeChart.ts`. This single change is what turns "pick the biggest number" into a real decision.
- Optionally also show the post-scale/post-tier effective power number in the row (nice-to-have; keep if it fits the layout).

### Re-tune
Filling the chart changes every fight's effectiveness profile. Bundle the boss/wild difficulty re-check **here** (this *is* the M4 type-chart work): walk Regions 1–7, confirm each mini-boss/boss is still beatable at a plausible level given (a) Pillar A scaling and (b) the new multipliers; nudge enemy level/HP/affinity in the region data where needed. The `realContent.test.ts` BFS / level-sanity regressions must stay green.

---

## Out of scope
- New affinities or new skills beyond what the chart needs to be coherent.
- Per-class signature-line reworks — the **evolution** system already gives a stronger signature skill per evolution and stays as-is.
- A general balance overhaul of stats/XP beyond the re-check Pillars A & C force.
- Anything multiplayer / not single-player.

## Touched files (summary)
- `src/systems/battle/damage.ts`, `src/systems/battle/engine.ts` — Pillar A scaling + apply tier deltas (via `effectiveSkill`); add `SCALE_PER_LEVEL`.
- `src/content/types.ts` — `SaveData.skillTiers` + `SaveData.reagentPoints`.
- `src/systems/SaveManager.ts` — `CURRENT_SAVE_VERSION = 2`, migration step, `newGame` defaults.
- `src/scenes/skillRefine.ts` *(new)* — `previewRefine` / `applyRefine` / `effectiveSkill`.
- `src/scenes/MenuScene.ts` — "Refine Skills" screen.
- `src/scenes/loadout.ts` and/or its caller — show tier + effective power.
- `src/scenes/battleVictory.ts`, `src/scenes/ChallengeShrineScene.ts` / `shrineScoring.ts` — award RP; add the four `RP_AWARD_*` constants.
- `src/scenes/BattleScene.ts`, `src/scenes/battlePresenter.ts` — effectiveness tag in the skill menu.
- `src/content/data/typeChart.json` — the full matrix.
- `src/content/data/enemies.json` (and/or region tilemap data) — re-tune nudges if needed.
- Tests: `tests/scenes/skillRefine.test.ts` *(new)*, `tests/systems/saveManager.test.ts` (migration v1→v2), `tests/systems/typeChart.test.ts` (new matchups + intended self-resists), plus any damage/engine test touched by scaling; existing `realContent.test.ts` regressions stay green.

## Verification (when built)
- `npx tsc --noEmit`, `npm test`, `npm run build` all clean.
- New `skillRefine` + migration unit tests green; a v1 save loads, gets `skillTiers: {}` / `reagentPoints: 0`, plays normally.
- In battle, the skill menu shows the effectiveness tag vs the current enemy (and, if kept, the effective power post-scale/post-tier).
- Refining a skill in the Menu visibly changes its battle numbers; RP is spent and persisted.
- Regions 1–7 remain completable at plausible levels after the re-tune (BFS + level-sanity regressions green).
