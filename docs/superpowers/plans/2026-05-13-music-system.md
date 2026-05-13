# Music System Implementation Plan

> Use superpowers:subagent-driven-development (single sonnet subagent for the whole thing — the tasks are tightly coupled and short). Steps use `- [ ]` syntax.

**Goal:** Wire the 12 chiptune tracks (already downloaded to `public/assets/audio/`) into the game — per-scene background music with cross-fades, a settings volume control, save-persisted, autoplay-gated by the existing user-gesture flow.

**Architecture:** A Phaser-friendly `src/systems/MusicManager.ts` singleton (one currently-playing `Phaser.Sound.BaseSound`; fades between tracks via `scene.tweens`). Scenes call `MusicManager.play(this, key)` in `create()`. Save bumped to v3 (`settings.musicVolume` added; v2 saves backfill to `0.6`). BootScene extended to load the audio manifest entries alongside images. Credits added for the 3 CC-BY tracks in `EndingScene`.

**Tech Stack:** Phaser 3 (`scene.load.audio`, `scene.sound.add`), TypeScript, Vite, Vitest.

**Gates (every commit):** `npx tsc --noEmit && npx vitest run`; `npm run build` at the end.

---

## Files already in place
`public/assets/audio/` contains (verified, formats correct):
```
01-title.mp3
02-worldmap.mp3
03-overworld-r1.ogg
04-overworld-r2-r4.ogg
05-overworld-r5-r7.ogg
06-overworld-r8.ogg
07-battle-normal.ogg
08-battle-miniboss.ogg
09-battle-regionboss.ogg
10-battle-finalboss.mp3
11-shrine.ogg
12-ending.ogg
```

Attribution required for 3 tracks (slots 1, 2, 8 — see `docs/superpowers/music-tracks-codex.md`).

---

## Task 1: Asset manifest + BootScene audio loading

**Files:** `src/content/data/assetManifest.json`; `src/scenes/BootScene.ts`; `src/content/types.ts` (if `AssetManifest` type needs adjusting).

- [ ] **Step 1: Read** `src/scenes/BootScene.ts` (the existing `loadRealImagesThenStart(manifest)` loop). Read `src/content/types.ts`'s `AssetManifest` type. Read `src/content/data/assetManifest.json`.

- [ ] **Step 2: Populate `assetManifest.json`'s `audio` block** with one entry per track. Use exactly these keys (the scenes will reference them):
```json
"audio": {
  "music_title":             "assets/audio/01-title.mp3",
  "music_worldmap":          "assets/audio/02-worldmap.mp3",
  "music_overworld_r1":      "assets/audio/03-overworld-r1.ogg",
  "music_overworld_r2_r4":   "assets/audio/04-overworld-r2-r4.ogg",
  "music_overworld_r5_r7":   "assets/audio/05-overworld-r5-r7.ogg",
  "music_overworld_r8":      "assets/audio/06-overworld-r8.ogg",
  "music_battle_normal":     "assets/audio/07-battle-normal.ogg",
  "music_battle_miniboss":   "assets/audio/08-battle-miniboss.ogg",
  "music_battle_regionboss": "assets/audio/09-battle-regionboss.ogg",
  "music_battle_finalboss":  "assets/audio/10-battle-finalboss.mp3",
  "music_shrine":            "assets/audio/11-shrine.ogg",
  "music_ending":            "assets/audio/12-ending.ogg"
}
```

- [ ] **Step 3: Extend `BootScene`** to load each audio entry alongside the image loop. Mirror the existing pattern: a parallel `audioEntries = Object.entries(manifest.audio); for (const [key, url] of audioEntries) this.load.audio(key, url);`. Audio failures should be tolerated the same way images are (the `FILE_LOAD_ERROR` handler already exists — confirm it handles audio file errors gracefully; if not, log and continue). The scene must still start after all loads complete; audio missing should not block the game.

