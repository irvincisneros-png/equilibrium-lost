# Design — Region 8: "Equilibrium's Heart" (the finale)

**Status:** approved (autonomous build, 2026-05-13 — user out, "do everything on your recommendation"). The capstone region + final boss **"The Great Imbalance"** + a **game-complete ending**. Follows the established region pattern (24×18 grid, mirror R7's `ground`, new `objects`) — lower-risk than inventing a new finale layout for an unattended build.

**Why:** the world map has shown a locked **"Equilibrium's Heart"** node since launch; R7 (`the-crucible`) has `unlocksRegionId: null` — the chain ends nowhere. This closes it: the player's journey through atomic structure → bonding → reactions → balancing → rates → acids/bases → energy changes culminates in **equilibrium** (reversible reactions ⇌, dynamic equilibrium, Le Châtelier's principle) — the Year-10 topic that *names the game* and *is* the synthesis of rates + energy + concentration. Beat "The Great Imbalance", restore equilibrium to Æquor, see the ending.

**Builds on the just-shipped Skill Progression milestone** — the boss is tuned assuming the player has refined skills, the full type chart, and per-level scaling. "The Great Imbalance" is **`Catalyst` affinity** (×1 vs everything in the new chart — no type-cheese either way): the finale is won on a refined kit + chains + items + the chemistry quizzes, which is the right capstone.

---

## New region — `equilibriums-heart`

