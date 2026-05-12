# Design — pragmatic 1920×1080 hi-res conversion

**Status:** approved (Option B).
**Goal:** the game renders at a true edge-to-edge 1920×1080 with smooth (non-pixel-art) graphics. This is the "pragmatic now" pass — every scene's existing layout is mechanically scaled up and re-fonted; it is *not* a redesign for widescreen. A proper "HD UI redesign" is logged for a future milestone.

## Why this is layout-only

All shipped art is solid-colour placeholder rects/circles generated from `assetManifest.json`. Nothing visually "stretches" when the canvas aspect changes from 3:2 to 16:9, so we can lay every scene out at the full 1920×1080 without margins. The pure-logic units (battle engine, progression, quiz, save manager, helpers) never reference screen dimensions, so the 139-test suite is unaffected.

## Changes

### `gameConfig.ts`
- `GAME_WIDTH = 1920`, `GAME_HEIGHT = 1080`.
- `pixelArt: false`.
- Keep `Scale.FIT` + `CENTER_BOTH` (1:1 on a 1080p display; clean letterbox on other ratios).
- Remove the `GBA_WIDTH / GBA_HEIGHT / SCALE` constants (nothing should reference GBA dims after this).

### Placeholder art
- Multiply every `w` / `h` in `assetManifest.json`'s `placeholders` array by 4 (hero overworld 16×24 → 64×96, tile 16 → 64, battle sprites 48×48 → 192×192, worldmap/battle-bg 480/240-class → 1920/960, status icons 12 → 48, etc.).
- Bump the placeholder-label font in `placeholderTextures.ts` (`addPlaceholderLabel`) from `7px` to `24px`.
- No code-shape change — `generatePlaceholderTextures` already reads the sizes from the manifest.

### Static scenes — `TitleScene`, `ClassSelectScene`, `WorldMapScene`, `MenuScene`, `DialogueScene`, `ChallengeShrineScene`, `ErrorScene`
- Change each scene's `W = 480, H = 320` → `W = 1920, H = 1080`.
- Centred content (`W / 2`) just works; absolute positions, panel/box dimensions and offsets scale ~×4.
- Font sizes scale ~×4, rounded to a small ladder: `7→24, 8→28, 9→32, 10→36, 11→40, 12→44, 13→48` px. (Lerp anything in between.)

### `BattleScene`
- Same ×4 treatment for the action menu, HP/energy bars, ChainMeter, QuizPanel, status icons, battle-log line, banners, sprite anchor positions, the burst-flash overlay.
- `HealthBar` / `EnergyBar` / `ChainMeter` / `Textbox` / `QuizPanel` take explicit sizes from the scene; bump their internal constants too (`BAR_H = 8 → 32`, segment sizes, label widths, etc.).

### `OverworldScene`
- Introduce `RENDER_TILE = 64` — the on-screen tile size, independent of the JSON's 16px data grid. The 24×18 map then renders at 1536×1152, filling the viewport with the camera following the player.
- `Player` / `Npc` already take a tile-size constructor arg → pass `RENDER_TILE`.
- `cameras.main.setBounds` / `startFollow` / `physics.world.setBounds` use `mapW*RENDER_TILE × mapH*RENDER_TILE`.
- NPC labels, the four marker glyphs, the HUD bar, the confirm modal, the toasts — fonts/sizes ×4. Marker rects sized to `RENDER_TILE`.

## Out of scope (future "HD UI redesign" milestone)
- Layouts that actually *use* the widescreen space (wider panels, repositioned battle sprites, a roomier overworld camera).
- An HD typography scale and a real UI kit.
- Responsive behaviour for projectors / tablets (variable viewport, `Scale.RESIZE`).
- A hi-res *illustration* art direction (the current placeholder system stays; "Milestone 3" art is now smooth art rather than pixel sprites).

## Verification
- `npx tsc --noEmit` clean; `npm test` still 139/139 (no test changes expected); `npm run build` succeeds.
- Manual: `npm run dev` — every scene fills 1920×1080, text is crisp, the overworld map is large and the camera follows; battle/shrine/menu all legible.
