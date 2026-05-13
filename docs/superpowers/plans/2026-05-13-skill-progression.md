# Skill Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make skills stay relevant as the player levels (auto-scaling), add a "Refine Skills" upgrade screen powered by a new Reagent Points currency (save v2), and fill out the type chart + surface effectiveness in battle so skill choice becomes a real decision.

**Architecture:** A new pure module `src/systems/skillTiers.ts` owns the tuning constants and the two transforms `scaleSkillPower(power, level)` (Pillar A) and `effectiveSkill(skill, tier)` (Pillar B); `computeDamage` calls the first, the battle engine calls the second. A new pure module `src/scenes/skillRefine.ts` (mirrors `loadout.ts`) does the save-mutating buy/preview. Save migration v1→v2 backfills `skillTiers` + `reagentPoints`. `MenuScene` gets a "Refine" tab; `BattleScene`'s skill submenu shows the effective numbers + a super-effective/resisted tag; `applyVictory` and `ChallengeShrineScene` award RP. `typeChart.json` is expanded and the existing `realContent.test.ts` regressions guard playability.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest. Data-driven JSON content in `src/content/data/`. Pure logic in `src/systems/`; render-only scenes in `src/scenes/`.

**Gates (must stay green at every commit):** `npx tsc --noEmit` · `npm test` · `npm run build`.

---

### Task 1: `skillTiers.ts` — tuning constants + the two transforms

**Files:**
- Create: `src/systems/skillTiers.ts`
- Test: `tests/systems/skillTiers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/systems/skillTiers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SCALE_PER_LEVEL, MAX_TIER, REFINE_TIER_COSTS, TIER_DELTA, scaleSkillPower, effectiveSkill } from '../../src/systems/skillTiers';
import type { SkillDef } from '../../src/content/types';

const base: SkillDef = {
  id: 'x', name: 'X', affinity: 'Acid', power: 40, energyCost: 25, topic: 'acids-bases',
  questionDifficulty: 1, accuracy: 100, isSignature: false, isCatalystBurst: false,
  behavior: { applyStatus: { id: 'dissolved', chance: 35, turns: 3, magnitude: 5 } }, description: 'd',
};

describe('skillTiers constants', () => {
  it('exposes the agreed tuning numbers', () => {
    expect(SCALE_PER_LEVEL).toBe(0.04);
    expect(MAX_TIER).toBe(3);
    expect(REFINE_TIER_COSTS).toEqual([20, 40, 70]);
    expect(TIER_DELTA).toEqual({ power: 4, statusChance: 5, energyCost: 2 });
  });
});

describe('scaleSkillPower', () => {
  it('is identity at level 1', () => expect(scaleSkillPower(40, 1)).toBe(40));
  it('is identity at level <= 1 (no negative scaling)', () => expect(scaleSkillPower(40, 0)).toBe(40));
  it('rounds power * (1 + 0.04*(lvl-1))', () => {
    expect(scaleSkillPower(40, 10)).toBe(Math.round(40 * 1.36)); // 54
    expect(scaleSkillPower(40, 20)).toBe(Math.round(40 * 1.76)); // 70
  });
  it('keeps power-0 utility skills at 0', () => expect(scaleSkillPower(0, 25)).toBe(0));
});

describe('effectiveSkill', () => {
  it('returns the same object at tier 0', () => expect(effectiveSkill(base, 0)).toBe(base));
  it('clamps tier into [0, MAX_TIER]', () => {
    expect(effectiveSkill(base, 99).power).toBe(base.power + TIER_DELTA.power * MAX_TIER);
    expect(effectiveSkill(base, -5)).toBe(base);
  });
  it('adds power, raises status chance (cap 100), lowers energy cost (floor 0) per tier', () => {
    const t2 = effectiveSkill(base, 2);
    expect(t2.power).toBe(48);                       // 40 + 4*2
    expect(t2.energyCost).toBe(21);                  // 25 - 2*2
    expect(t2.behavior!.applyStatus!.chance).toBe(45); // 35 + 5*2
    // floors / caps
    const hot = effectiveSkill({ ...base, energyCost: 3, behavior: { applyStatus: { id: 'dissolved', chance: 96, turns: 3, magnitude: 5 } } }, 3);
    expect(hot.energyCost).toBe(0);
    expect(hot.behavior!.applyStatus!.chance).toBe(100);
  });
  it('does not mutate the input skill', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    effectiveSkill(base, 3);
    expect(JSON.parse(JSON.stringify(base))).toEqual(snapshot);
  });
  it('leaves a behavior-less skill without a behavior', () => {
    const { behavior, ...noBehavior } = base; void behavior;
    expect(effectiveSkill(noBehavior as SkillDef, 3).behavior).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/systems/skillTiers.test.ts`
Expected: FAIL — cannot resolve `../../src/systems/skillTiers`.

- [ ] **Step 3: Implement `src/systems/skillTiers.ts`**