- [ ] **Step 4: `npx tsc --noEmit && npx vitest run && npm run build`** all green. Verify the dev server (or `npm run preview`) console shows successful audio loads (or graceful failures). Commit: `feat: load music audio assets in BootScene + manifest entries`.

---

## Task 2: `MusicManager` singleton + scene wiring

**Files:** Create `src/systems/MusicManager.ts`; modify scenes — `TitleScene.ts`, `WorldMapScene.ts`, `OverworldScene.ts`, `BattleScene.ts`, `ChallengeShrineScene.ts`, `HealingSpringScene.ts`, `EndingScene.ts`, `ClassSelectScene.ts` (just inherits Title music).

- [ ] **Step 1: Create `src/systems/MusicManager.ts`** — a module-level singleton (not a Phaser scene). Public API:
```ts
import type Phaser from 'phaser';

export interface MusicState {
  /** The audio key currently playing, or null. */
  currentKey: string | null;
  /** Volume 0..1 — applies multiplicatively to every play. */
  volume: number;
}

/**
 * Module-level singleton — Phaser sounds live on the Phaser SoundManager (which is global),
 * so we can keep cross-scene state in a plain singleton without a "music scene" hack.
 * Scenes call `MusicManager.play(this, key)` in their `create()` (or wherever transitions happen).
 *
 * Cross-fade: if the requested key differs from the current key, the old sound fades out
 * (over `FADE_MS`) while the new one fades in (over the same duration). If the same key is
 * requested, do nothing (idempotent — safe to call on every scene re-entry).
 *
 * Autoplay: the browser will block playback until a user gesture. Phaser's SoundManager
 * already unlocks on the first interaction (Title screen click / keypress), so subsequent
 * `play()` calls in any scene work without special handling.
 */
export const MusicManager = {
  state: { currentKey: null, volume: 0.6 } as MusicState,
  // Internals (kept here for testability; assigned in play()):
  _current: null as Phaser.Sound.BaseSound | null,
  _fadeTween: null as Phaser.Tweens.Tween | null,

  /** Set the master music volume (0..1). Applies immediately to the current track. */
  setVolume(v: number): void { /* clamp, store, apply to _current */ },

  /** Play (or cross-fade to) a track. No-op if `key` matches the current track. */
  play(scene: Phaser.Scene, key: string, opts?: { fadeMs?: number; loop?: boolean }): void { /* ... */ },

  /** Stop the current track with a fade-out. Used by Title returns / explicit silences. */
  stop(scene: Phaser.Scene, opts?: { fadeMs?: number }): void { /* ... */ },
};
```
  Implementation details:
  - `FADE_MS = 800` default (callers can override).
  - On `play(scene, key)`:
    - If `key === state.currentKey` and `_current?.isPlaying`, return (idempotent).
    - If a track is already playing, tween its volume to 0 over `fadeMs`, then `stop()` and `destroy()` it.
    - Create the new sound: `scene.sound.add(key, { loop: opts?.loop ?? true, volume: 0 })`; `play()`; tween volume to `state.volume` over `fadeMs`. Track the tween in `_fadeTween` so a rapid second `play()` cancels the previous fade.
    - Update `state.currentKey` synchronously (so concurrent calls are correctly de-duped).
  - On `setVolume(v)`: clamp [0,1], `state.volume = v`, and if `_current?.isPlaying`, set its volume to `v` directly (no fade — instant response when the player drags the slider).
  - Guard against `scene.sound.locked` — Phaser still permits queueing; play just won't audibly start until unlocked. That's fine: by the time scenes after Title run, audio is unlocked.
  - If `scene.cache.audio.exists(key) === false`, log a warning and return without crashing (graceful degradation if a file is missing).

