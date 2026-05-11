# Equilibrium Lost

A turn-based, pixel-art chemistry RPG for NSW Year 10 Chemistry (Stage 5). Static web app, deployed to GitHub Pages, plays offline, saves in `localStorage`.

## Run
- `npm install`
- `npm run dev` — local dev server
- `npm test` — unit tests (pure logic engines)
- `npm run build` — static build into `dist/`

## Editing content (no code)
All game content is JSON under `src/content/data/`. Questions are one file per topic under `src/content/data/questions/` — teachers can add/edit/reorder/replace questions there. See `public/assets/spec.md` for the art spec.

## Architecture
Pure-TS engines (`src/systems/`) hold all game logic and are unit-tested; Phaser scenes (`src/scenes/`) render only. See `docs/superpowers/specs/2026-05-11-equilibrium-lost-design.md`.
