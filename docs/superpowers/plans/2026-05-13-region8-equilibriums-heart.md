# Region 8 "Equilibrium's Heart" Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-05-13-equilibrium-lost-region8-equilibriums-heart.md`.

**Goal:** Ship the finale region `equilibriums-heart` (index 8, topic `equilibrium`), the final boss "The Great Imbalance" (`finalBoss` role), and a game-complete `EndingScene`.

**Architecture:** Pure data-driven region following the established pattern — mirror R7 (`the-crucible`)'s data shapes (tilemap `ground`, NPC dialogue trees, enemy stats) and only change `objects` / content. New scene `EndingScene` (text-only). `applyVictory` widened for `finalBoss`. New `questions/equilibrium.json` bank. Tests added to `realContent.test.ts` + `battleVictory.test.ts`.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest. Content JSON in `src/content/data/`.

**Gates (every commit):** `npx tsc --noEmit` && `npx vitest run`; `npm run build` at the end of each task.

---

### Task 1: `equilibrium` question bank

**Files:** Create `src/content/data/questions/equilibrium.json`; modify `tests/content/realContent.test.ts`.

- [ ] **Step 1:** Read an existing bank for the exact JSON shape — `src/content/data/questions/energy-changes.json` (mcq items) and find a `balanceEquation` item there (or in `balancing-equations.json`) to copy that sub-shape.
- [ ] **Step 2:** Author `src/content/data/questions/equilibrium.json` — a JSON **array** of **64–80** items, ids `eq-001`…, `topic: "equilibrium"`, covering the concepts listed in the spec (reversible ⇌; dynamic equilibrium = equal forward/reverse rates in a closed system, macroscopic properties constant; position of equilibrium & yield-vs-rate; Le Châtelier — concentration, temperature↔exo/endo direction, pressure↔gas-mole counting, catalyst does NOT shift it; Haber/contact process; a colour-change demo; carbonated drinks; a few that fold in rates/energy). Constraints: ≥5 at each difficulty 1/2/3; ≥1 `balanceEquation` item (must balance at lowest integers, coeffs ≤9 — e.g. Haber N₂+H₂→NH₃ → 1,3,2); every item has a non-empty `hint` + a one-line `explanation`; `answerIndex` (mcq) spread ≈ evenly over 0–3 (no B-skew). Year-10 (NSW Stage 5) qualitative depth — no Kc maths.
- [ ] **Step 3:** Verify it loads: `node scripts/check-question-bank.mjs equilibrium` (if the script accepts a not-yet-registered topic) or just `npx vitest run tests/content/contentLoader.test.ts`. Fix any schema issues.
- [ ] **Step 4:** Add to `tests/content/realContent.test.ts` (in the `describe` that has the other per-region bank tests) a test: `'equilibrium question bank has 64–100 questions spanning all three difficulties (with at least one balanceEquation)'` — mirror the `energy-changes` one (`length` in [64,100]; `filter(difficulty===d).length >= 5` for d∈{1,2,3}; `some(format==='balanceEquation')`).
- [ ] **Step 5:** `npx vitest run && npx tsc --noEmit && npm run build` → green. Commit: `feat: equilibrium question bank (Region 8 topic)`.

---

### Task 2: Region data — `equilibriums-heart` (regions / tilemap / NPCs / enemies / manifest) + region tests

**Files:** Modify `src/content/data/regions.json`, `src/content/data/npcs.json`, `src/content/data/enemies.json`, `src/content/data/assetManifest.json`; create `src/content/data/tilemaps/equilibriums-heart.json`; modify `tests/content/realContent.test.ts`.

