# Equilibrium Lost — Design Specification

**Date:** 2026-05-11
**Status:** Approved design — ready for implementation planning
**Author:** Irvin Cisneros (with Claude)

---

## 1. Overview

**Equilibrium Lost** is a turn-based, pixel-art RPG (visually inspired by the Pokémon Game Boy Advance games) built as a static web app and deployed to GitHub Pages. It is an educational game for **Year 10 high-school students** studying **Chemistry under the NSW Science syllabus (Stage 5)**.

The player is a young chemist-hero in the world of **Æquor**, a land thrown into chaos because its chemical reactions have become "corrupted" — acid storms, runaway combustion, atoms that won't bond. Travelling region to region, the player defeats corrupted phenomena and **restores equilibrium** by mastering real Year 10 chemistry.

The game must work both as a short in-class activity (30–50 minute sessions) and as extended at-home play, with progress saved between sessions via browser `localStorage`. It is single-player and fully offline-capable (no backend, no accounts).

---

## 2. Educational Model

The game uses a **hybrid** approach — chemistry is woven into the world, taught explicitly by NPCs, and reinforced through optional and in-battle questions:

1. **Immersion** — the world, regions, enemies, skills, status effects, and type chart are all built from real chemistry. Students absorb concepts just by playing (e.g., a "Decomposition" enemy splits into two when hit; "Base" skills neutralise "Acid" enemies).
2. **NPC teaching (the "lesson" layer)** — townspeople, mentors, and signposts deliver short, syllabus-aligned explanations before the player faces a region's challenges.
3. **Quiz on skills (in battle)** — using a powerful chemistry **Skill** triggers a question on that topic. Correct → full power + bonus XP + builds the Chain Reaction meter. Incorrect → a weak (~30%) version fires, the correct answer is shown with a one-line explanation, and the chain resets. **There is no HP penalty and no lost turn for a wrong answer** — it is a correction, never a punishment.
4. **Optional Challenge Shrines** — pure quiz gauntlets hidden in each region. Clearing them grants bonus XP and rare evolution items. This is the "go deeper" content for keen students.

**Teacher-editable question bank:** all questions live in plain JSON data files (one file per topic), tagged by topic and difficulty. Teachers can add, edit, reorder, or replace questions without touching code.

**Optional report card:** the save file tracks per-topic quiz accuracy; an end-of-game summary screen the student can screenshot gives the teacher a lightweight read on engagement and weak spots. (Polish-phase feature, not core.)

---

## 3. Syllabus Alignment — World Structure

The world of Æquor is traversed top-to-bottom through **8 regions**: 7 mapped to NSW Year 10 Chemistry topics (in the usual teaching order) plus a capstone finale.

| # | Region | Syllabus topic(s) | Region boss (placeholder name) |
|---|--------|-------------------|-------------------------------|
| 1 | The Elemental Reaches *(tutorial)* | Atomic structure, subatomic particles, electron shells, the Periodic Table | The Unstable Isotope |
| 2 | The Bonding Forge | Ionic, covalent & metallic bonding; why compounds form | The Sundered Lattice |
| 3 | Reaction Hollow | Reaction types: synthesis, decomposition, combustion, displacement, precipitation | The Eternal Flame |
| 4 | The Balance Halls | Conservation of mass; writing & balancing chemical equations | The Lopsided Equation |
| 5 | Catalyst Crags | Rates of reaction: temperature, concentration, surface area, catalysts | The Runaway Reaction |
| 6 | The Acid Wastes | Acids & bases; the pH scale; indicators; neutralisation reactions | The pH Tyrant |
| 7 | The Crucible | Energy in reactions: exothermic vs endothermic; energy profile diagrams | The Heat Sink |
| 8 | Equilibrium's Heart *(finale)* | Mixed challenges drawn from all topics, then the final boss | The Great Imbalance |

**Every region contains:**
- An explorable tile-based overworld with a region-specific biome
- NPC mentors who deliver the lesson content for that topic
- Topic-themed wild "corrupted reaction" encounters (~4 enemy types per region)
- A hidden Challenge Shrine (quiz gauntlet) with bonus rewards
- A mini-boss guarding a key area ("unstable compound")
- A region boss whose defeat "restores equilibrium" — unlocking the next region, advancing the story, and granting a major reward (new skill or evolution item)

Regions, enemies, NPCs, and questions are defined entirely in JSON data files, so they can be reordered, renamed, or extended without code changes. Region names and boss names above are placeholders.

---

## 4. Core Gameplay — Battle System

