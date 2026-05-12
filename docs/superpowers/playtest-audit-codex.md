# Equilibrium Lost playtest audit - Codex

Date: 2026-05-12  
Branch: `fix/playthrough-audit`  
Target: local Vite dev server at `http://localhost:5173/equilibrium-lost/` with static/headless follow-up against real content and pure systems.

## Scope note

Browser coverage used a clean Pyron start and exercised title/class select, world map, Region 1 entry, first wild battle, Attack, Skills, quiz right/wrong paths, chain reset, items, run, status icons, reload/Continue, and console monitoring. I did not complete a full live canvas R1 -> R2 boss clear manually; the full R1 -> R2 completion path, tile gates, flags, save/load round trips, shrine scoring, dialogue trees, rewards, and balance were audited with throwaway Vitest/headless simulations plus static tracing. The throwaway sim was deleted before committing.

Screenshots are in `docs/superpowers/playtest-screens-codex/`. Browser console warnings/errors were empty during the observed run.

## Findings

### 1. major - Region 1 first mentor was sealed behind the mini-boss wall - fixed

Area: Region 1 tilemap/content reachability.

Repro: start a new game, choose Pyron, enter The Elemental Reaches, and follow the welcome banner/objective to the bobbing star. In `04-r1-spawn-welcome.png`, Prof. Bohrlin is north of the horizontal wall; a BFS from spawn with the guardian uncleared found no adjacent reachable tile. This makes the first objective impossible before the guardian despite the HUD asking the player to talk to him.

Evidence: pre-fix content had the first Region 1 NPC at tile `(6,5)`, behind row 6. The fixed tilemap now places him at `src/content/data/tilemaps/elemental-reaches.json:28`, matching the NPC metadata at `src/content/data/npcs.json:3`.

Suggested fix: move the first mentor to a reachable southern tile and add a content reachability regression. Done in `c8f9d14 fix(content): make Region 1 mentor reachable`; regression is in `tests/content/realContent.test.ts:133`.

### 2. major - Region 1 lesson flag did not match the HUD/objective flag - fixed

Area: story flags, objective tracker, first-lesson star.

Repro: talk through Prof. Bohrlin's lesson. The overworld objective reads `lesson_${region.topic}_seen`, so Region 1 expects `lesson_atomic-structure_seen`; Bohrlin previously set `lesson_atomic_structure_seen`. Result: the star/objective/welcome state could remain stuck even after reading the lesson.

Evidence: Bohrlin now sets `lesson_atomic-structure_seen` on both branches in `src/content/data/npcs.json:8` and `src/content/data/npcs.json:10`; the overworld accepts the canonical flag and legacy underscore saves in `src/scenes/OverworldScene.ts:424`. Region 2's `lesson_bonding_seen` path is correct in `src/content/data/npcs.json:38`.

Suggested fix: align authored flags with `region.topic`, preserve old saves, and test every shipped first-lesson NPC. Done in `5e643b7 fix(content): align Region 1 lesson flag`; regression is in `tests/content/realContent.test.ts:149`.

### 3. major - Dialogue choices could be skipped or inconsistently confirmed - fixed

Area: NPC dialogue controls.

Repro: on any dialogue node with choices, press Space at the choice list; Space advanced text but did not confirm choices. Also, pressing Enter while the final typewriter page was still revealing could skip the text and immediately select the first choice in the same key event, because `Textbox` and `DialogueScene` both listened to Enter.

Evidence: `Textbox` listens to both Enter and Space in `src/ui/Textbox.ts:70`; `DialogueScene` now listens to both in `src/scenes/DialogueScene.ts:84` and defers confirmation until the choice UI is ready in `src/scenes/DialogueScene.ts:156`.

Suggested fix: route both advertised confirm keys through the dialogue scene and ignore the same key event that caused choices to appear. Done in `a3eba15 fix(dialogue): make choice confirmation consistent`.

### 4. major - Region 2 progression/balance likely leaves players far below the boss level - open

Area: XP curve, rewards, Region 2 boss tuning.

Repro: the headless run applied real rewards through Region 1 shrine, Region 1 mini-boss, Region 1 boss, Region 2 shrine, and Region 2 mini-boss. Fixed rewards before the Region 2 boss total about 1,390 XP, which is only level 5. Adding 10 average Region 1 wilds and 10 average Region 2 wilds reaches about 2,263 XP, level 7. The Region 2 mini-boss is level 11 and the Region 2 boss is level 14.

Evidence: XP is `100 * level` per next level in `src/systems/Progression.ts:5`; level 14 requires 9,100 total XP. Region rewards are modest in `src/content/data/regions.json:10`, `src/content/data/regions.json:12`, `src/content/data/regions.json:22`, and `src/content/data/regions.json:24`. Region 2 enemies are level 5-14 in `src/content/data/enemies.json:9`. Class bonding unlocks at levels 13-16 are therefore technically reachable but not realistically reached before the Region 2 boss without heavy grinding (`src/content/data/classes.json:9`, `src/content/data/classes.json:19`, `src/content/data/classes.json:29`).

