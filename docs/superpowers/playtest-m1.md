# Milestone 1 — playtest log

> **Scope of this run:** Milestone 1 was built end-to-end (Tasks 1–53). The automated gates —
> `npx tsc --noEmit`, `npm test` (139 tests across 19 files), and `npm run build` — are **green**.
> The items below are the spec §9 correctness/robustness checklist. Ones that can be confirmed
> from the engine tests and the build are ticked with a note; the ones that need a hands-on pass
> in `npm run dev` (a real browser, real input, real timing) are left **unchecked — pending a
> manual session**. None of these are believed to be blocked; they just haven't been eyeballed.

## Build / automated state

- [x] `npx tsc --noEmit` — clean.
- [x] `npm test` — 139/139 passing (content schema/loader, battle engine + chain/damage/status/typeChart, progression, quiz, save manager + migration + corruption, dialogue runner, textbox wrap, boot assets, overworld helpers, chain-meter format, battle presenter, battle victory, shrine scoring, menu loadout).
- [x] `npm run build` — `tsc --noEmit` + `vite build` succeed; `dist/index.html` references `/equilibrium-lost/assets/…`; `dist/.nojekyll` present.

## Spec §9 checklist

- [ ] **Region 1 start-to-finish in one sitting** (new game → class select → world map → overworld → 3 NPC lessons → wild battles → Challenge Shrine → mini-boss → The Unstable Isotope → region-complete banner). _(needs a manual run; record actual minutes here)_
- [ ] **Quit mid-way, re-open, Continue → state intact** (level, HP/energy, items, story flags, loadout, settings, overworld position). _Save round-trip, migration, and corruption detection are unit-tested; `persist()` is called on every save-mutating transition. Needs a browser confirm of the full picture._
- [ ] **Wrong answer in battle** → ~30% hit + correction line; **no HP loss, no extra lost turn**; chain resets. _Engine: `quizFizzle` event + `chain → 0` on `quizCorrect === false`, no other effect — covered by `tests/systems/battleEngine.test.ts` / `computeDamage.test.ts`. UI flow needs an eyeball._
- [ ] **Correct answer** → full power; +XP popup; chain ticks up; chain 5 lights BURST; BURST → flash + big hit + guaranteed status + chain reset. _Engine paths tested; the QuizPanel → resolveTurn → animate → ChainMeter flow needs a manual pass._
- [ ] **Type chart reads true** (Base ▸ Acid; Acid ▸ Ionic/Metal; Endothermic ▸ Combustion; Decompose splits Shellfracture into two halves; Precipitate strips a stat boost). _Type-chart + split + strip-buffs are unit-tested; the in-battle presentation (effectiveness tint, `enemySwitch` swap) needs a look._
- [ ] **Status effects behave** (Oxidised drains DEF; Combusting burns each turn; Precipitated → enemy skips; Catalysed → extra action; Dissolved chips HP; Endothermic Chill lowers ATK). _`tests/systems/status.test.ts` covers apply/tick/expire; the status icons in `BattleScene` need a visual confirm._
- [ ] **Evolution fires at the right moment** — Lv 10 **and** Region 1 cleared, not before; cutscene + sprite swap + stat jump + new signature skill. _`checkEvolution` + `applyVictory` are unit-tested (region-boss-win-at-Lv10 path); the cutscene needs a watch._
- [ ] **Adaptive difficulty** — miss the same topic 3× → questions ease to difficulty 1; refresher toast next time in the overworld. _`pickQuestion` eases at `recentMisses >= 2` (tested); `BattleScene.maybeQueueRefresher` queues at `recentMisses === 3` and `OverworldScene` shows it. Needs a manual confirm of the toast._
- [ ] **Study Mode toggle** — hints on questions; chain-meter pressure removed. _`QuizPanel.ask({studyMode})` shows the hint; `BattleScene` hides the ChainMeter and skips `chainChanged` visuals in study mode. Needs a look._
- [ ] **Challenge Shrine** — clearing it grants bonus XP + the rare items; failing is penalty-free and retryable. _`scoreGauntlet` tested; `ChallengeShrineScene` grants `rewardXp` (via `addXp`) + `rewardItemIds` and marks `shrineCleared` only on a pass. Needs a manual run._
- [ ] **Survives a corrupted save** — detected on load, offered a clean restart, never silently wiped. _`SaveManager.load` returns `{ok:false, reason:'corrupt'}` and `TitleScene` surfaces the notice; `New Game` overwrites. Unit-tested; a devtools-corrupt-then-reload confirm is still owed._
- [x] **No crashes from missing/malformed content** — malformed questions are dropped with a console warning (`ContentLoader`, tested in `tests/content/*`); missing asset keys fall back to Phaser's missing-texture (no crash) and `addPlaceholderLabel` no-ops. Shipped content has no missing keys (`tests/content/realContent.test.ts`).

## Notes / Milestone-4 polish backlog

- Missing-asset fallback renders Phaser's checkerboard `__MISSING` texture rather than the spec's magenta box — fine for shipped content (all keys present); consider a magenta fallback generator in `BootScene` if real art lands incrementally.
- Battle log is a single auto-paced text line rather than a typewriter `Textbox` (kept simple to avoid Enter-key contention with the action menu).
- `MenuScene` Skills tab is a single annotated toggle-list rather than two columns (functionally equivalent; validated via `setLoadout`).
- Region 1 shrine `passRatio` was `0.8334` (which mathematically requires 6/6); corrected to `0.8333` so "5 of 6" passes as intended.