This is the central engagement hook. Battles are **1v1 turn-based** (Pokémon-style). Turn order is determined by the Speed stat. A battle ends when one combatant reaches 0 HP, or when the player flees (fleeing is disabled in boss fights).

### 4.1 Action menu — four choices, each with a role
- **Attack** — basic hit, *no quiz*, modest damage. The safe option.
- **Skills** — chemistry-themed special moves. Each triggers a question. Bigger damage, status effects, type advantages. Costs **Energy** (a small pool that refills slowly and via items — prevents spamming the strongest move).
- **Items** — "Buffers" (heal HP), "Reagents" (revive), stat boosters. Found in the overworld.
- **Run** — flee from battle (disabled vs bosses).

### 4.2 The quiz moment
Selecting a Skill pauses the battle and slides up a GBA-style textbox containing the question. Question formats:
- 4-option multiple choice (default)
- Interactive widgets for advanced skills (e.g., balance-the-equation, drag coefficients)

Outcomes:
- **Correct** → the skill fires at **full power**; damage lands; `+XP` popup ("Reaction mastered!"); the **Chain Reaction** meter ticks up by one.
- **Incorrect** → the skill **fizzles** to ~30% damage; the textbox shows *"The answer was X — [one-line explanation]"*; the Chain Reaction meter resets to zero. No HP penalty; no lost turn beyond the weak hit.

### 4.3 Chain Reaction meter (the engagement engine)
Consecutive correct answers build a damage multiplier (e.g., ×1.2 → ×1.5 → ×2.0). Filling the meter unlocks a **Catalyst Burst** — the player's signature move at greatly amplified power with a full-screen animation. Any wrong answer breaks the chain. Net effect: knowing the chemistry feels powerful and spectacular, and students chase that payoff.

### 4.4 Type chart (a chemistry lesson in disguise)
Enemies are "corrupted reactions" with a chemistry affinity; skills have affinities too. Matchups encode real chemistry. Examples:
- **Base** skills are super-effective vs **Acid** enemies → neutralisation
- **Acid** skills are super-effective vs **Metal/Ionic** enemies → acids react with metals
- **Endothermic** skills counter **Exothermic/Combustion** enemies → absorbing the heat
- **Catalyst** skills deal little damage but grant an extra action / supercharge the next skill
- **Decomposition** skills split high-HP enemies into weaker halves
- **Precipitation** skills strip enemy buffs ("precipitate it out")

The full type chart lives in `typeChart.json` and is tuned during the polish phase. Learning the chart is learning reaction types.

### 4.5 Status effects (chemistry-flavoured)
- **Oxidised** — DEF drains over time (corrosion)
- **Dissolved** — damage each turn (acid)
- **Catalysed** — bonus speed / extra turns
- **Precipitated** — skip a turn (solidified)
- **Endothermic Chill** — ATK reduced
- **Combusting** — burn damage each turn (exothermic)

### 4.6 Enemies & bosses
- **Wild encounters** — topic-themed creatures per region (e.g., Reaction Hollow: Combustix, Synthor, Decomposeer).
- **Mini-bosses** — "unstable compounds" guarding key areas.
- **Region bosses** — a giant corrupted phenomenon; defeating one restores that region's equilibrium → unlocks the next region + story beat + major reward.
- **Final boss** — The Great Imbalance / Entropy itself, in Equilibrium's Heart.

### 4.7 Battle rewards
- XP → levels → stat growth + skill unlocks + class evolution at thresholds
- Items / "Reagents" → consumables, evolution materials
- Certain enemies teach new skills on defeat (TM-style)

### 4.8 Accessibility & adaptive difficulty
- If a student repeatedly misses questions on a topic, the QuizEngine serves easier questions on that topic and the region's NPC offers a refresher.
- **Study Mode** toggle (in settings): shows a hint on each question and removes Chain Reaction pressure — for students who need scaffolding.
- Region bosses soft-scale to player level so under-levelled players are not hard-walled.
- An optional answer timer (off by default) grants a small "Critical Reaction!" damage bonus for fast correct answers; can be disabled to remove time pressure.

---

## 5. Character Classes, Progression & Evolution

### 5.1 Starting classes
Chosen at the start of a new game. These are *playstyle archetypes*, not topic-locked — every class can use skills from every topic, but each has a stat bias and a signature skill line:

| Class | Theme | Stat bias | Playstyle |
|-------|-------|-----------|-----------|
| **Pyron** | Combustion / energy | High ATK, low DEF | Aggressive — high damage, fragile |
| **Aqualis** | Acids, bases & solutions | Balanced, high HP | All-rounder — survivable, flexible |
| **Ionix** | Atomic structure & bonding | High SPD, status-focused | Tricky — acts first, stacks debuffs |