- [ ] **Step 2: Wire scenes — each calls `MusicManager.play(this, key)` in `create()`** (or after the init guard). Track keys per scene:
  - `TitleScene` → `music_title`
  - `ClassSelectScene` → `music_title` (keep continuous from Title for the brief screen)
  - `WorldMapScene` → `music_worldmap`
  - `OverworldScene` → derive from `region.id`: R1 (`elemental-reaches`) → `music_overworld_r1`; R2–R4 (`bonding-forge`, `reaction-hollow`, `balance-halls`) → `music_overworld_r2_r4`; R5–R7 (`catalyst-crags`, `acid-wastes`, `the-crucible`) → `music_overworld_r5_r7`; R8 (`equilibriums-heart`) → `music_overworld_r8`. Use a small `regionMusicKey(regionId)` helper inside the scene file.
  - `BattleScene` → derive from `enemyDef.role`: `wild` → `music_battle_normal`, `miniBoss` → `music_battle_miniboss`, `regionBoss` → `music_battle_regionboss`, `finalBoss` → `music_battle_finalboss`. Call in `create()` once the enemy is known.
  - `ChallengeShrineScene` → `music_shrine`.
  - `HealingSpringScene` → `music_shrine` (same shrine track — short healing breaks reuse the meditative loop).
  - `EndingScene` → `music_ending`.
  - `DialogueScene` / `MenuScene` — do NOT call `play()`; they're transient overlays. The underlying scene's music keeps playing.

  At the top of each touched scene: `import { MusicManager } from '../systems/MusicManager';`.

- [ ] **Step 3: Initial volume sync.** In `TitleScene.create()` (the first scene the player hits where a save might already exist in the registry), set `MusicManager.state.volume = save?.settings.musicVolume ?? 0.6;` BEFORE the first `play()` call. Also after `ClassSelectScene` creates a new save with `musicVolume: 0.6`, re-sync.

- [ ] **Step 4: `npx tsc --noEmit && npx vitest run && npm run build`** all green. Commit: `feat: MusicManager singleton + per-scene track wiring`.

---

## Task 3: Save schema v3 — `settings.musicVolume`

**Files:** `src/content/types.ts` (`SaveSettings`); `src/systems/SaveManager.ts` (`CURRENT_SAVE_VERSION`, migration step, `newGame` defaults); `tests/systems/saveManager.test.ts`.

- [ ] **Step 1: Write the failing test** in `tests/systems/saveManager.test.ts`:
```ts
it('newGame seeds settings.musicVolume=0.6 at version 3', () => {
  const s = SaveManager.newGame(content.classes[0].id, content);
  expect(s.version).toBe(3);
  expect(s.settings.musicVolume).toBe(0.6);
});

it('migrates a v2 save by backfilling settings.musicVolume', () => {
  const storage = memStorage();
  const v2: any = { ...SaveManager.newGame(content.classes[0].id, content), version: 2 };
  delete v2.settings.musicVolume;
  storage.setItem(SAVE_KEY, JSON.stringify(v2));
  const r = SaveManager.load(content, storage);
  expect(r.ok).toBe(true);
  if (r.ok) { expect(r.data.version).toBe(3); expect(r.data.settings.musicVolume).toBe(0.6); }
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**
  - `src/content/types.ts`: extend `SaveSettings`:
    ```ts
    export interface SaveSettings { studyMode: boolean; answerTimer: boolean; musicVolume: number; }
    ```
  - `src/systems/SaveManager.ts`:
    - `export const CURRENT_SAVE_VERSION = 3;`
    - In `newGame`'s `settings`, add `musicVolume: 0.6`.
    - Append the v2→v3 step to `STEPS`:
      ```ts
      ,
      (o) => { // 2 -> 3 : Music system — settings.musicVolume
        const settings = (o.settings ??= { studyMode: false, answerTimer: false }) as Record<string, unknown>;
        if (typeof settings.musicVolume !== 'number') settings.musicVolume = 0.6;
        o.version = 3;
      }
      ```
    - In `migrate`'s post-step shape checks, add: `if (typeof (o.settings as any).musicVolume !== 'number') throw new Error('corrupt: bad settings.musicVolume');`

- [ ] **Step 4: Run** → green. `npx tsc --noEmit` (will flag any code that constructs a SaveSettings literal without `musicVolume`; fix those — likely just the newGame literal). Commit: `feat: save v3 — settings.musicVolume (migration backfills v2 saves)`.

---

## Task 4: Settings tab — Music Volume control

**Files:** `src/scenes/MenuScene.ts`.

- [ ] **Step 1: Read** the existing `buildSettingsTab()` method to mirror its pattern (one `addRow` per toggle, calls a private `toggleSetting`).

- [ ] **Step 2: Add a Music Volume row.** Cycles through 5 levels on Enter / pointerdown — `0% → 25% → 50% → 75% → 100% → 0%`. Show as `Music Volume: 60%   — ←/→ to adjust` (also accept `keydown-LEFT`/`keydown-RIGHT` while focused for finer feel; reuse the existing per-tab keyboard handlers if simple, otherwise just Enter-cycles).
  - On change: `this.save.settings.musicVolume = newVal; MusicManager.setVolume(newVal); this.persist(); this.toast('Music ' + Math.round(newVal*100) + '%');`.
  - Position it as the **third** row in the Settings tab (after Study Mode + Answer Timer).
  - Import `MusicManager` at the top.

- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run && npm run build` → green. Commit: `feat: MenuScene Settings — Music Volume row (cycles 0/25/50/75/100%)`.

