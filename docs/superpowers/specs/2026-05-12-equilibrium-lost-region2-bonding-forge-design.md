# Design — Region 2: The Bonding Forge

**Status:** approved.
**Goal:** add the second playable region — *The Bonding Forge* — fully playable end-to-end (lesson NPCs → wild battles → Challenge Shrine → mini-boss → region boss → "equilibrium restored"), and wire the World Map's unlock chain so clearing Region 1 opens Region 2. Mostly content (JSON) plus a handful of small code generalisations; no new scenes, no engine changes.

**Source of truth for the region:** §3 of `docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md` — Region 2 = *The Bonding Forge*, topic *"Ionic, covalent & metallic bonding; why compounds form"*, region boss *The Sundered Lattice*.

## Scope of the content

**Chemistry topic (`bonding`)** — NSW Year 10 Chemistry, the bonding unit:
- ionic bonds: electron *transfer*, metal + non-metal, formation of cations/anions, ionic lattices, properties (high mp/bp, brittle, conduct when molten or in solution, don't conduct as solids)
- covalent bonds: electron *sharing*, non-metal + non-metal, molecules, single/double/triple bonds, properties of covalent-molecular substances (low mp/bp, don't conduct, often gases/liquids)
- metallic bonding: lattice of cations in a "sea" of delocalised electrons, properties (conduct, malleable, ductile, lustrous)
- why compounds form: atoms achieving stable full-outer-shell (noble-gas) configurations
- predicting & writing simple formulae from valencies/charges; naming simple ionic compounds
- common polyatomic ions: sulfate SO₄²⁻, nitrate NO₃⁻, carbonate CO₃²⁻, hydroxide OH⁻, ammonium NH₄⁺
- distinguishing ionic / covalent-molecular / metallic substances from their properties

**`questions/bonding.json`** — ~45 questions, spanning difficulties 1–3 (≥5 each), mostly `mcq`; include 2–4 `balanceEquation` items for "form the ionic compound" equations (e.g. `Mg + Cl₂ → MgCl₂`, `Na + O₂ → Na₂O`) so the widget and the region boss have something to use. Every item passes the existing `validateQuestion` contract; provide a `hint` on as many as practical (Study Mode). Authored at Year-10 reading level.

**`tilemaps/bonding-forge.json`** — a hand-authored 24×18 grid (same format as `elemental-reaches.json`): a forge layout — `player_spawn` near the bottom; a path winding up; tall-grass (encounter) patches between landmarks; 3 `npc` objects placed where `npcs.json` puts them; a `shrine_entrance` off to one side (with a `regionId: "bonding-forge"` field); a `minibossTrigger` at a chokepoint (`enemyId`, `flag: "miniboss_bonding-forge_done"`); a `bossGate` at the top (`enemyId`, `requiresFlag: "miniboss_bonding-forge_done"`); an `exit` (`to: "world"`).

**`npcs.json`** — 3 new mentors for the bonding lesson. Each ~4–6 dialogue nodes (short, syllabus-aligned, the "lesson layer"). The first one's path sets `setFlag: "lesson_bonding_seen"`. One has a node with `launch: "shrine"`. `node[0]` is the entry node. `spriteKey`s: `npc_<id>` (new placeholder keys), `tile` matches the tilemap.

**`enemies.json`** — 6 new entries:
- 4 wild "corrupted bond" enemies, ≈ Lv 5–9, affinities drawn from `Ionic` / `Covalent` / `Metal` (and maybe one `Neutral`/`Decomposition`); ~equal `xpYield` so the Forge grass levels the player toward the boss. One is a deliberate pushover (Lv 5, low HP/attack) so early-Forge fights aren't a wall. `role: "wild"`. (Optional: one with `splitIntoId` reusing an existing half, or a new half.)
- 1 mini-boss "unstable compound" — ≈ Lv 11, `role: "miniBoss"`, `bossSoftScale: false`; uses 1–2 bonding skills.
- *The Sundered Lattice* — ≈ Lv 14, `role: "regionBoss"`, affinity `Metal` (its lattice theme), `bossSoftScale: true`, `teachesSkillId` set to one of the new bonding skills; uses 2–3 skills incl. a `balanceEquation`-topic'd one and `isotope-flux`-style filler.

**`skills.json` + `classes.json`** — 2–3 new bonding-affinity skills (`topic: "bonding"`, quizzed; affinities among `Ionic`/`Covalent`/`Metal`; powers ≈ 38–48; energy costs ≈ 25–30; one with a `behavior` like `applyStatus`/`stripBuffs`). Added to the classes' `skillUnlocks` at levels ≈ 13–16 (the spec's "skill kit grows with the syllabus"). One of them is the boss's `teachesSkillId`. Keep it minimal — these are flavour, not a balance overhaul.

**`assetManifest.json` + `regions.json`** —
- `assetManifest.json`: new `images` + `placeholders` entries for `tiles_bonding_forge`, `bg_battle_bonding_forge`, the 6 new `enemy_*` sprites, and the 3 new `npc_*` sprites — coloured-rect placeholders in forge-y tones (coppers/oranges/iron-greys), sized like their Region-1 counterparts.
- `regions.json`: append the Region 2 entry — `id: "bonding-forge"`, `index: 2`, `name: "The Bonding Forge"`, `topic: "bonding"`, `tilemapKey: "tilemap_bonding_forge"`, `tilesetKey: "tiles_bonding_forge"`, `battleBackgroundKey: "bg_battle_bonding_forge"`, `wildEnemyIds: [4 new ids]`, `encounterRatePerStep: 0.10`, `miniBossId`, `regionBossId`, `npcIds: [3 new ids]`, `shrine: { questionTopic: "bonding", questionCount: 6, passRatio: 0.8333, rewardXp: ~400, rewardItemIds: [...] }`, `unlocksRegionId: null`, `bossReward: { xp: ~500, itemIds: [...], skillId?: <one of the new skills> }`. **Also change Region 1's `unlocksRegionId` from `null` → `"bonding-forge"`.**

## Code changes (small)

- **`WorldMapScene.ts`** — render every `content.regions` entry as a real node (now 2), then fill the remaining slots from `LOCKED_REGION_LABELS` (which loses "The Bonding Forge" → 6 entries, regions 3–8). A region node is *unlocked* when `region.index === 1` **or** `content.regions.some(prev => prev.unlocksRegionId === node.id && (save.regionProgress[prev.id]?.bossDefeated ?? false))`. The "◀ START HERE" tag tracks the *first not-yet-cleared unlocked content region* (so it moves to Region 2 once Region 1 is done).
- **`OverworldScene.ts`** — (a) add the 2nd tilemap to the `TILEMAPS` registry (`import bondingForge from '../content/data/tilemaps/bonding-forge.json'; TILEMAPS = { tilemap_elemental_reaches: …, tilemap_bonding_forge: … }`); (b) replace the hardcoded `'lesson_atomic_structure_seen'` (in the welcome banner, the quest-NPC marker, and `currentObjective()`) with `lesson_${region.topic}_seen` — so the first-lesson onboarding works per region; (c) an optional small per-biome tile palette keyed by `region.tilesetKey` (default = the current palette) so the Forge looks distinct (iron-grey grass-equivalent, copper paths, dark-metal walls) — placeholder-quality, just visual variety.
- **`loadGameContent.ts`** — `import bonding from './data/questions/bonding.json'`; add `'bonding': bonding` to the `questions` map.
- **`main.ts`** — no change (no new scenes).
- **Battle / Dialogue / Shrine / Menu scenes** — no change (data-driven; the new enemies, NPCs, skills, shrine all just work).

## Tests

- `realContent.test.ts` — the existing asset-key cross-ref already iterates `content.regions`/`enemies`/`npcs`/`classes`, so it auto-covers the new keys. Add: a "Region 2 (`bonding-forge`) exists, `index === 2`, `topic === "bonding"`, has a valid mini-boss and region boss, and `regions[0].unlocksRegionId === "bonding-forge"`" test; a "bonding question bank has 40–60 questions, ≥5 per difficulty" test (matching the atomic-structure one, minus the `balanceEquation` requirement — or keep it if we include those items).
- A parses-check for `tilemaps/bonding-forge.json` (like Region 1's `node -e JSON.parse(...)`).
- `loadGameContent().warnings` must stay `[]` (all new ids resolve).
- `npx tsc --noEmit` clean; `npm test` green (139 existing + the new region tests); `npm run build` succeeds.

## Out of scope
- Regions 3–7 and the finale (Region 8) — same pattern, future milestones.
- Real art/audio (Milestone 3).
- Any new battle mechanic, scene, or engine change.
- A region/level editor or content-authoring tooling.

## Verification
- `npm run dev`: from a save with Region 1 cleared (or after clearing it), the World Map shows "The Bonding Forge" unlocked with "◀ START HERE"; entering it shows the forge biome, the 3 mentors (★ on the first), the lesson dialogue, tall-grass wild battles with bonding questions, the Challenge Shrine, the mini-boss chokepoint (confirm-to-engage), the boss gate (sealed until the mini-boss is down), and beating *The Sundered Lattice* shows the "equilibrium restored" banner + ✓ on the World Map; the boss-reward items/skill land; loading mid-Region-2 resumes correctly.