### 5.2 Levelling
Winning battles grants XP. Levelling up increases stats and unlocks new skills at set levels. Unlockable skills are drawn from topics the player has *reached* in the story, so the skill kit grows alongside the syllabus.

### 5.3 Evolution
At level milestones (e.g., Lv 10, Lv 20, Lv 30) **and** after clearing the relevant region, the character evolves: new sprite, stat jump, new signature skill. Example chain for Pyron:
`Pyron → (Lv 10, clear Reaction Hollow) → Pyrochemist → (Lv 20, clear The Crucible) → Combustion Sovereign`
Evolution is gated on *progressing through the chemistry*, not just grinding. Visible transformation rewards learning.

### 5.4 Skill loadout
The player carries a limited active loadout (target: 4–6 skills) chosen from all unlocked skills, swappable freely outside battle. Light deck-building strategy without overwhelming students.

### 5.5 Save contents
class, evolution stage, level, XP, stats, unlocked skills, equipped skills, items, current region, per-region progress, story flags, per-topic quiz accuracy stats, settings (Study Mode, timer). Saves are versioned (see §6.4).

---

## 6. Technical Architecture

### 6.1 Stack
- **Phaser 3** — game engine (tilemaps, sprites, animation, scenes, input)
- **TypeScript** — type safety for a project of this size
- **Vite** — dev server + static build output (GitHub Pages compatible)
- **Vitest** — unit testing
- **GitHub Actions** — auto-build and deploy to GitHub Pages on push to `main`
- No backend, no database, no accounts. Saves in `localStorage`.

### 6.2 Core principle — logic separated from rendering
`BattleEngine`, `QuizEngine`, and `Progression` are pure TypeScript modules with **no Phaser dependency** — state in, new state out. This makes them unit-testable and keeps the game's core logic easy to reason about. Phaser scenes handle rendering and input only.

### 6.3 Content is data, not code
classes, skills, enemies, regions, items, the type chart, and the question bank are JSON files. Adding an enemy or 50 questions = editing a data file. The `questions/` folder has one file per topic — the teacher-editable layer.

### 6.4 Save system
Every save carries a `version` number. `SaveManager` includes migration logic so saves from earlier builds keep working as features are added. A corrupted save is detected on load and the user is offered a clean restart with a clear message — never silently wiped.

### 6.5 Asset manifest
One file (`assetManifest.json`) maps logical asset names (e.g., `hero_pyron_battle`) to file paths. Placeholders during development, real pixel art later — swapping is a one-file edit, no code changes. A missing asset falls back to a placeholder sprite plus a console warning (never a crash).

### 6.6 Data validation & error handling
- `ContentLoader` validates JSON against simple schemas on boot.
- Malformed question → skipped + console warning (game continues).
- Missing required data file → friendly error screen, not a blank page.
- Corrupted save → detected, user offered clean restart.

### 6.7 Project structure (target)
```
equilibrium-lost/
  index.html
  vite.config.ts
  package.json
  tsconfig.json
  public/assets/                — sprites, tiles, audio (placeholders first)
  src/
    main.ts                     — Phaser config + boot
    scenes/                     — Boot, Title, ClassSelect, WorldMap,
                                  Overworld, Battle, Dialogue, Menu
    systems/
      BattleEngine.ts            — turn logic, damage, status, type chart (pure)
      QuizEngine.ts              — question selection, validation, chain logic (pure)
      Progression.ts             — XP, levels, skill unlocks, evolution (pure)
      SaveManager.ts             — localStorage + save-version migration
      ContentLoader.ts           — loads & validates JSON, asset manifest
    data/
      classes.json  skills.json  enemies.json  regions.json
      items.json    typeChart.json  assetManifest.json
      questions/                 — atomic-structure.json, bonding.json, … (teacher-editable)
    entities/                    — Player, Enemy, Npc
    ui/                          — Textbox, ChainMeter, QuizPanel, HealthBar
  tests/                         — battleEngine, progression, quizEngine, saveManager
  .github/workflows/deploy.yml   — build + deploy to GitHub Pages
```

### 6.8 Deployment
`vite build` outputs static files to `dist/`. A GitHub Actions workflow builds on push to `main` and publishes `dist/` to GitHub Pages. The game runs entirely client-side.

---

## 7. Visual Asset Inventory (formalised into a spec sheet in Phase 1)