```ts
import type { SkillDef } from '../content/types';

/**
 * Skill-progression tuning + the two pure transforms used by the battle math.
 *
 * Pillar A — `scaleSkillPower`: a skill's *effective* power grows ~SCALE_PER_LEVEL per wielder
 * level so old moves stay viable. Applied inside `computeDamage` for non-burst skills only.
 *
 * Pillar B — `effectiveSkill`: applies a bought tier (0..MAX_TIER) to a SkillDef — per tier,
 * +power, +status chance (cap 100), −energy cost (floor 0). Used by the engine when a skill
 * fires, by the Refine screen for previews, and by the battle skill menu for display.
 */
export const SCALE_PER_LEVEL = 0.04;
export const MAX_TIER = 3;
/** RP cost to buy tier 1, then 2, then 3 (index 0 = 0→1). */
export const REFINE_TIER_COSTS: readonly number[] = [20, 40, 70];
/** Uniform per-tier stat deltas. */
export const TIER_DELTA = { power: 4, statusChance: 5, energyCost: 2 } as const;

export function scaleSkillPower(power: number, wielderLevel: number): number {
  if (power <= 0) return power;
  return Math.round(power * (1 + SCALE_PER_LEVEL * Math.max(0, wielderLevel - 1)));
}

export function effectiveSkill(skill: SkillDef, tier: number): SkillDef {
  const t = Math.max(0, Math.min(MAX_TIER, Math.floor(tier)));
  if (t === 0) return skill;
  const next: SkillDef = {
    ...skill,
    power: skill.power + TIER_DELTA.power * t,
    energyCost: Math.max(0, skill.energyCost - TIER_DELTA.energyCost * t),
  };
  if (skill.behavior?.applyStatus) {
    next.behavior = {
      ...skill.behavior,
      applyStatus: { ...skill.behavior.applyStatus, chance: Math.min(100, skill.behavior.applyStatus.chance + TIER_DELTA.statusChance * t) },
    };
  }
  return next;
}

/** Total RP already sunk into a skill at the given tier (sum of the tier costs paid). */
export function rpSpentAtTier(tier: number): number {
  let sum = 0;
  for (let i = 0; i < Math.min(MAX_TIER, Math.max(0, tier)); i++) sum += REFINE_TIER_COSTS[i] ?? 0;
  return sum;
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run tests/systems/skillTiers.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/skillTiers.ts tests/systems/skillTiers.test.ts
git commit -m "feat: skillTiers module — scaling + tier transforms + RP cost constants"
```

---

### Task 2: Pillar A — per-level skill-power scaling inside `computeDamage`

**Files:**
- Modify: `src/systems/battle/damage.ts`
- Test: `tests/systems/computeDamage.test.ts` (existing — update affected assertions)

- [ ] **Step 1: Write/adjust the failing test**

Add to `tests/systems/computeDamage.test.ts`:
```ts
import { scaleSkillPower } from '../../src/systems/skillTiers';
// ...
it('Pillar A: a skill at higher wielder level hits harder than the same skill at level 1', () => {
  const mk = (level: number) => computeDamage({
    attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
    defenderDef: 20, defenderBuffs: {}, power: 40, isSkill: true, skillAffinity: 'Acid',
    typeMult: 1, chain: 0, quizCorrect: true, crit: false, rng: () => 0,
  });
  expect(mk(20)).toBeGreaterThan(mk(1));
});
it('Pillar A: basic attacks and Catalyst Bursts are NOT level-scaled here', () => {
  // a basic attack at level 20 vs level 1 with the same power differs only via levelFactor,
  // not via skill scaling — so it should equal "power, not scaleSkillPower(power)".
  const burst = (level: number) => computeDamage({
    attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
    defenderDef: 20, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid',
    typeMult: 1, chain: 0, quizCorrect: true, crit: false, isCatalystBurst: true, rng: () => 0,
  });
  const skill = (level: number) => computeDamage({
    attacker: { level, atk: 30, def: 20, spd: 20, signatureAffinity: 'Neutral', buffs: {} },
    defenderDef: 20, defenderBuffs: {}, power: 50, isSkill: true, skillAffinity: 'Acid',
    typeMult: 1, chain: 0, quizCorrect: true, crit: false, rng: () => 0,
  });
  // at level 1 they match; at level 20 the non-burst skill is bigger because power is scaled
  expect(burst(1)).toBe(skill(1));
  expect(skill(20)).toBeGreaterThan(burst(20));
  expect(scaleSkillPower(50, 20)).toBeGreaterThan(50);
});
```
Any existing test that asserts an *exact* damage number for a skill at level > 1 must have its expected value recomputed (the skill `power` fed into `base` is now `scaleSkillPower(power, level)`); run the suite to find them.

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/systems/computeDamage.test.ts` → FAIL (the new assertions; possibly some old exact-number ones).

- [ ] **Step 3: Implement the scaling in `damage.ts`**

At the top of `src/systems/battle/damage.ts` add:
```ts
import { scaleSkillPower } from '../skillTiers';
```
In `computeDamage`, immediately after `const effDef = ...` and before computing `base`, replace the `base` line so it uses a scaled power:
```ts
  // Pillar A: a skill's effective power scales with the *attacker's* level. Basic attacks
  // (isSkill=false) and Catalyst Bursts (already huge + chainMult 3.0) are not scaled.
  const scaledPower = (p.isSkill && !p.isCatalystBurst) ? scaleSkillPower(p.power, p.attacker.level) : p.power;
  const base = Math.floor(Math.floor(Math.floor(levelFactor * scaledPower * effAtk / effDef) / 50) + 2);
```
(Leave the rest of `computeDamage` unchanged.)

- [ ] **Step 4: Run the suite — fix any exact-number fallout, expect pass**

Run: `npx vitest run` — update any now-stale exact damage expectations in `computeDamage.test.ts` / `battleEngine.test.ts` to the new values (the change is monotonic and small). Re-run until green. Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/damage.ts tests/
git commit -m "feat: Pillar A — skill power scales with wielder level (not bursts/basics)"
```

---

### Task 3: Save schema v2 — `skillTiers` + `reagentPoints`

