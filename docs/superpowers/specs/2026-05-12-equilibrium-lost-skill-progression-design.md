# Design (draft) — Skill Progression

**Status:** draft. Direction agreed (auto-scaling + a light per-skill upgrade hook + a richer, surfaced type chart); the details below marked **[open]** are to be brainstormed when this milestone is scheduled. Not built yet.

**Why:** playtest feedback — "your personal skills should be upgradable, otherwise you are just choosing the highest attacking skill every time." Two problems hide in that sentence: (1) a skill learned at Lv 3 becomes dead weight by Lv 14, and (2) with the type chart nearly empty there's no *decision* in the skill menu — the highest `power` always wins. This milestone addresses both, without touching the educational core (the chemistry quizzes).

**Where it fits:** its own milestone, or folded into the Milestone-4 balance pass (the M1 plan already earmarks M4 for type-chart and difficulty tuning, which pillar C overlaps). Slot it after Regions 3–4 are content-complete, or earlier if combat starts feeling shallow.

---

## The three pillars

### A. Skill auto-scaling (small, no new systems)

Every skill's *effective* power grows modestly with the wielder's level, so old moves stay viable:

```
effectivePower(skill, wielderLevel) = skill.power + floor(skill.power * SCALE_PER_LEVEL * (wielderLevel - 1))
```

with `SCALE_PER_LEVEL ≈ 0.03–0.05` **[open — tune; also decide whether enemies' skill powers scale the same way they currently soft-scale stats]**. Pure-utility skills (`power === 0`, e.g. `precipitate` carries its value in `stripBuffs`) are unaffected. Catalyst Bursts (`power` already large + `chainMult 3.0`) — decide whether they scale **[open]**.

- **Files:** `src/systems/battle/damage.ts` (the only call site; it already receives the attacker's level via `DamageParams`), `src/systems/battle/engine.ts` (pass `effectivePower` instead of raw `skill.power`). No save changes. No UI changes (though pillar C will *show* the scaled number).
- **Risk:** rebalances every fight slightly — re-check the Region 1 / 2 boss-entry math (the steep `xpToNextLevel = 100*level` curve means players are usually a few levels under the boss, so a +2–4 power bump on their kit is welcome, not breaking).

### B. A light per-skill upgrade hook ("Refine Skills")

Each skill gets a small **tier** (0 → MAX_TIER, e.g. 0–3 **[open]**). Each tier nudges a couple of stats by a uniform per-tier delta **[open — uniform deltas vs. a per-skill table in `skills.json`]**, e.g. per tier: `power += 4`, status `chance += 5` (capped at 100), `energyCost -= 2` (floored at 0). Tiers are bought in a new Menu screen by spending **[open — pick one]**:

- a slow trickle of regular battle XP siphoned into a "Skill XP" pool; **or**
- a dedicated currency ("Reagent Points") dropped by enemies / shrines / bosses; **or**
- an `evolutionMaterial`-style item (reuse the existing `ItemKind`).

The screen lives off the existing **MenuScene** (alongside loadout/items/settings) — a list of equipped (or all-known) skills with current tier, the next tier's preview, and the cost. Reuse the `loadout.ts` pure-helper pattern: a Phaser-free `skillRefine.ts` that, given `(save, skillId)`, returns `{ canAfford, nextTier, deltaPreview }` and applies the purchase — fully unit-tested.

- **Save changes:** `SaveData.skillTiers: Record<string, number>` (defaults `{}` ⇒ tier 0), plus whatever resource pool/material the chosen mechanic needs. Bump `CURRENT_SAVE_VERSION` to 2 and add a migration step (`o.skillTiers ??= {}; …; o.version = 2`) — the migration ladder in `SaveManager.migrate` already has a placeholder comment for exactly this.
- **Files:** `src/content/types.ts` (save shape + maybe `SkillDef` tier fields), `src/systems/SaveManager.ts` (migration), `src/scenes/MenuScene.ts` + `src/scenes/skillRefine.ts` (new) + `src/scenes/loadout.ts` (show effective power/tier in the loadout), `src/scenes/battleVictory.ts` (award the skill-progress resource on win), `src/systems/battle/engine.ts` (apply tier deltas when building a skill action), maybe `src/content/data/skills.json` (per-skill tier tables) or a new `src/content/data/skillTiers.json`, plus tests for `skillRefine` and the migration.

### C. Richer type chart, surfaced in battle (overlaps M4)

Fill out `typeChart.json` into a coherent chemistry-flavoured matrix so the *right* skill depends on the enemy's affinity — e.g. `Acid → Metal/Ionic = ×2` (already there); add `Base → Metal = ½`, `Synthesis ↔ Decomposition`, `Combustion → Covalent = ×2` (combustion breaks covalent fuel), `Endothermic ↔ Exothermic`, `Precipitation → Ionic = ×2`, `Metal → Covalent = ½`, etc. **[open — the actual matrix needs a chemistry-pedagogy pass so the matchups *teach* something rather than being arbitrary; do this with the same care as the question banks.]**

Then **show** it: in `BattleScene`'s skill submenu, pass the current enemy's affinity to the row renderer and tag each skill with `×2 super-effective! / ½ not very… / —` (the `effectiveness()` helper already exists in `src/systems/battle/typeChart.ts`). That single change is what turns "pick the biggest number" into a real decision.

- **Files:** `src/content/data/typeChart.json` (the matrix), `src/scenes/BattleScene.ts` (`refreshSkillMenu` shows the matchup vs `this.state.enemy.affinity`), maybe `src/scenes/battlePresenter.ts`, and `tests/systems/typeChart.test.ts` (assert the new matchups; sanity-check symmetry where intended).
- **Risk:** changes every fight's effectiveness profile — bundle the boss/wild-difficulty re-tune here (this is the M4 work) so it's done once, coherently.

---

## Out of scope

- New affinities or new skills beyond what's needed to make the chart coherent.
- Per-class signature-line reworks; the **evolution** system already gives a stronger signature skill per evolution and stays as-is.
- A general balance overhaul of stats/XP beyond what pillars A and C force a re-check of.
- Multiplayer/anything not single-player.

## Open questions (brainstorm these when scheduled)

1. `SCALE_PER_LEVEL` value; do enemy skill powers scale too; do Catalyst Bursts scale.
2. `MAX_TIER`; uniform per-tier deltas vs. a per-skill table; which stats a tier touches (power / status chance / energy cost / accuracy).
3. The upgrade resource: siphoned XP vs. a new currency vs. an evolution-material item — and how generously it's awarded (battles? shrines? bosses?).
4. Whether the skill-tier pool is shared across all of a class's skills or capped per skill / per evolution stage.
5. The full type-chart matrix — needs a deliberate "what does this matchup *teach*" pass.
6. Save migration shape (likely `version 2`: `skillTiers` + resource pool) and back-compat with v1 saves.
7. Whether to do A + C now (low-risk, no save changes) and B as a follow-up, or all three together.

## Verification (when built)

- New `skillRefine` + migration unit tests green; `tsc`/`npm test`/`npm run build` clean.
- A v1 save loads, gets `skillTiers: {}`, plays normally.
- In battle, the skill menu shows effective power (post-scale, post-tier) and the matchup tag vs the current enemy; refining a skill in the Menu visibly changes its battle numbers.
- Region 1 / 2 stay completable at plausible levels after the re-tune.