- `id: "equilibriums-heart"`, `index: 8`, `name: "Equilibrium's Heart"`, `topic: "equilibrium"`.
- `tilemapKey: "tilemap_equilibriums_heart"`, `tilesetKey: "tiles_equilibriums_heart"`, `battleBackgroundKey: "bg_battle_equilibriums_heart"` (manifest entries added; no real PNGs — BootScene's coloured-rect fallback covers them, same as R4–R7 sprites).
- `wildEnemyIds`: 4 new wilds (see below). `encounterRatePerStep: 0.1`.
- `miniBossId: "the-forward-drift"`, `regionBossId: "the-great-imbalance"`.
- `npcIds: ["equilibrist-lethe", "warden-haldane", "shrinekeeper-cyra"]` (lesson NPC first, then a flavour/strategy NPC, then the shrinekeeper — mirrors R7's trio).
- `shrine: { questionTopic: "equilibrium", questionCount: 6, passRatio: 0.8333, rewardXp: 1600, rewardItemIds: ["reagent", "isotope-core"] }` (slightly above R7's 1300).
- `unlocksRegionId: null` (end of the chain).
- `bossReward: { xp: 1800, itemIds: ["reagent", "reagent", "isotope-core"] }` — **no `skillId`** (no new skill = no skills.json / type-chart churn; the reward is XP + a chunk of Reagent Points from `applyVictory`'s `finalBoss` award (15) + items).
- **`the-crucible` (R7) is edited:** `unlocksRegionId: null → "equilibriums-heart"` so R8 actually unlocks when the Heat Sink falls. (Mirrors how every region unlocks the next.)

## Tilemap — `src/content/data/tilemaps/equilibriums-heart.json`

24×18, `tileSize: 16`. **Reuse R7's `the-crucible.json` `ground` grid verbatim** (it's the proven walkable layout the BFS regression validates). Author a fresh `objects` array:
- `player_spawn` near the bottom; `exit` (`to: "world"`) just below it.
- The first NPC (`equilibrist-lethe`, `npcIds[0]`) on a tile **reachable from `player_spawn` before the mini-boss is beaten** (the BFS regression `reachableTilesBeforeGuardian` checks this — keep it south of the `minibossTrigger` chokepoint).
- `npc` ×3 (the three npcIds), `shrine_entrance` (`regionId: "equilibriums-heart"`) near the shrinekeeper.
- `minibossTrigger` (`enemyId: "the-forward-drift"`, `flag: "miniboss_equilibriums-heart_done"` — hyphenated id, matches `battleVictory.ts`'s `miniboss_${region.id}_done`).
- `bossGate` (`enemyId: "the-great-imbalance"`, `requiresFlag: "miniboss_equilibriums-heart_done"`).
- (Use R7's object coordinates as a starting template; the only hard constraints are the two above + a clear path spawn→firstNPC→shrine and spawn→minibossTrigger.)

## NPCs — added to `src/content/data/npcs.json`

Three new entries (object-keyed by id, like the rest). Match R7's tone & length (multi-node `dialogue` arrays, every branch reaching a terminal node — the dialogue-walkability regression checks this).
- **`equilibrist-lethe`** (sprite `npc_equilibrist_lethe`) — the **lesson NPC**. A "walk me through it / I already know it" branch like R7's Calor. Teaches: reversible reactions and the ⇌ symbol; *dynamic* equilibrium = forward and reverse rates equal (not "stopped" — both still happening), only in a *closed* system; Le Châtelier: a change in concentration / temperature / pressure shifts the position of equilibrium to *partially oppose* the change (add reactant → shifts right; raise temp → shifts in the *endothermic* direction; raise pressure → shifts to the side with *fewer gas moles*); examples — the Haber process (N₂ + 3H₂ ⇌ 2NH₃), the contact process, fizzy-drink CO₂. **The skip branch (and/or the end of the lesson branch) must include `setFlag: "lesson_equilibrium_seen"`** — the overworld objective + the `realContent` regression read exactly `lesson_${region.topic}_seen`.
- **`warden-haldane`** (sprite `npc_warden_haldane`) — flavour + a combat-strategy hint: "The Great Imbalance answers to no element — it's the Catalyst that tipped the scales. No matchup will save you; bring refined skills, keep your chain alive, and don't waste your Reagents." (ties the finale to the Skill Progression systems).
- **`shrinekeeper-cyra`** (sprite `npc_shrinekeeper_cyra`) — the Heart Shrine: 6 questions on equilibrium, one miss forgiven; `setFlag: "shrine_entered_equilibriums-heart"`, `launch: "shrine"` on enter. Mirror R7's Ember Shrine NPC structure exactly.

## Enemies — added to `src/content/data/enemies.json`

XP curve is steep (`xpToNextLevel = 100*level`) — set levels/rewards so a player who cleared R7 (~Lv 27–30) can plausibly reach the boss's level. New entries (mirror existing enemy shape; `bossSoftScale` only on the bosses):
- **4 wilds**, levels ~28–31, affinities spread across the chart so the player's varied/refined kit matters (e.g. one `Synthesis`, one `Decomposition`, one `Exothermic`, one `Ionic`), `skillIds` drawn from the *existing* skill pool, `xpYield` ~170–210 each, `spriteKey: enemy_<id>`, `role: "wild"`. Suggested ids: `flux-wisp`, `tilted-scale`, `reverse-eddy`, `closed-vessel`.
- **`the-forward-drift`** — mini-boss, `role: "miniBoss"`, affinity `Synthesis` (so `Decomposition`-affinity player skills like `decompose`/`lattice-collapse` are ×2 — rewards the type chart), level ~31, `baseStats` in the ballpark of R7's Flashpoint scaled up (hp ~250, atk ~30, def ~20, spd ~16), `attackPower` ~40, `skillIds` 2 themed picks (e.g. `synthesis-fuse`, `equilibrate`), `xpYield` ~480, `bossSoftScale: false`. Name: "The Forward Drift" (equilibrium shoved one way).
- **`the-great-imbalance`** — **`role: "finalBoss"`**, affinity `Catalyst`, level ~34, beefy `baseStats` (hp ~560, atk ~40, def ~24, spd ~17), `attackPower` ~46, `skillIds` a varied 3–4 (e.g. `equilibrate`, `precipitate`/`lattice-collapse` for buff-strip pressure, `mass-strike`, `thermal-vent`), `xpYield` ~900, `bossSoftScale: true` (scales *up* to the player's level if they over-grind, never down). Name: "The Great Imbalance". Optionally `splitIntoId` is **not** used here (keep the finale a straight duel). `battleBackgroundKey` defaults to the region's.

## `applyVictory` — handle the `finalBoss` role

`src/scenes/battleVictory.ts` currently only branches on `'miniBoss'` / `'regionBoss'`. Change so `'finalBoss'` is treated like a region boss **plus** sets the completion flag:
- In the boss-clear block: `if (enemyDef.role === 'regionBoss' || enemyDef.role === 'finalBoss') { rp.bossDefeated = true; s.storyFlags[`equilibrium_restored_${region.id}`] = true; <award bossReward.xp/items/skill>; banners.push(`Equilibrium restored to ${region.name}!`); }` — i.e. just widen the existing `else if` condition.
- Additionally: `if (enemyDef.role === 'finalBoss') { s.storyFlags['game_complete'] = true; banners.push('Equilibrium is whole again. Æquor is saved.'); }`
- The existing `finalBoss` Reagent-Point award (15, already in `RP_AWARDS`) is unchanged. Evolution check still runs last (a player could hit a level evolution on the final kill — fine).

## Ending — new `EndingScene`

A small Phaser scene `src/scenes/EndingScene.ts` (model the layout on `TitleScene` / the existing simple full-screen scenes):
- Shown from `BattleScene` after a `finalBoss` victory: in the post-victory navigation (currently `if (enemyDef?.role === 'regionBoss') this.scene.start('WorldMapScene');`), add **`if (enemyDef?.role === 'finalBoss') this.scene.start('EndingScene'); else if (regionBoss) → WorldMapScene`** (keep regionBoss behaviour intact).
- Content: a short closing narration (3–5 lines — the imbalance is undone, the reversible reactions of Æquor breathe again, the player named as the one who restored balance), the player's final summary (class/evolution name + `Lv. N`), a big "THE END" / "EQUILIBRIUM RESTORED", and "Press Enter to return to the title". On Enter (or Space/click): `this.scene.start('TitleScene')`. Reads `save` from the registry for the summary; if absent, just show the narration. Pure-text, no new assets.
- Register `EndingScene` in `src/main.ts`'s `SCENES` array (import + add to the list).

## Assets / manifest

`src/content/data/assetManifest.json`:
- `images`: add `tiles_equilibriums_heart` → `assets/images/tiles_equilibriums_heart.png` and `bg_battle_equilibriums_heart` → `assets/images/bg_battle_equilibriums_heart.png` (mirror R7's entries — no real PNG needed; fallback handles it).
- `tilemaps`: add `tilemap_equilibriums_heart` → `src/content/data/tilemaps/equilibriums-heart.json`.
- `placeholders`: add coloured-rect placeholder entries for every new sprite key (the 4 wilds' `enemy_*`, the two bosses' `enemy_*`, the 3 NPCs' `npc_*`) — mirror the shape/size/colour convention of R7's placeholder entries (enemies ~`64×64`, NPCs ~`64×96`, a single-letter label). The `tiles_*` / `bg_battle_*` keys likely also want placeholder entries — check how R7's are done and match.

## Question bank — `src/content/data/questions/equilibrium.json`

A new bank, **~64–80 questions** (the finale topic; this is also the only place `equilibrium` questions surface — the R8 Challenge Shrine and the lesson NPC; no in-battle skill has `topic: "equilibrium"`). Same JSON shape as the other banks: array of `{ id: "eq-NNN", topic: "equilibrium", difficulty: 1|2|3, format: "mcq" | "balanceEquation", prompt, options[4] (mcq) | (balanceEquation has its equation fields like the existing balanceEquation items in other banks), answerIndex (mcq), explanation (one line), hint (non-empty) }`. Constraints:
- ≥ 5 questions at each of difficulty 1, 2, 3; total in [64, 100].
- At least one `balanceEquation` item (mirror the format used by `balanceEquation` items in `energy-changes.json` / `balancing-equations.json` — e.g. the Haber synthesis `N2 + H2 → NH3` balancing to `1,3,2`, or the contact process). It must balance at lowest integers, coefficients ≤ 9.
- `answerIndex` spread roughly evenly across 0–3 (no B-skew — the existing banks fixed this; match it).
- Concepts to cover: the ⇌ symbol & meaning of reversible; "dynamic" equilibrium (rates equal, both directions ongoing, closed system, macroscopic properties constant); position of equilibrium (left/right, yield vs rate trade-off); Le Châtelier — effect of changing concentration, temperature (link to exo/endo direction), pressure/volume (gas-mole counting), and that a *catalyst* speeds both directions equally so does **not** shift the position; worked examples (Haber, contact process, the chromate/dichromate or cobalt-complex colour change, carbonated drinks, the iron/SCN demo if level-appropriate); plus a few that fold in prior topics (rates → "how fast equilibrium is reached" vs "where it lies"; energy → which way a temp rise pushes it). Keep everything at Year-10 (NSW Stage 5) depth — qualitative, no Kc maths.

## Out of scope
- New playable skills, new affinities, new item kinds, real PNG art (placeholder fallback is fine).
- A credits roll of contributors / save-game "New Game+" / post-ending content.
- Re-tuning Regions 1–7 (Skill Progression already re-checked them; this region only *adds*).
- Touching the question banks of the other 7 topics.

## Tests / verification
- `npx tsc --noEmit`, `npm test`, `npm run build` all green; the `realContent.test.ts` generic per-region loops (tilemap audit, BFS reachability, lesson-flag, dialogue walkability, manifest references) must pass for the new region.
- Add to `realContent.test.ts`: register `equilibriums-heart.json` in the `maps` record used by the tilemap-audit loop (alongside `'the-crucible': theCrucible`); add an **R8 describe-style block** mirroring R7's — "Region 8 (equilibriums-heart) exists, index 8, topic 'equilibrium', valid mini-boss + region boss; Region 7 unlocks it" + "equilibrium question bank has 64–100 questions spanning all three difficulties (with at least one balanceEquation)" + "the equilibriums-heart tilemap parses to a 24×18 grid with the expected interactive objects (5 interactive types + 3 npc)". Also assert `content.enemies['the-great-imbalance'].role === 'finalBoss'`.
- Add to `battleVictory.test.ts`: a `finalBoss` win sets `regionProgress[region.id].bossDefeated === true`, sets `storyFlags['game_complete'] === true`, awards the `bossReward.xp` and `RP_AWARDS.finalBoss` RP.
- Manual (human): walk R8 end-to-end, beat the boss, see the ending — the *feel* (boss difficulty, ending text) isn't machine-checkable.
