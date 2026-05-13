# Healing Springs + Battle FX Implementation Plan

> Two small independent features, planned together to share one branch. Use superpowers:subagent-driven-development; the two feature subagents can run in **parallel** (different files, no shared state). Steps use `- [ ]` syntax.

**Goal:** (1) A puzzle-gated healing point in every region so the player can restore HP/EN mid-region. (2) Animated, affinity-themed particle effects in battle so skill use feels punchy.

**Architecture:** (1) New `healing_spring` tile-object type + `HealingSpringScene` (mirrors `ChallengeShrineScene`'s structure, but tiny: 3 quick questions, pass = full heal). (2) New `src/scenes/battleFx.ts` exporting `playSkillFx(scene, target, affinity, opts)` using Phaser's built-in particle system; `BattleScene` calls it from its event walker when an `attack` lands, with extras on crit / super-effective.

**Gates (every commit):** `npx tsc --noEmit && npx vitest run`; `npm run build` at the end of each task.

---

## Feature A — Healing Springs

### Task A1: `HealingSpringScene` + the tile-object plumbing

**Files:** Create `src/scenes/HealingSpringScene.ts`; modify `src/main.ts` (register the new scene); modify `src/scenes/OverworldScene.ts` (action prompt + space-key handler for the new object type, plus a coloured-rect placeholder for it).

- [ ] **Step 1:** Read `src/scenes/ChallengeShrineScene.ts` (the shape we're mirroring — small async `runGauntlet`, `quiz.pickQuestion`, `quizPanel.ask`, register-save, scene.start back to OverworldScene). Read `src/scenes/OverworldScene.ts` around line 82 (the `shrine_entrance` colour-glyph entry), line 289 (the action-prompt branch), and line 382 (the space-press handler that launches the shrine) — replicate that *shape* for `healing_spring`.

- [ ] **Step 2: Create `src/scenes/HealingSpringScene.ts`** — Phaser scene key `'HealingSpringScene'`. On `create()`:
  - Read `content`, `save`, `quiz` from the registry (bail to TitleScene if missing).
  - Read `regionId` from `this.scene.settings.data` and look up the region; fail back to WorldMapScene if absent.
  - A small intro banner: `"A healing spring — answer 3 questions on <region topic> to refresh."`
  - **Run 3 questions** at difficulty 1 (the region's topic), using the same `quiz.pickQuestion` / `quizPanel.ask` flow as `ChallengeShrineScene`. Record each answer with `SaveManager.recordQuizResult` (so quizStats stay accurate). **Pass condition:** all 3 correct (`passRatio = 1.0` — keeps healing meaningful but the questions are easy).
  - On pass: `save.currentHp = save.stats.hp; save.currentEnergy = 100;` and banner `"Refreshed — HP and Energy restored!"` in green.
  - On fail (any miss): banner `"The spring runs murky — come back when you've studied."` (no penalty). Player can retry next time.
  - **Always** `registry.set('save', this.save); savePersist();` then `scene.start('OverworldScene', { regionId })`.
  - Mirror `ChallengeShrineScene`'s class structure exactly (same private fields, same banner helper, same `runGauntlet`-style async).

- [ ] **Step 3: Register in `src/main.ts`** — `import { HealingSpringScene } from './scenes/HealingSpringScene';` and add to the `SCENES` array (after `ChallengeShrineScene`).

- [ ] **Step 4: `src/scenes/OverworldScene.ts` wiring:**
  - In the colour/glyph map near `shrine_entrance` (around line 82): add `healing_spring: { color: 0x06d6a0, glyph: '✚' }` (green cross).
  - In the action-prompt switch (around line 289): add a branch for `healing_spring` showing `'Press SPACE to drink from the healing spring'`.
  - In the space-press handler (around line 382, where the shrine branch lives): add a parallel branch that, on `healing_spring`, launches: `this.scene.start('HealingSpringScene', { regionId: this.region.id });`.

- [ ] **Step 5:** `npx tsc --noEmit && npx vitest run` → green (no new tests for the Phaser scene; the tilemap-audit + manifest regressions will catch wiring issues once Task A2 adds the actual objects to tilemaps).

- [ ] **Step 6:** Commit: `feat: HealingSpringScene + overworld plumbing for healing_spring tile objects`.

### Task A2: Place a `healing_spring` object in every region tilemap + test it's reachable

**Files:** Modify all 8 of `src/content/data/tilemaps/<region>.json`; modify `tests/content/realContent.test.ts`.

- [ ] **Step 1:** For each of the 8 region tilemaps (`elemental-reaches`, `bonding-forge`, `reaction-hollow`, `balance-halls`, `catalyst-crags`, `acid-wastes`, `the-crucible`, `equilibriums-heart`), add **one** `healing_spring` object to the `objects` array. Constraints:
  - The tile must be **passable** (a walkable tile — same as where NPCs/`shrine_entrance` sit; the ground value isn't a wall).
  - It must be **reachable from `player_spawn` before the mini-boss is beaten** — i.e. on the same side of the chokepoint as the first NPC and the shrine. Use coords near the spawn / first NPC area. Don't reuse a tile that already has another object.
  - Pick a sensible, *different* coordinate per region so it doesn't read as copy-paste; one tile off from an NPC or the shrine is fine.

- [ ] **Step 2:** Add to `tests/content/realContent.test.ts`, in the per-region tilemap-audit `it`:
```ts
    for (const region of content.regions) {
      const map = maps[region.id];
      // …existing checks…
      // healing_spring: present and reachable before the guardian
      const spring = map.objects.find(o => o.type === 'healing_spring');
      expect(spring, `${region.id} has no healing_spring`).toBeDefined();
      expect(isAdjacentReachable(reachableTilesBeforeGuardian(map), spring!), `${region.id} healing_spring is sealed behind the guardian`).toBe(true);
    }
```
  (The existing `reachableTilesBeforeGuardian` + `isAdjacentReachable` helpers are already in scope of that test — just reuse them.)

  Also extend the R7/R8 "objects" sanity tests (and any other region's similar test) so the `types` array is expected to contain `'healing_spring'` — i.e. add `'healing_spring'` to the `for (const t of [...]) expect(types).toContain(t);` loop in each per-region-tilemap test (R3, R4, R5, R6, R7, R8 — wherever those literal lists appear; search for `expect(types).toContain('player_spawn')` and update each occurrence).

- [ ] **Step 3:** Run `npx vitest run` — expect failures from the new reachability assertion for any region you missed. Fix by adjusting the tilemap coords until all 8 pass. `npx tsc --noEmit && npm run build` clean.

- [ ] **Step 4:** Commit: `feat: place a reachable healing_spring object in every region tilemap`.

---

## Feature B — Battle FX (animated, affinity-themed)

### Task B1: `battleFx.ts` — affinity → particle effect library

**Files:** Create `src/scenes/battleFx.ts` (Phaser-coupled — sits in `scenes/` like `battleVictory.ts` / `battlePresenter.ts`).

- [ ] **Step 1: Create `src/scenes/battleFx.ts`** with this public surface:
```ts
import type Phaser from 'phaser';
import type { Affinity } from '../content/types';

export interface FxOpts {
  /** ×2 super-effective => bigger/longer burst, harder shake. */
  superEffective?: boolean;
  /** crit => extra layer + flash. */
  crit?: boolean;
  /** Catalyst Burst => spectacular variant. */
  isBurst?: boolean;
}

/**
 * Spawn affinity-themed particle effects at a target sprite. Fire-and-forget;
 * the emitter auto-cleans after `lifespan + 200ms`. No state, no return value.
 */
export function playSkillFx(
  scene: Phaser.Scene,
  target: { x: number; y: number; displayWidth: number; displayHeight: number },
  affinity: Affinity,
  opts?: FxOpts
): void { /* impl below */ }
```

- [ ] **Step 2: Implementation.** Each affinity has a palette + emitter config; use Phaser's built-in particle factory. A small dispatch table maps `Affinity` to a config (colours, speed range, lifespan, quantity, spread, gravity, blendMode, "shape" — outward burst vs inward implosion vs spiral vs falling). A texture-less approach: create a tiny circle Graphics, `generateTexture` once per call (cache via a `WeakMap<Phaser.Scene, Record<string, string>>` on the scene's data registry, key = affinity), use it as the emitter's `texture`.

  Palettes (use these exact colours, hex):
  - **Combustion** — outward burst, lifespan 480ms, ~36 particles, colours `[0xff7b00, 0xff3b00, 0xffd166]`, blendMode `ADD`, slight upward gravity bias (sparks rise). Plus a brief radial shockwave: a `scene.add.circle()` that scales 0.2→2.2 with alpha 0.7→0 over 240ms, colour `0xff7b00`.
  - **Acid** — drips falling DOWN + green bubbles rising slightly. Lifespan 600ms, ~28 particles, colours `[0x9ef01a, 0x70e000, 0x38b000]`, gravity Y +160. No additive blend.
  - **Base** — soft outward mist, ~24 particles, colours `[0xb5e2fa, 0xa2d2ff, 0xcdb4db]`, lifespan 520ms, low speed.
  - **Atomic** — radial flash + cyan/white sparks, ~40 particles, colours `[0xffffff, 0x8ecae6, 0x00b4d8]`, blendMode `ADD`, lifespan 380ms. Add a brief white full-screen flash via a `scene.add.rectangle` alpha 0.18→0 over 140ms.
  - **Metal** — heavy outward shards, slower (speed 80–140), gravity Y +120, ~20 particles, colours `[0x9a8c98, 0x4a4e69, 0xc9ada7]`, lifespan 540ms.
  - **Ionic** — yellow electric arcs: ~14 particles, colours `[0xffd60a, 0xffea00, 0xfff3b0]`, blendMode `ADD`, lifespan 320ms, plus 2–3 short Graphics lightning lines (random jagged polylines from off-target to target, alpha 1→0 over 200ms).
  - **Covalent** — purple linked-pair burst, ~22 particles emitted as paired offsets (left+right of target), colours `[0x9d4edd, 0x7b2cbf, 0xc77dff]`, lifespan 500ms.
  - **Synthesis** — INWARD converging light beams: emit at a ring around the target, velocity pointed at center. ~28 particles, colours `[0xffffff, 0xfff3b0, 0xffd166]`, blendMode `ADD`, lifespan 420ms. (Use `moveToX`/`moveToY` on each particle, or compute angle in the emit callback.)
  - **Decomposition** — outward crumbling chunks, ~24 particles, colours `[0x6b4423, 0x8b5a2b, 0xc8b8a0]`, gravity Y +90, lifespan 560ms.
  - **Exothermic** — outward heat wave + a radial scale ring (orange→red, 0.2→2.6 over 300ms, alpha 0.7→0), ~30 particles, colours `[0xff6b35, 0xf95738, 0xfee440]`, blendMode `ADD`.
  - **Endothermic** — INWARD ice shards (same converging trick as Synthesis), ~26 particles, colours `[0x90e0ef, 0x00b4d8, 0xcaf0f8]`, blendMode `ADD`, lifespan 460ms.
  - **Catalyst** — spiraling green motes orbiting target, ~32 particles emitted along a circle each frame with tangential velocity, colours `[0x55a630, 0x80b918, 0xaacc00]`, blendMode `ADD`, lifespan 700ms.
  - **Precipitation** — cyan flecks falling, ~22 particles, gravity Y +220, colours `[0x90e0ef, 0xade8f4, 0xcaf0f8]`, lifespan 600ms.
  - **Neutral** — plain white burst, ~16 particles, colours `[0xffffff, 0xcdd6f4]`, lifespan 360ms — restrained, doesn't compete with affinity skills.

  Modifiers from `opts`:
  - `superEffective`: 1.6× particle quantity, +25% lifespan, +1 radial-shockwave-tier (the radial ring/flash starts at scale 0.2 and grows to 3.0 instead of 2.2), and the caller can also `scene.cameras.main.shake(180, 0.012)` (BattleScene will own that — see Task B2; battleFx itself doesn't shake).
  - `crit`: add a brief 90ms white flash overlay rectangle, alpha 0→0.35→0; +1.3× quantity.
  - `isBurst`: bigger still — 2.0× quantity, +50% lifespan, plus an extra concentric ring matching the affinity colour.

  Auto-cleanup: every Graphics/rectangle/emitter created sets a `scene.time.delayedCall(lifespan + 200, () => obj.destroy())`. The function MUST be safe to call rapid-fire (every skill in a chain) without leaks — verify by inspecting the cleanup paths.

- [ ] **Step 3:** `npx tsc --noEmit` clean. (No unit test — Phaser visual layer.)

- [ ] **Step 4:** Commit: `feat: battleFx — affinity-themed particle effect library`.

### Task B2: Wire `battleFx` into `BattleScene`

**Files:** Modify `src/scenes/BattleScene.ts`.

- [ ] **Step 1: Read** `BattleScene.ts` lines ~520–600 (the `animate(events)` walker, `case 'attack'` and `case 'damage'` branches) and the existing `flashSprite` / `cameras.main.shake` calls.

- [ ] **Step 2: Track the current attack's affinity inside the walker.** Add a local `let currentAffinity: Affinity = 'Neutral'; let currentSide: 'player' | 'enemy' = 'player'; let currentIsBurst = false; let currentSkillId: string | undefined;` at the top of `animate(events)`. In `case 'attack'`: set `currentAffinity = ev.affinity; currentSide = ev.side; currentSkillId = ev.skillId; currentIsBurst = !!ev.skillId && (this.content.skills[ev.skillId]?.isCatalystBurst ?? false);` (keep the existing log narration too).

- [ ] **Step 3: In `case 'damage'`,** *before* (or right alongside) the existing `flashSprite` + `cameras.main.shake` calls, add:
```ts
        const fxTarget = ev.target === 'player' ? this.playerSprite : this.enemySprite;
        playSkillFx(this, fxTarget, currentAffinity, {
          superEffective: ev.effectiveness >= 2,
          crit: ev.crit,
          isBurst: currentIsBurst,
        });
        if (ev.effectiveness >= 2) this.cameras.main.shake(180, 0.012);
```
  Import: `import { playSkillFx } from './battleFx';` and add `Affinity` to the existing types import if needed.

  Existing per-hit shake/flash logic stays; the FX is additive. The `damage` event always fires together with an `attack` event (one per skill cast), and the walker is sequential, so `currentAffinity` is always set before `damage` arrives. (Basic attacks pass `affinity: 'Neutral'` already.)

- [ ] **Step 4: `npx tsc --noEmit && npx vitest run && npm run build`** all green.

- [ ] **Step 5:** Commit: `feat: BattleScene fires affinity-themed FX on every damaging hit`.

---

## Task C — Final verification

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run build` — green. Note the new test count (was 252).
- [ ] **Step 2:** `git diff main --stat` — only the expected files: 8× tilemap, `HealingSpringScene.ts`, `OverworldScene.ts`, `main.ts`, `battleFx.ts`, `BattleScene.ts`, `realContent.test.ts`, plus the plan doc.
- [ ] **Step 3:** Report; then `merge --no-ff` to `main`, tag `v0.13.0-healing-and-battlefx`, push, watch deploy.

---

## Self-review notes
- **Parallelism:** Feature A (healing) and Feature B (battle FX) touch disjoint files. A's tasks (A1, A2) must run sequentially (A2 depends on A1's scene + plumbing); B's tasks (B1, B2) likewise. Across features, they're independent — two parallel sonnet subagents are fine.
- **Scope discipline:** No new currency, no equipment, no music — those are separate milestones. FX is purely additive; healing reuses the quiz infra.
- **Risk:** Tilemap reachability for `healing_spring` is the likeliest gotcha — coords must be on the spawn side of the mini-boss chokepoint. The test added in A2 guards this.