Balance read: `bond-mote` itself is a pushover as intended, and I did not find an individual wild enemy that was obviously one-shot trivial or unkillably tanky. The wall is the progression curve versus mandatory/recommended XP. With 20 wild fights, reaching level 14 would still need roughly 6,800 more XP, or well over 100 additional Region 2 wild fights at current yields. Underlevel boss sims at level 5 lost cleanly even with correct quiz answers.

Suggested fix: decide the intended boss-entry level, then either lower Region 2 boss/mini-boss levels, increase shrine/boss/wild XP, add more required pre-boss encounters, or introduce a gentler down-scale for `bossSoftScale` when the player is underleveled. I did not rebalance this because it needs design intent.

### 5. minor - Battle HUD rendered a stray clipped `HP` label at top-left - fixed

Area: battle UI.

Repro: enter a wild battle; `07-r1-attack-turn.png` shows an orphan clipped `HP` at the top-left outside the intended health bar. This was caused by a text object created outside the `HealthBar` container.

Evidence: `HealthBar` now only creates the in-container label at `src/ui/HealthBar.ts:19`.

Suggested fix: remove the unused out-of-container text creation. Done in `55d4bca fix(ui): remove stray battle health label`.

### 6. nit - Title placeholder label has very low contrast - open

Area: title screen placeholder art.

Repro: open the title screen; `01-title.png` shows the center `EQUILIBRIUM LOST` placeholder label as dark text on a dark blue title rectangle. It is barely legible at 1920x1080.

Evidence: placeholder labels are always rendered with `#0b0f17` in `src/ui/placeholderTextures.ts:44`.

Suggested fix: allow per-placeholder label colors, or render `title_art` with a light label color until final title art lands.

### 7. nit - Production build passes with a large chunk warning - open

Area: build output.

Repro: run `npm run build`.

Evidence: Vite reports `dist/assets/index-*.js` at about 1.37 MB and warns that some chunks exceed 500 kB after minification.

Suggested fix: no gameplay fix needed now. Consider code splitting scenes/assets later if initial load becomes a deployed-page issue.

## Confirmed checks

- Region 1 and Region 2 mini-boss/boss-gate flag strings align with `applyVictory`: tilemaps use `miniboss_<region.id>_done` in `src/content/data/tilemaps/elemental-reaches.json:32` and `src/content/data/tilemaps/bonding-forge.json:32`; `applyVictory` writes that in `src/scenes/battleVictory.ts:57`.
- Region boss victory writes `equilibrium_restored_<region.id>`, grants boss reward items, teaches the reward skill, and banners `Equilibrium restored to <region>` in `src/scenes/battleVictory.ts:61`.
- The Bonding Forge gate row is all wall except column 11, with mini-boss at `(11,4)`, sealed north tile `(11,3)`, and boss gate at `(11,2)` in `src/content/data/tilemaps/bonding-forge.json:10` and `src/content/data/tilemaps/bonding-forge.json:32`.
- `canEnter` seals the tile directly north of an uncleared mini-boss trigger in `src/scenes/OverworldScene.ts:278`.
- Forge NPCs and shrine are reachable from spawn before the guardian. The static trace covered Valentia, Octet, Mortar, the shrine, the tall-grass corridors, mini-boss chokepoint, boss gate, and exit.
- Bonding skills map to the expected generic battle behaviors: `ionic-bond` applies Oxidised/DEF drain, `covalent-shell` applies Endothermic Chill/ATK drop, and `lattice-collapse` strips buffs in `src/content/data/skills.json:16`. The generic status/strip behavior is covered in `tests/systems/status.test.ts:27` and `tests/systems/battleEngine.test.ts:128`.
- Every NPC dialogue tree walks to a terminal node down every branch; regression lives in `tests/content/realContent.test.ts:158`.
- Shrine scoring accepts one miss and rejects two misses in the throwaway sim and existing scoring helper path.
- No magenta placeholder/missing-asset boxes were observed in the browser pass.
- Browser console warnings/errors: none observed during the local Vite play.

## Gates

- `npx tsc --noEmit` - passed.
- `npm test` - passed, 19 files / 145 tests.
- `npm run build` - passed; Vite emitted the large chunk warning noted above.

Earlier I ran `tsc`, `npm test`, and `build` in parallel once and Vitest worker startup timed out; rerunning the suite sequentially passed cleanly.

## Fix branch contents

- `c8f9d14 fix(content): make Region 1 mentor reachable`
- `5e643b7 fix(content): align Region 1 lesson flag`
- `55d4bca fix(ui): remove stray battle health label`
- `a3eba15 fix(dialogue): make choice confirmation consistent`

No push to `main` was performed.
