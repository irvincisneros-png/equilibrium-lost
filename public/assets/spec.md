# Equilibrium Lost — Asset Spec Sheet (v0, M1)

- **Base resolution:** 240×160 logical px (GBA), rendered at 2× (480×320). `pixelArt: true` — nearest-neighbour.
- **Tile size:** 16×16 px.
- **Palette:** GBA-style limited palette — ~32 colours, no gradients/anti-aliasing. (Curated list TBD in Milestone 3.)
- **Character sprites:** overworld 16×24 px, 4-direction walk cycles, 3 frames each (idle, step-L, step-R). Battle pose 48×48 px, ≥2 frames (idle, hit/attack).
- **Enemy sprites:** wild 32×32 px; mini-boss 48×48; region/final boss 64×64. ≥2 frames (idle, hit).
- **Backgrounds:** battle backgrounds 240×112 px (top portion; UI occupies the rest).
- **UI chrome:** 9-slice textbox; bars (HP/Energy) 1-px outline; chain meter 5 segments.
- **Naming convention (matches `assetManifest.json` keys):**
  - `hero_<class>_<evostage>_<context>` e.g. `hero_pyron_0_overworld`, `hero_pyron_1_battle`
  - `enemy_<id>` e.g. `enemy_protium`
  - `npc_<id>`, `tiles_<region>`, `bg_battle_<region>`, `ui_textbox`, `ui_chainmeter`, `icon_status_<id>`, `worldmap`
- **M1 reality:** all of the above are generated at boot as labelled coloured rectangles (see `src/ui/placeholderTextures.ts`). Real art lands in Milestone 3 by editing `assetManifest.json` only.
