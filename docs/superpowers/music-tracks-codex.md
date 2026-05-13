# Music tracks — Codex-curated shortlist (2026-05-13)

Curated by Codex against the brief "retro chiptune for a Year-10 chemistry RPG, Pokémon Gen 2 / early FF flavour, free-to-use, loops cleanly". All 12 source URLs return HTTP 200 (verified 2026-05-13). License mix: **9 × CC0**, **3 × CC-BY** (slots 1, 2, 8 — attribution block at the bottom).

| Slot | Track | Artist | URL | Licence | Dur | Loops |
|---|---|---|---|---|---:|---|
| 1. Title | RPG Title Theme | Tauredian | https://opengameart.org/content/rpg-title-theme | CC-BY 3.0 | 3:44 | Yes |
| 2. World map | Overworld Select – 8-bit Gameboy Track | Wolfgang_ / Ted Kerr | https://opengameart.org/content/overworld-select-8-bit-gameboy-track | CC-BY 4.0 | 1:22 | Yes |
| 3. Overworld R1 (Elemental Reaches) | Flowerbed Fields [Loop] | Zane Little Music | https://opengameart.org/content/flowerbed-fields-loop | CC0 | 1:45 | Yes |
| 4. Overworld R2–R4 | Future Power BGM loop | request | https://opengameart.org/content/future-power-bgm-loopable-synthy-adventure | CC0 | 2:00 | Yes (intro+loop files) |
| 5. Overworld R5–R7 | Spooky Dungeon | Memoraphile / You're Perfect Studio | https://opengameart.org/content/spooky-dungeon | CC0 | 0:31 | Yes (seamless) |
| 6. Overworld R8 (Equilibrium's Heart) | Haunting Chiptune Loop [Void Estate] | Zane Little Music | https://opengameart.org/content/haunting-chiptune-loop-void-estate | CC0 | 1:26 | Yes |
| 7. Normal battle | 8-Bit Battle Loop | Wolfgang_ | https://opengameart.org/content/8-bit-battle-loop | CC0 | 0:26 | Yes |
| 8. Mini-boss | Their Spears Fell Like Rain | request | https://opengameart.org/content/their-spears-fell-like-rain-loopable-chiptune-battle-theme | CC-BY 4.0 | 1:51 | Yes (intro+loop files) |
| 9. Region boss | Chiptune Battle Music | pmiller | https://opengameart.org/content/chiptune-battle-music | CC0 | 2:32 | Yes (loop ~0:07.5) |
| 10. Final boss | 8-bit Danger!! Strong Boss | HydroGene | https://opengameart.org/content/8-bit-danger-strong-boss | CC0 | 2:13 | Yes (seamless) |
| 11. Shrine / healing | Shrine | yd | https://opengameart.org/content/shrine | CC0 | 0:54 | Yes |
| 12. Ending / credits | Keep your dream alive! | congusbongus | https://opengameart.org/content/keep-your-dream-alive-seamless-loop | CC0 | 1:13 | Yes (seamless) |

## Attribution (CC-BY tracks only)
"RPG Title Theme" — Tauredian — https://opengameart.org/content/rpg-title-theme — CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
"Overworld Select – 8-bit Gameboy Track" — Wolfgang_ / Ted Kerr — https://opengameart.org/content/overworld-select-8-bit-gameboy-track — CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
"Their Spears Fell Like Rain" — request — https://opengameart.org/content/their-spears-fell-like-rain-loopable-chiptune-battle-theme — CC-BY 4.0

## Verdict

**Approved to download.** Notes for when we wire it in:
- **Slots 5 (`Spooky Dungeon`, 0:31) and 7 (`8-Bit Battle Loop`, 0:26) are very short.** They'll loop tight; if either feels repetitive in playtest, swap to a backup (Slot 5 alt: `void_estate_haunted_arcade`; Slot 7 alt: `Chiptune Battle Music` — though that's already slot 9, so use `Rin's Theme` instead).
- **Slot 10 (final boss) is the weakest match** by Codex's own admission — `Danger!! Strong Boss` is loop-safe but not "full epic"; if it lands flat in playtest, try the backup `The King of Hell (Final Boss Theme)` (more dramatic, but check loop-cleanness manually).
- All other slots look solid.

## Next step

The list is just metadata. To actually use the tracks we need to:
1. Download the OGG/MP3s from each URL.
2. Normalise (96–128 kbps OGG mono is plenty for chiptune) and rename consistently → `public/assets/audio/<slot>.ogg`.
3. Add entries to `src/content/data/assetManifest.json`'s `audio` block.
4. Implement a `MusicManager` (singleton, fade between tracks, respects a settings volume slider).
5. Wire scene → track mapping (TitleScene, WorldMapScene, OverworldScene per region, BattleScene per enemy role, HealingSpringScene / ChallengeShrineScene, EndingScene).
6. Add a "Music volume" toggle in MenuScene → Settings.

Steps 4–6 are pure code work (sonnet, ~1 session). Step 1–3 needs human-on-keyboard (downloads + attribution decisions).