- **World map** — illustrated overworld of Æquor showing the 8 regions, player progress marker, locked/unlocked states (GBA region-map style)
- **Tilesets** — one per region biome (lab ruins, acid marsh, volcanic crucible, etc.)
- **Character sprites** — 3 classes × evolution stages; overworld (4-direction walk cycles) + battle poses
- **Enemy sprites** — wild creatures per region + mini-bosses + region bosses + final boss (battle poses, hit/attack frames)
- **Battle backgrounds** — one per region
- **NPC sprites** — mentors, townsfolk
- **UI chrome** — textboxes, menus, Chain Reaction meter, HP/Energy bars, quiz panel, icons (skills, items, status effects)
- **Title screen art** + a few story-panel illustrations for key plot beats
- **Audio** (optional, polish phase) — region music, battle theme, SFX

### Asset workflow
1. **Phase 1** — write an asset spec sheet (`public/assets/spec.md`): tile size, colour palette (GBA-style limited palette), animation frame counts, naming convention.
2. **Phase 2** — build the full Phaser game with placeholder art (coloured rectangles / emoji). Game is fully playable before any real art exists.
3. **Phase 3** — generate pixel art with an AI image tool (the user's "Codex" image generation) against the spec sheet, category by category: tiles → character sprites → enemy sprites → battle backgrounds → UI. Export as organised PNG sprite sheets.
4. **Phase 4** — swap placeholders for real art via the asset manifest. Add audio if wanted.
5. **Iterate** — refine prompts and regenerate individual assets as needed; art/code separation keeps this painless.

---

## 8. Build Strategy (Milestones)

Each milestone is independently shippable — there is always a working game.

**Milestone 1 — Vertical Slice (core engine + Region 1).** Build all core systems (BattleEngine, QuizEngine, Progression, SaveManager, ContentLoader) and the full scene flow (Title → ClassSelect → WorldMap → Overworld → Battle → Dialogue → Menu), but only for **The Elemental Reaches**: tilemap, NPC lesson content, ~4 wild enemies, a Challenge Shrine, a mini-boss, a region boss, the Chain Reaction mechanic, type chart, status effects, evolution at Lv 10, and ~40–60 questions for atomic structure / the Periodic Table. Placeholder art and audio. Deployed to GitHub Pages, playable end-to-end.

**Milestone 2 — Content expansion.** Add Regions 2–7 one at a time (each is mostly JSON: enemies, NPCs, questions, a tilemap, a boss), then the finale region (Equilibrium's Heart) and the final boss.

**Milestone 3 — Real assets.** Generate pixel art against the spec sheet; swap placeholders via the asset manifest. Add audio (music/SFX) if wanted.

**Milestone 4 — Polish.** Adaptive-difficulty tuning, Study Mode, end-of-game report card, type-chart and stat balance pass, classroom playtesting with students.

---

## 9. Testing Strategy

- **Unit tests (Vitest)** on the pure logic modules: damage calculation, type-chart effectiveness, XP/level curves, evolution triggers, quiz validation + Chain Reaction math, save serialise/deserialise + migration.
- **Manual playtest checklist per milestone:** complete a region start-to-finish; saves persist across a browser restart; wrong answer behaves correctly (weak hit + correction, no penalty); evolution fires at the right moment; game survives a corrupted save; in-class and at-home flows both work.
- **Classroom pilot (Milestone 4):** a handful of students play; observe confusion points and difficulty spikes; adjust.

Feel/fun cannot be verified without real playtesting — that is what the Milestone 4 pilot is for.

---

## 10. Out of Scope (for now)

- Multiplayer / competitive leaderboards (designed so a leaderboard *could* be added later via a service like Firebase, but not built now)
- Accounts / cloud save (localStorage only)
- A separate teacher dashboard/analytics portal (the screenshot-able report card is the lightweight substitute)
- Content for science topics other than Year 10 Chemistry (the data-driven design would allow it later)
- Mobile-native app (the web build is responsive enough for tablets/Chromebooks; no app store packaging)

---

## 11. Open Questions / To Resolve During Planning

- Exact Energy pool size and refill rate (balance — tune in Milestone 1, finalise in Milestone 4)
- Exact level milestones for evolution and the full evolution chains for all 3 classes
- Number of active skill loadout slots (target 4–6 — pick during Milestone 1)
- Whether NPC lesson content is hand-authored prose or also data-driven dialogue trees (lean: data-driven dialogue, authored as JSON)
- Final region/boss/enemy/skill names (placeholders throughout this spec)