---

## Task 5: Credits in `EndingScene`

**Files:** `src/scenes/EndingScene.ts`.

- [ ] **Step 1:** Append a small credits block to the ending screen — three lines at the bottom in dim text (`#566074`), before the "Press Enter" prompt. Mention the 3 CC-BY tracks (slots 1, 2, 8) and link generically to OpenGameArt + the Creative Commons license URLs. The wording can be terse:
```
Music: "RPG Title Theme" (Tauredian, CC-BY 3.0), "Overworld Select" (Wolfgang_/Ted Kerr, CC-BY 4.0),
"Their Spears Fell Like Rain" (request, CC-BY 4.0). Other tracks CC0 from OpenGameArt.
```
  Reduce font size to ~18px so it doesn't dominate the screen; wrap if needed. Keep within the existing layout flow (insert before the "Press Enter to return to the title" prompt; shift the prompt's y accordingly).

- [ ] **Step 2:** Build/tests green. Commit: `feat: EndingScene — music attribution for CC-BY tracks`.

---

## Task 6: Final verification

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run build` — all green. Note new test count (was 252).
- [ ] **Step 2:** `git diff main --stat` — only expected files: `assetManifest.json`, `BootScene.ts`, `MusicManager.ts` (new), the 7 scenes wired, `types.ts`, `SaveManager.ts`, `saveManager.test.ts`, `MenuScene.ts`, `EndingScene.ts`, plus the plan doc and the 12 audio files (untracked → git-add).
- [ ] **Step 3:** Report; ready to merge `--no-ff` → tag `v0.14.0-music`.

---

## Self-review notes
- **Risk:** Phaser's audio loader can fail silently if the file's actual format doesn't match the extension; the file extensions were verified before this plan was written (3 files renamed `.ogg` → `.mp3` to match their MP3 contents). If a track stutters or doesn't play in the deploy, check the network tab — likely a CORS or path issue under GitHub Pages.
- **No new tests for the music system itself** (audio playback is not unit-testable without a real audio context). The save-migration test covers the data-layer change. Manual playtest will catch volume / scene-transition fades.
- **Autoplay gating** is handled automatically by Phaser's SoundManager + the player's first input on TitleScene — no special-case code needed.
- **`MenuScene` and `DialogueScene` deliberately don't play music** — they sit on top of paused scenes, so the underlying scene's track keeps playing. That's the desired UX.