**Files:**
- Modify: `src/content/types.ts` (`SaveData`)
- Modify: `src/systems/SaveManager.ts` (`CURRENT_SAVE_VERSION`, migration step, `newGame`, shape checks)
- Test: `tests/systems/saveManager.test.ts` (existing — add v1→v2 cases)

- [ ] **Step 1: Write the failing test**

Add to `tests/systems/saveManager.test.ts`:
```ts
it('newGame seeds skillTiers:{} and reagentPoints:0 at version 2', () => {
  const s = SaveManager.newGame(content.classes[0].id, content);
  expect(s.version).toBe(2);
  expect(s.skillTiers).toEqual({});
  expect(s.reagentPoints).toBe(0);
});

it('migrates a v1 save by backfilling skillTiers / reagentPoints', () => {
  const v1: any = { ...SaveManager.newGame(content.classes[0].id, content), version: 1 };
  delete v1.skillTiers; delete v1.reagentPoints;
  const storage = makeStorage(); // existing helper in this file
  storage.setItem(SAVE_KEY, JSON.stringify(v1));
  const r = SaveManager.load(content, storage);
  expect(r.ok).toBe(true);
  if (r.ok) { expect(r.data.version).toBe(2); expect(r.data.skillTiers).toEqual({}); expect(r.data.reagentPoints).toBe(0); }
});

it('keeps an explicit reagentPoints value through migration', () => {
  const v1: any = { ...SaveManager.newGame(content.classes[0].id, content), version: 1, reagentPoints: 99, skillTiers: { 'acid-splash': 2 } };
  const storage = makeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(v1));
  const r = SaveManager.load(content, storage);
  expect(r.ok && r.data.reagentPoints).toBe(99);
  expect(r.ok && r.data.skillTiers['acid-splash']).toBe(2);
});
```
(Use whatever in-memory storage helper the file already defines; if it imports `SAVE_KEY`, keep that import. The exact helper names may differ — match the file's existing style.)

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/systems/saveManager.test.ts` → FAIL (version is 1; fields missing).

- [ ] **Step 3: Implement**

In `src/content/types.ts`, inside `interface SaveData` (add after `equippedSkillIds`):
```ts
  skillTiers: Record<string, number>;  // skillId -> tier 0..MAX_TIER (absent => 0)
  reagentPoints: number;               // currency spent in the Refine Skills screen
```

In `src/systems/SaveManager.ts`:
- `export const CURRENT_SAVE_VERSION = 2;`
- In `newGame`'s returned object, add `skillTiers: {},` and `reagentPoints: 0,` (next to `unlockedSkillIds` / `equippedSkillIds`).
- Replace the `// Milestone 2 appends:` comment in the `STEPS` array with a real step:
```ts
      ,
      (o) => { // 1 -> 2 : Skill Progression — skill tiers + Reagent Points
        o.skillTiers ??= {};
        o.reagentPoints ??= 0;
        o.version = 2;
      }
```
- In `migrate`'s post-step shape checks, add:
```ts
    if (!isObj(o.skillTiers)) throw new Error('corrupt: bad skillTiers');
    if (typeof o.reagentPoints !== 'number') throw new Error('corrupt: bad reagentPoints');
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run tests/systems/saveManager.test.ts` → PASS. Then `npx tsc --noEmit` (will flag any other place that constructs a `SaveData` literal — there shouldn't be one besides `newGame`, but fix if so).

- [ ] **Step 5: Commit**

```bash
git add src/content/types.ts src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat: save v2 — skillTiers + reagentPoints (migration backfills v1 saves)"
```

---

### Task 4: `skillRefine.ts` — preview + buy a tier (pure, save-mutating)

**Files:**
- Create: `src/scenes/skillRefine.ts`
- Test: `tests/scenes/skillRefine.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/scenes/skillRefine.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGameContent } from '../../src/content/loadGameContent';
import { SaveManager } from '../../src/systems/SaveManager';
import { previewRefine, applyRefine } from '../../src/scenes/skillRefine';
import { MAX_TIER, REFINE_TIER_COSTS } from '../../src/systems/skillTiers';
import type { GameContent, SaveData } from '../../src/content/types';

let content: GameContent; let save: SaveData; let skillId: string;
beforeEach(() => {
  content = loadGameContent();
  save = SaveManager.newGame(content.classes[0].id, content);
  skillId = save.unlockedSkillIds[0];
});

describe('previewRefine', () => {
  it('reports tier 0 / first cost / cannot afford with 0 RP', () => {
    const p = previewRefine(save, skillId, content);
    expect(p.tier).toBe(0);
    expect(p.cost).toBe(REFINE_TIER_COSTS[0]);
    expect(p.canAfford).toBe(false);
    expect(p.atMax).toBe(false);
  });
  it('does not mutate the save', () => {
    const snap = JSON.stringify(save);
    previewRefine(save, skillId, content);
    expect(JSON.stringify(save)).toBe(snap);
  });
  it('reports atMax and null cost at MAX_TIER', () => {
    save.skillTiers[skillId] = MAX_TIER;
    const p = previewRefine(save, skillId, content);
    expect(p.atMax).toBe(true);
    expect(p.cost).toBeNull();
    expect(p.canAfford).toBe(false);
  });
});

describe('applyRefine', () => {
  it('refuses when not enough RP', () => {
    const r = applyRefine(save, skillId, content);
    expect(r.ok).toBe(false);
  });
  it('refuses an unknown skill', () => {
    expect(applyRefine(save, 'no-such-skill', content).ok).toBe(false);
  });
  it('refuses a not-yet-unlocked skill', () => {
    const locked = Object.keys(content.skills).find(id => !save.unlockedSkillIds.includes(id))!;
    save.reagentPoints = 999;
    expect(applyRefine(save, locked, content).ok).toBe(false);
  });
  it('buys a tier, spends the RP, persists the tier on the save', () => {
    save.reagentPoints = 100;
    const r = applyRefine(save, skillId, content);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.tier).toBe(1); expect(r.reagentPoints).toBe(100 - REFINE_TIER_COSTS[0]); }
    expect(save.skillTiers[skillId]).toBe(1);
    expect(save.reagentPoints).toBe(100 - REFINE_TIER_COSTS[0]);
  });
  it('walks 0→1→2→3 then refuses at MAX_TIER, charging the rising costs', () => {
    save.reagentPoints = 1000;
    for (let i = 0; i < MAX_TIER; i++) expect(applyRefine(save, skillId, content).ok).toBe(true);
    expect(save.skillTiers[skillId]).toBe(MAX_TIER);
    expect(save.reagentPoints).toBe(1000 - REFINE_TIER_COSTS.reduce((a, b) => a + b, 0));
    expect(applyRefine(save, skillId, content).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/scenes/skillRefine.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/scenes/skillRefine.ts`**

```ts
import type { GameContent, SaveData } from '../content/types';
import { MAX_TIER, REFINE_TIER_COSTS, TIER_DELTA } from '../systems/skillTiers';

export interface RefinePreview {
  tier: number;              // current tier (0..MAX_TIER)
  atMax: boolean;
  nextTier: number | null;   // null if already at MAX_TIER
  cost: number | null;       // RP cost of the next tier, or null at MAX_TIER
  canAfford: boolean;        // save.reagentPoints >= cost (false at MAX_TIER)
  delta: { power: number; statusChance: number; energyCost: number }; // the per-tier deltas (display only)
}

function currentTier(save: SaveData, skillId: string): number {
  const t = save.skillTiers[skillId] ?? 0;
  return Math.max(0, Math.min(MAX_TIER, Math.floor(t)));
}

/** Pure: never mutates `save`. */
export function previewRefine(save: SaveData, skillId: string, _content: GameContent): RefinePreview {
  const tier = currentTier(save, skillId);
  const atMax = tier >= MAX_TIER;
  const cost = atMax ? null : (REFINE_TIER_COSTS[tier] ?? null);
  return {
    tier,
    atMax,
    nextTier: atMax ? null : tier + 1,
    cost,
    canAfford: cost != null && save.reagentPoints >= cost,
    delta: { power: TIER_DELTA.power, statusChance: TIER_DELTA.statusChance, energyCost: TIER_DELTA.energyCost },
  };
}

/** Validates, then mutates `save` (caller persists via SaveManager). */
export function applyRefine(save: SaveData, skillId: string, content: GameContent):
  | { ok: true; tier: number; reagentPoints: number }
  | { ok: false; reason: string } {
  if (!content.skills[skillId]) return { ok: false, reason: `Unknown skill ${skillId}.` };
  if (!save.unlockedSkillIds.includes(skillId)) return { ok: false, reason: `You haven't learned ${content.skills[skillId].name} yet.` };
  const tier = currentTier(save, skillId);
  if (tier >= MAX_TIER) return { ok: false, reason: `${content.skills[skillId].name} is already fully refined.` };
  const cost = REFINE_TIER_COSTS[tier] ?? 0;
  if (save.reagentPoints < cost) return { ok: false, reason: `Need ${cost} Reagent Points (you have ${save.reagentPoints}).` };
  save.skillTiers[skillId] = tier + 1;
  save.reagentPoints -= cost;
  return { ok: true, tier: tier + 1, reagentPoints: save.reagentPoints };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run tests/scenes/skillRefine.test.ts` → PASS. Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/skillRefine.ts tests/scenes/skillRefine.test.ts
git commit -m "feat: skillRefine — previewRefine / applyRefine (pure, mirrors loadout.ts)"
```

---

### Task 5: Wire skill tiers into the battle engine

**Files:**
- Modify: `src/systems/battle/types.ts` (`Combatant` — add `skillTiers?`)
- Modify: `src/systems/battle/engine.ts` (`PlayerBattleInput`, `createBattle`, `applyAction` skill case)
- Modify: `src/scenes/battlePresenter.ts` (`playerBattleInputFromSave` passes `skillTiers`)
- Test: `tests/systems/battleEngine.test.ts`, `tests/scenes/battlePresenter.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/systems/battleEngine.test.ts` (adapt helper names to the file's existing setup that builds a battle + ctx):
```ts
it('a refined skill costs less energy and hits harder than the same skill at tier 0', () => {
  // build two identical battles, one where the player has tier 3 on the chosen skill
  const skillId = /* an equipped, damaging, quizzed skill id from the test class */ ;
  const run = (tier: number) => {
    const player = makePlayerInput(); // existing helper
    player.skillTiers = { [skillId]: tier };
    const st = createBattle(player, makeEnemyInput(), { rng: () => 0 });
    const energyBefore = st.player.energy;
    const r = applyTurn(st, { kind: 'skill', skillId, quizCorrect: true }, ctx); // existing turn helper
    return { spent: energyBefore - r.state.player.energy, dmg: makeEnemyInput().def /* placeholder */ };
  };
  // Simpler: assert the engine deducts the tiered energy cost.
  const player0 = makePlayerInput(); player0.skillTiers = {};
  const player3 = makePlayerInput(); player3.skillTiers = { [skillId]: 3 };
  // ...drive one skill action each and compare player.energy delta and enemy hp delta...
});
```
Keep this test pragmatic — the key assertions: (a) `PlayerBattleInput` accepts `skillTiers`; (b) firing a skill with tier 3 deducts `effectiveSkill(skill,3).energyCost` (= base − 6, floored 0), not the base cost; (c) the damage dealt with tier 3 ≥ damage with tier 0 for the same skill/rng.

Add to `tests/scenes/battlePresenter.test.ts`:
```ts
it('playerBattleInputFromSave forwards the save\'s skillTiers', () => {
  const save = SaveManager.newGame(content.classes[0].id, content);
  save.skillTiers = { [save.equippedSkillIds[0]]: 2 };
  expect(playerBattleInputFromSave(save, content).skillTiers).toEqual(save.skillTiers);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run tests/systems/battleEngine.test.ts tests/scenes/battlePresenter.test.ts` → FAIL (`skillTiers` not on the types).

- [ ] **Step 3: Implement**

`src/systems/battle/types.ts` — add to the `Combatant` interface:
```ts
  skillTiers?: Record<string, number>;  // player only; enemies are always tier 0
```

`src/systems/battle/engine.ts`:
- `import { effectiveSkill } from '../skillTiers';` (alongside the other imports).
- `PlayerBattleInput`: add `skillTiers?: Record<string, number>;`.
- In `createBattle`, after `playerCombatant.catalystBurstSkillId = player.catalystBurstSkillId;` add `playerCombatant.skillTiers = player.skillTiers;`.
- In `applyAction`, `case 'skill':`, replace `const skill = ctx.getSkill(action.skillId);` with:
```ts
      const rawSkill = ctx.getSkill(action.skillId);
      const skill = effectiveSkill(rawSkill, attacker.skillTiers?.[rawSkill.id] ?? 0);
```
  Everything downstream (`skill.energyCost`, `skill.power`, `skill.behavior.applyStatus.chance`, `skill.topic`, `skill.affinity`, `skill.id`) then uses the tiered values automatically. (`effectiveSkill` preserves `id`/`topic`/`affinity`.)
- The Catalyst Burst case (`resolveBurstSkill`) is unchanged — bursts don't take tiers.

`src/scenes/battlePresenter.ts` — in `playerBattleInputFromSave`'s returned object add:
```ts
    skillTiers: { ...save.skillTiers },
```

- [ ] **Step 4: Run — expect pass; tsc**

Run: `npx vitest run` → all green (adjust any exact-number assertions touched). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/systems/battle/types.ts src/systems/battle/engine.ts src/scenes/battlePresenter.ts tests/
git commit -m "feat: apply skill tiers in battle (engine + battlePresenter)"
```

---

### Task 6: Award Reagent Points on wins and shrine clears

**Files:**
- Modify: `src/scenes/battleVictory.ts` (export `RP_AWARDS`; add RP to `applyVictory`)
- Modify: `src/scenes/ChallengeShrineScene.ts` (grant `RP_AWARDS.shrine` on clear)
- Test: `tests/scenes/battleVictory.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/scenes/battleVictory.test.ts` (the file already builds a `save` + `content` + an `EnemyDef`):
```ts
import { RP_AWARDS } from '../../src/scenes/battleVictory';

it('a wild win grants RP_AWARDS.wild Reagent Points', () => {
  const before = save.reagentPoints; // newGame => 0
  const { save: after } = applyVictory(save, wildEnemyDef, region, 0, content);
  expect(after.reagentPoints).toBe(before + RP_AWARDS.wild);
});
it('a mini-boss win grants RP_AWARDS.miniBoss', () => {
  const { save: after } = applyVictory(save, { ...wildEnemyDef, role: 'miniBoss' }, region, 0, content);
  expect(after.reagentPoints).toBe(RP_AWARDS.miniBoss);
});
it('a region-boss win grants RP_AWARDS.regionBoss', () => {
  const { save: after } = applyVictory(save, { ...wildEnemyDef, role: 'regionBoss' }, region, 0, content);
  expect(after.reagentPoints).toBe(RP_AWARDS.regionBoss);
});
it('a victory banner mentions the Reagent Points gained', () => {
  const { banners } = applyVictory(save, wildEnemyDef, region, 0, content);
  expect(banners.some(b => /Reagent Point/i.test(b))).toBe(true);
});
```
(Use the file's existing fixture names; if it doesn't already have a `wildEnemyDef`, pick any wild enemy from `content.enemies`.)

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run tests/scenes/battleVictory.test.ts` → FAIL (`RP_AWARDS` undefined; `reagentPoints` unchanged).

- [ ] **Step 3: Implement**

`src/scenes/battleVictory.ts`:
- Add near the top (after imports):
```ts
/** Reagent Points awarded per win type — spent in MenuScene's Refine Skills tab. Tune in playtest. */
export const RP_AWARDS = { wild: 2, miniBoss: 8, regionBoss: 15, finalBoss: 15, shrine: 5 } as const;
```
- In `applyVictory`, after the `// Boss clear` block computes `enemyDef.role` (i.e. after the `if (enemyDef.role === 'miniBoss') {...} else if (enemyDef.role === 'regionBoss') {...}` chain, but it's simplest to add right after the XP `award(...)` call), add:
```ts
  // Reagent Points (skill-refine currency)
  const rpGain = enemyDef.role === 'miniBoss' ? RP_AWARDS.miniBoss
    : enemyDef.role === 'regionBoss' ? RP_AWARDS.regionBoss
    : enemyDef.role === 'finalBoss' ? RP_AWARDS.finalBoss
    : RP_AWARDS.wild;
  s.reagentPoints += rpGain;
  banners.push(`+${rpGain} Reagent Points`);
```
  (Place it before the evolution check so the banner ordering reads: XP/levels → teach → boss-clear → RP → evolution. Exact placement isn't load-bearing; just make sure it runs once per call.)

`src/scenes/ChallengeShrineScene.ts` — in the "shrine cleared" reward block (where it already does `addXp(...)` and pushes the rare items), add:
```ts
      this.save.reagentPoints += RP_AWARDS.shrine;
```
and import: `import { RP_AWARDS } from './battleVictory';`. Fold `+${RP_AWARDS.shrine} Reagent Points` into the existing "Shrine cleared!" banner string.

- [ ] **Step 4: Run — expect pass; tsc**

Run: `npx vitest run` → green. `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleVictory.ts src/scenes/ChallengeShrineScene.ts tests/scenes/battleVictory.test.ts
git commit -m "feat: award Reagent Points on battle wins (2/8/15) and shrine clears (5)"
```

---

### Task 7: MenuScene — "Refine" tab

**Files:**
- Modify: `src/scenes/MenuScene.ts`
- Test: `tests/scenes/menuLoadout.test.ts` — only if it imports something exported from MenuScene; otherwise no test (Phaser scene). Add nothing if there's nothing pure to assert.

- [ ] **Step 1: Implement (no new pure logic — `skillRefine.ts` is already covered)**

In `src/scenes/MenuScene.ts`:
- Imports: `import { previewRefine, applyRefine } from './skillRefine';`
- `TABS`: insert `'Refine'` between `'Skills'` and `'Items'`:
```ts
const TABS = ['Skills', 'Refine', 'Items', 'Status', 'Save', 'Settings', 'Quit'] as const;
```
- In `buildTab()`'s `switch`, add `case 'Refine': this.buildRefineTab(); break;`
- Add the builder method (model it on `buildSkillsTab` — header line + one `addRow` per unlocked skill):
```ts
  private buildRefineTab(): void {
    this.addObj(this.add.text(160, 168, `Reagent Points: ${this.save.reagentPoints}  ·  Enter to refine`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
    const skills = this.save.unlockedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const p = previewRefine(this.save, s.id, this.content);
      const row = this.addRow(224 + i * 48, () => this.refine(s.id));
      const tierTag = `T${p.tier}/${/* MAX */ 3}`;
      const label = p.atMax
        ? `${s.name}  [${s.affinity}]  ${tierTag}  — MAX`
        : `${s.name}  [${s.affinity}]  ${tierTag}  →  +${p.delta.power} Pwr / +${p.delta.statusChance}% / −${p.delta.energyCost} EN   (${p.cost} RP)${p.canAfford ? '' : '  ✗'}`;
      row.setData('label', label);
    });
  }
  private refine(skillId: string): void {
    const r = applyRefine(this.save, skillId, this.content);
    if (r.ok) { this.persist(); this.toast(`Refined ${this.content.skills[skillId]?.name ?? skillId} → T${r.tier}.  ${r.reagentPoints} RP left.`); this.buildTab(); }
    else this.toast(r.reason);
  }
```
  (Use the real `MAX_TIER` from `../systems/skillTiers` instead of the literal `3` in `tierTag` — add it to the existing import or a new one.)
- In `activateRow(i)`'s `switch`, add:
```ts
      case 'Refine': { const ids = this.save.unlockedSkillIds.filter(id => this.content.skills[id]); const id = ids[i]; if (id) this.refine(id); break; }
```

- [ ] **Step 2: Verify it compiles and the suite still passes**

Run: `npx tsc --noEmit` && `npx vitest run` && `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MenuScene.ts
git commit -m "feat: MenuScene 'Refine' tab — spend Reagent Points to tier up skills"
```

---

### Task 8: BattleScene skill submenu — show effective Pwr/EN/Tier + super-effective/resisted tag

**Files:**
- Modify: `src/scenes/BattleScene.ts`
- (No new test — Phaser scene; behaviour is covered by `skillTiers`/`typeChart` units.)

- [ ] **Step 1: Implement**

In `src/scenes/BattleScene.ts`:
- Imports: add `import { effectiveSkill, scaleSkillPower, MAX_TIER } from '../systems/skillTiers';` and `import { effectiveness } from '../systems/battle/typeChart';` and `import typeChartData from '../content/data/typeChart.json';` plus `import type { TypeChart } from '../content/types';` (if `TypeChart` isn't already imported).
- Add a small private helper:
```ts
  private effectiveSkillFor(s: SkillDef): SkillDef {
    return effectiveSkill(s, this.save.skillTiers[s.id] ?? 0);
  }
  private skillRowLabel(s: SkillDef, selected: boolean): string {
    const eff = this.effectiveSkillFor(s);
    const tier = this.save.skillTiers[s.id] ?? 0;
    const pwr = scaleSkillPower(eff.power, this.state.player.level);
    const mult = effectiveness(typeChartData as TypeChart, s.affinity, this.state.enemy.affinity);
    const effTag = mult >= 2 ? '  ⚡super-effective!' : mult <= 0.5 && mult > 0 ? '  ½ resisted' : mult === 0 ? '  ✗ no effect' : '';
    const tierTag = tier > 0 ? ` ·T${tier}/${MAX_TIER}` : '';
    const noQuiz = s.topic === null ? '  (no quiz)' : '';
    return `${selected ? '▶' : '  '} ${s.name}  —  ${s.affinity}${effTag} · Pwr ${pwr} · EN ${eff.energyCost}${tierTag}${noQuiz}`;
  }
```
- In `openSkillMenu` (line ~263) replace `const affordable = s.energyCost <= this.state.player.energy;` with `const affordable = this.effectiveSkillFor(s).energyCost <= this.state.player.energy;` and the initial `setText(...)` for each row with `setText(this.skillRowLabel(s, false))`.
- In `refreshSkillMenu` (line ~282–290) replace the loop body with:
```ts
    skills.forEach((s, i) => {
      const affordable = this.effectiveSkillFor(s).energyCost <= this.state.player.energy;
      const sel = i === this.skillIdx;
      this.skillRowButtons[i]?.setText(this.skillRowLabel(s, sel)).setColor(!affordable ? '#566074' : sel ? '#ffd76a' : '#cdd6f4');
    });
```
- In `confirmSkillMenu` (line ~307) replace `if (skill.energyCost > this.state.player.energy)` with `if (this.effectiveSkillFor(skill).energyCost > this.state.player.energy)`.
- Update the `legend` text in `openSkillMenu` to mention the matchup, e.g.: `'Pick a skill — Pwr/EN are after refines · ⚡ = ×2 vs this foe · ½ = resisted'`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` && `npx vitest run` && `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat: battle skill menu shows effective Pwr/EN/Tier + type-matchup tag"
```

---

### Task 9: Pillar C — fill out `typeChart.json`

**Files:**
- Modify: `src/content/data/typeChart.json`
- Test: `tests/systems/typeChart.test.ts` (existing — assert the new matchups + intended self-resists)

- [ ] **Step 1: Write/extend the failing test**

Add to `tests/systems/typeChart.test.ts` (it already imports `effectiveness` and the JSON):
```ts
const M = chart as TypeChart;
it('has the agreed chemistry-flavoured matchups', () => {
  expect(effectiveness(M, 'Acid', 'Metal')).toBe(2);
  expect(effectiveness(M, 'Acid', 'Ionic')).toBe(2);
  expect(effectiveness(M, 'Acid', 'Base')).toBe(0.5);
  expect(effectiveness(M, 'Base', 'Acid')).toBe(2);
  expect(effectiveness(M, 'Base', 'Metal')).toBe(0.5);
  expect(effectiveness(M, 'Base', 'Covalent')).toBe(0.5);
  expect(effectiveness(M, 'Combustion', 'Covalent')).toBe(2);
  expect(effectiveness(M, 'Combustion', 'Decomposition')).toBe(2);
  expect(effectiveness(M, 'Combustion', 'Endothermic')).toBe(0.5);
  expect(effectiveness(M, 'Combustion', 'Metal')).toBe(0.5);
  expect(effectiveness(M, 'Endothermic', 'Exothermic')).toBe(2);
  expect(effectiveness(M, 'Endothermic', 'Combustion')).toBe(2);
  expect(effectiveness(M, 'Exothermic', 'Endothermic')).toBe(2);
  expect(effectiveness(M, 'Exothermic', 'Metal')).toBe(2);
  expect(effectiveness(M, 'Precipitation', 'Ionic')).toBe(2);
  expect(effectiveness(M, 'Precipitation', 'Acid')).toBe(0.5);
  expect(effectiveness(M, 'Synthesis', 'Decomposition')).toBe(2);
  expect(effectiveness(M, 'Synthesis', 'Atomic')).toBe(2);
  expect(effectiveness(M, 'Decomposition', 'Synthesis')).toBe(2);
  expect(effectiveness(M, 'Decomposition', 'Ionic')).toBe(2);
  expect(effectiveness(M, 'Decomposition', 'Metal')).toBe(2);
  expect(effectiveness(M, 'Metal', 'Covalent')).toBe(2);
  expect(effectiveness(M, 'Metal', 'Acid')).toBe(0.5);
  expect(effectiveness(M, 'Covalent', 'Atomic')).toBe(2);
  expect(effectiveness(M, 'Covalent', 'Combustion')).toBe(0.5);
  expect(effectiveness(M, 'Atomic', 'Ionic')).toBe(2);
});
it('keeps the like-vs-like fizzle on the reaction-pair affinities', () => {
  for (const a of ['Endothermic', 'Exothermic', 'Synthesis', 'Decomposition'] as const) expect(effectiveness(M, a, a)).toBe(0.5);
});
it('keeps Catalyst at 0.5 vs every affinity and Neutral at 1 everywhere', () => {
  const all: Affinity[] = ['Neutral','Atomic','Acid','Base','Metal','Ionic','Covalent','Synthesis','Decomposition','Combustion','Exothermic','Endothermic','Catalyst','Precipitation'];
  for (const d of all) { expect(effectiveness(M, 'Catalyst', d)).toBe(0.5); expect(effectiveness(M, 'Neutral', d)).toBe(1); }
});
```
(Import `TypeChart` / `Affinity` from `../../src/content/types` if not already imported.)

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run tests/systems/typeChart.test.ts` → FAIL (most new matchups missing).

- [ ] **Step 3: Implement — overwrite `src/content/data/typeChart.json`**

```json
{
  "Acid":          { "Metal": 2, "Ionic": 2, "Base": 0.5 },
  "Base":          { "Acid": 2, "Metal": 0.5, "Covalent": 0.5 },
  "Combustion":    { "Covalent": 2, "Decomposition": 2, "Endothermic": 0.5, "Metal": 0.5 },
  "Endothermic":   { "Exothermic": 2, "Combustion": 2, "Endothermic": 0.5 },
  "Exothermic":    { "Endothermic": 2, "Metal": 2, "Exothermic": 0.5 },
  "Precipitation": { "Ionic": 2, "Acid": 0.5 },
  "Synthesis":     { "Decomposition": 2, "Atomic": 2, "Synthesis": 0.5 },
  "Decomposition": { "Synthesis": 2, "Ionic": 2, "Metal": 2, "Decomposition": 0.5 },
  "Metal":         { "Covalent": 2, "Acid": 0.5 },
  "Covalent":      { "Atomic": 2, "Combustion": 0.5 },
  "Atomic":        { "Ionic": 2 },
  "Catalyst":      { "Neutral": 0.5, "Atomic": 0.5, "Acid": 0.5, "Base": 0.5, "Metal": 0.5, "Ionic": 0.5, "Covalent": 0.5, "Synthesis": 0.5, "Decomposition": 0.5, "Combustion": 0.5, "Exothermic": 0.5, "Endothermic": 0.5, "Catalyst": 0.5, "Precipitation": 0.5 }
}
```
(Before committing, do one quick chemistry-pedagogy sanity read of the rationale column in the spec — each ×2/×0.5 should map to something a Year-10 student would recognise; tweak a cell only if it's clearly wrong. Don't add cells beyond this shape.)

- [ ] **Step 4: Run — expect pass; full suite**

Run: `npx vitest run tests/systems/typeChart.test.ts` → PASS. Then `npx vitest run` (the engine/AI use the chart — confirm nothing else asserts a now-changed multiplier; update if so). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/content/data/typeChart.json tests/systems/typeChart.test.ts
git commit -m "feat: Pillar C — chemistry-coherent type chart matrix"
```

---

### Task 10: Playability re-check after the rebalance (Pillar A + C fallout)

**Files:**
- Possibly modify: `src/content/data/enemies.json` and/or `src/content/data/tilemaps/<region>.json` (only if a regression demands it)
- Guarded by: `tests/content/realContent.test.ts` (the BFS reachability + level-sanity regressions)

- [ ] **Step 1: Run the full suite + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`.
Expected: green. The "expanded question banks" / orderSteps / region BFS / level-sanity describes in `realContent.test.ts` must all still pass.

- [ ] **Step 2: If — and only if — a region/level-sanity regression fails:**

The likely cause is Pillar A making a boss's `bossSoftScale` math or a region's level pacing slightly off. Fix the *data*, not the test: bump the offending enemy's `level` / `baseStats.hp` / `xpYield` in `enemies.json` (or the boss-gate level expectation in the tilemap) by the smallest amount that makes the regression green again. Re-run `npx vitest run` until clean. If nothing fails, make no data changes.

- [ ] **Step 3: Manual-playtest note (for the human, not blocking)**

Add a one-line note to the PR/branch summary: "Pillar A scales skill power +4%/level and the type chart is now full — wants a quick R1/R6/R7 boss-fight smoke test by a human; the BFS + level-sanity regressions are green but the *feel* isn't machine-checkable."

- [ ] **Step 4: Commit (only if data changed)**

```bash
git add src/content/data/
git commit -m "balance: re-tune enemy data after skill scaling + type-chart fill"
```
(If no data changed, skip this commit.)

---

### Task 11: Final verification + memory

**Files:** none (verification only).

- [ ] **Step 1: Run all gates**

Run: `npx tsc --noEmit && npm test && npm run build` — all must pass. Confirm `npm test` count went up (new `skillTiers` + `skillRefine` + migration + RP + typeChart tests; was 213).

- [ ] **Step 2: Smoke-read the diff**

`git diff main --stat` — sanity-check that only the files listed in the spec's "Touched files" section changed.

- [ ] **Step 3: Hand back to the finishing-a-development-branch flow**

Report: gates green, test count, the manual-playtest note from Task 10 Step 3. The caller (per the user's working style) will `merge --no-ff` into `main`, push, tag (suggest `v0.11.0-skill-progression`), and watch the deploy.

---

## Self-review notes

- **Spec coverage:** Pillar A → Tasks 1–2; save v2 → Task 3; Refine helper → Task 4; tiers-in-battle → Task 5; RP economy → Task 6; Refine UI → Task 7; battle UI surfacing → Task 8; type chart → Task 9; re-tune → Task 10; verification → Task 11. ✔ All spec sections mapped.
- **Type consistency:** `effectiveSkill(skill, tier)` / `scaleSkillPower(power, level)` / `previewRefine` / `applyRefine` / `RP_AWARDS` / `SaveData.skillTiers` / `SaveData.reagentPoints` / `PlayerBattleInput.skillTiers` / `Combatant.skillTiers` — used consistently across tasks. `REFINE_TIER_COSTS` is `readonly number[]` (indexable, sums fine).
- **Placeholders:** the only intentionally-loose step is Task 5's test sketch (the engine test-helper names differ per the existing file) and Task 10 (data nudges are conditional by nature) — both call out exactly what to assert / when to act. No "TODO"/"implement later".
- **YAGNI:** `rpSpentAtTier` is exported for a possible "refund on respec" later — if unused after Task 7, drop it. No respec/refund feature in scope.