- [ ] **Step 1: Read the R7 templates** — `regions.json` (the `the-crucible` entry), `tilemaps/the-crucible.json`, the three `the-crucible` NPCs in `npcs.json` (`thermologist-calor` / `forgemaster-pyra` / `shrinekeeper-ember`), the `the-flashpoint` / `the-heat-sink` / `cinderling` entries in `enemies.json`, and the `the_crucible` keys in `assetManifest.json` (`images`, `tilemaps`, `placeholders`). Match these shapes exactly.
- [ ] **Step 2: `tilemaps/equilibriums-heart.json`** — `width:24, height:18, tileSize:16`; copy R7's `ground` array **verbatim**; author a fresh `objects` array per the spec: `player_spawn` (bottom area), `exit` (`to:"world"`, just below spawn), three `npc` objects (`equilibrist-lethe`, `warden-haldane`, `shrinekeeper-cyra`) with `equilibrist-lethe` reachable from `player_spawn` **before** the mini-boss (south of the chokepoint), one `shrine_entrance` (`regionId:"equilibriums-heart"`) near the shrinekeeper, `minibossTrigger` (`enemyId:"the-forward-drift"`, `flag:"miniboss_equilibriums-heart_done"`), `bossGate` (`enemyId:"the-great-imbalance"`, `requiresFlag:"miniboss_equilibriums-heart_done"`). Using R7's exact object coordinates as the starting layout is fine — just keep the reachability constraint (the `realContent` BFS will fail otherwise).
- [ ] **Step 3: `regions.json`** — add the R8 entry: `id:"equilibriums-heart"`, `index:8`, `name:"Equilibrium's Heart"`, `topic:"equilibrium"`, `tilemapKey:"tilemap_equilibriums_heart"`, `tilesetKey:"tiles_equilibriums_heart"`, `battleBackgroundKey:"bg_battle_equilibriums_heart"`, `wildEnemyIds:["flux-wisp","tilted-scale","reverse-eddy","closed-vessel"]`, `encounterRatePerStep:0.1`, `miniBossId:"the-forward-drift"`, `regionBossId:"the-great-imbalance"`, `npcIds:["equilibrist-lethe","warden-haldane","shrinekeeper-cyra"]`, `shrine:{questionTopic:"equilibrium",questionCount:6,passRatio:0.8333,rewardXp:1600,rewardItemIds:["reagent","isotope-core"]}`, `unlocksRegionId:null`, `bossReward:{xp:1800,itemIds:["reagent","reagent","isotope-core"]}` (no `skillId` key). **Also edit the existing `the-crucible` entry: `unlocksRegionId: null` → `"equilibriums-heart"`.** (Confirm `reagent` / `isotope-core` are valid item ids in `items.json` — they're used by R7's reward; if not, use whatever R7 uses.)
- [ ] **Step 4: `npcs.json`** — add three entries (object-keyed by id), matching R7's NPC structure (multi-node `dialogue`, every branch terminal):
  - `equilibrist-lethe` (`spriteKey:"npc_equilibrist_lethe"`, tile = the npc object's coords, sensible `facing`) — the lesson NPC: a "walk me through it / I already know it" choice like R7's Calor; teach reversible reactions/⇌, dynamic equilibrium (equal rates, closed system, both directions ongoing), Le Châtelier (concentration / temp↔exo-endo / pressure↔gas moles / catalyst doesn't shift it), examples (Haber, contact process, fizzy drinks). **One of its dialogue nodes (the skip branch and/or the lesson's last node) MUST have `setFlag:"lesson_equilibrium_seen"`.**
  - `warden-haldane` (`npc_warden_haldane`) — flavour + strategy hint about The Great Imbalance being Catalyst-affinity (no matchup helps; bring refined skills, keep the chain, save Reagents).
  - `shrinekeeper-cyra` (`npc_shrinekeeper_cyra`) — the Heart Shrine, 6 questions on equilibrium, one miss forgiven; on enter: `setFlag:"shrine_entered_equilibriums-heart"`, `launch:"shrine"`, `end:true`. Mirror R7's `shrinekeeper-ember` exactly (s0 / s_enter / s_later structure).
- [ ] **Step 5: `enemies.json`** — add (mirror existing enemy shape):
  - 4 wilds — `flux-wisp` (Synthesis), `tilted-scale` (Decomposition), `reverse-eddy` (Exothermic), `closed-vessel` (Ionic); level 28–31; `baseStats` ≈ R7 wilds scaled up (hp ~46–60, atk ~14–18, def ~8–11, spd ~14–18 — keep them in R7's ballpark, just a touch higher); `attackPower` ~30–34; `skillIds` 1–2 from the existing skill pool matching the affinity (e.g. Synthesis→`synthesis-fuse`; Decomposition→`decompose` or `shell-shatter`; Exothermic→`exothermic-burst` or `thermal-vent`; Ionic→`ionic-bond`); `xpYield` ~170–210; `role:"wild"`; `spriteKey:"enemy_<id>"`.
  - `the-forward-drift` — `role:"miniBoss"`, affinity `Synthesis`, level ~31, `baseStats:{hp:~250,atk:~30,def:~20,spd:~16}`, `attackPower:~40`, `skillIds:["synthesis-fuse","equilibrate"]`, `xpYield:~480`, `spriteKey:"enemy_forward_drift"`, `bossSoftScale:false`, `name:"The Forward Drift"`.
  - `the-great-imbalance` — `role:"finalBoss"`, affinity `Catalyst`, level ~34, `baseStats:{hp:~560,atk:~40,def:~24,spd:~17}`, `attackPower:~46`, `skillIds:["equilibrate","lattice-collapse","mass-strike","thermal-vent"]` (varied; includes a buff-strip), `xpYield:~900`, `spriteKey:"enemy_great_imbalance"`, `bossSoftScale:true`, `name:"The Great Imbalance"`. (No `splitIntoId`, no `teachesSkillId`.)
- [ ] **Step 6: `assetManifest.json`** — `images`: add `tiles_equilibriums_heart` → `assets/images/tiles_equilibriums_heart.png`, `bg_battle_equilibriums_heart` → `assets/images/bg_battle_equilibriums_heart.png`. `tilemaps`: add `tilemap_equilibriums_heart` → `src/content/data/tilemaps/equilibriums-heart.json`. `placeholders`: add an entry for every new sprite/asset key (the 6 new `enemy_*`, the 3 new `npc_*`, and `tiles_equilibriums_heart` / `bg_battle_equilibriums_heart` if R7's tiles/bg have placeholder entries) — mirror R7's placeholder convention exactly (sizes/colours/single-letter labels; enemies ~64×64, NPCs ~64×96, tiles/bg whatever R7 uses).
- [ ] **Step 7: tests** — in `tests/content/realContent.test.ts`: (a) import the new tilemap (`import equilibriumsHeart from '../../src/content/data/tilemaps/equilibriums-heart.json'` — match how `theCrucible` is imported) and add `'equilibriums-heart': equilibriumsHeart as AuditTilemap` to the `maps` record in the tilemap-audit `it`; (b) add an R8 block mirroring R7's: `'Region 8 (equilibriums-heart) exists, index 8, topic "equilibrium", with a valid mini-boss and region boss; Region 7 unlocks it'` (assert `r8.id`, `r8.topic`, `enemies[r8.miniBossId].role==='miniBoss'`, `enemies[r8.regionBossId].role==='finalBoss'`, and `r7.unlocksRegionId==='equilibriums-heart'`) and `'the equilibriums-heart tilemap parses to a 24×18 grid with the expected interactive objects'` (mirror R7's: width/height/ground dims, `types` contains the 5 interactive types, `npc` count === 3).
- [ ] **Step 8:** `npx vitest run && npx tsc --noEmit && npm run build` → green (the generic per-region loops + the new tests). Fix any reachability/dialogue/manifest failures. Commit: `feat: Region 8 — Equilibrium's Heart (region data, tilemap, NPCs, enemies, manifest)`.

---

### Task 3: `applyVictory` handles the `finalBoss` role

**Files:** Modify `src/scenes/battleVictory.ts`; modify `tests/scenes/battleVictory.test.ts`.

- [ ] **Step 1: Write the failing test** — in `tests/scenes/battleVictory.test.ts`, add:
```ts
it('a final-boss win clears the region, sets game_complete, and grants the boss reward + RP', () => {
  const save = SaveManager.newGame('pyron', content);
  const protium = content.enemies['protium']!;
  const finalDef = { ...protium, role: 'finalBoss' as const, xpYield: 50 };
  const { save: after, banners } = applyVictory(save, finalDef, region1, 0, content);
  expect(after.regionProgress[region1.id]!.bossDefeated).toBe(true);
  expect(after.storyFlags['game_complete']).toBe(true);
  expect(after.reagentPoints).toBe(RP_AWARDS.finalBoss);
  expect(banners.some(b => /Æquor is saved|Equilibrium is whole/i.test(b))).toBe(true);
});
```
- [ ] **Step 2:** Run it → FAIL (`bossDefeated` not set for finalBoss; no `game_complete`).
- [ ] **Step 3:** In `applyVictory`, widen the region-boss branch: change `} else if (enemyDef.role === 'regionBoss') {` to `} else if (enemyDef.role === 'regionBoss' || enemyDef.role === 'finalBoss') {` (the body — `rp.bossDefeated = true`, the `equilibrium_restored_*` flag, the bossReward award loop, the `learn(region.bossReward.skillId,...)` guarded by `if (region.bossReward.skillId)`, the "Equilibrium restored to …" banner — all stays). Then immediately after that block add:
```ts
  if (enemyDef.role === 'finalBoss') {
    s.storyFlags['game_complete'] = true;
    banners.push('Equilibrium is whole again. Æquor is saved.');
  }
```
  (The existing `RP_AWARDS.finalBoss` award already fires for `role === 'finalBoss'` — no change needed there. Leave the evolution check after.)
- [ ] **Step 4:** Run `npx vitest run` → green (the new test + all existing). `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `feat: applyVictory treats finalBoss as a region boss + sets game_complete`.

---

### Task 4: `EndingScene` + wiring

**Files:** Create `src/scenes/EndingScene.ts`; modify `src/main.ts`; modify `src/scenes/BattleScene.ts`.

- [ ] **Step 1: Read** `src/scenes/TitleScene.ts` (for the simple-full-screen-scene pattern: `W/H/FONT` consts, `create()`, keyboard handler, `this.scene.start`) and the post-victory navigation in `src/scenes/BattleScene.ts` (the line `if (enemyDef?.role === 'regionBoss') this.scene.start('WorldMapScene');`).
- [ ] **Step 2: Create `src/scenes/EndingScene.ts`** — a `Phaser.Scene` with key `'EndingScene'`. In `create()`: dark full-screen bg; a short closing narration (3–5 lines — the imbalance undone, the reversible reactions of Æquor breathing again, the player credited with restoring balance); below it, the player summary read from `this.registry.get('save')` (class/evolution name + `Lv. N` — derive the display name the way `MenuScene.buildStatusTab` does: `evolutionStage===0 ? cls.name : cls.evolutions.find(e=>e.stage===evolutionStage)?.name ?? cls.name`; if `save`/`content` missing, just skip the summary); a large `"— THE END —"` / `"EQUILIBRIUM RESTORED"`; and `"Press Enter to return to the title"`. Wire `keydown-ENTER` (and `SPACE`, and a pointerdown) → `this.scene.start('TitleScene')`; clean up the listeners on `SHUTDOWN` like the other scenes do.
- [ ] **Step 3: `src/main.ts`** — `import { EndingScene } from './scenes/EndingScene';` and add `EndingScene` to the `SCENES` array.
- [ ] **Step 4: `src/scenes/BattleScene.ts`** — replace `if (enemyDef?.role === 'regionBoss') this.scene.start('WorldMapScene');` with:
```ts
    if (enemyDef?.role === 'finalBoss') this.scene.start('EndingScene');
    else if (enemyDef?.role === 'regionBoss') this.scene.start('WorldMapScene');
```
- [ ] **Step 5:** `npx tsc --noEmit && npx vitest run && npm run build` → green. Commit: `feat: EndingScene — game-complete sequence after The Great Imbalance falls`.

---

### Task 5: Final verification

**Files:** none.

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run build` — all pass. Note the test count (was 248).
- [ ] **Step 2:** `git diff main --stat` — only the expected files: `questions/equilibrium.json`, `regions.json`, `tilemaps/equilibriums-heart.json`, `npcs.json`, `enemies.json`, `assetManifest.json`, `battleVictory.ts`, `BattleScene.ts`, `EndingScene.ts`, `main.ts`, `realContent.test.ts`, `battleVictory.test.ts`, plus the spec/plan docs.
- [ ] **Step 3:** Report: gates green, test count, the manual-playtest note (walk R8, beat the boss, see the ending — feel/difficulty not machine-checkable). Hand back for `merge --no-ff` + tag `v0.12.0-region8` + push + deploy watch.

---

## Self-review notes
- **Spec coverage:** new region data → Task 2; finale boss role handling → Task 3; ending → Task 4; question bank → Task 1; tests → Tasks 1,2,3. ✔
- **Order:** Task 1 must land before Task 2's gates (the region data references topic `equilibrium`, which `loadGameContent`/`realContent` will look up). Tasks 3 & 4 are independent of each other and of 2 (different files) but depend on nothing risky — fine to do after 2. Run in the order 1→2→3→4→5.
- **Risk:** Task 2's reachability/dialogue regressions are the likeliest to bite — mirroring R7's tilemap object coords and NPC dialogue structure de-risks both. Task 4 touches `BattleScene.ts` (large file) with a 2-line change only.
- **No new skill / item / affinity** — keeps `skills.json` / `typeChart.json` / `items.json` untouched.
