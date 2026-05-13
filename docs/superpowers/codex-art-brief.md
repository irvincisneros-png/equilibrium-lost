# Equilibrium Lost — Codex DALL·E 3 Art Brief

**Goal:** Replace the procedural placeholder PNGs in `public/assets/images/` with proper, cohesive game art generated via DALL·E 3 (or comparable). This brief is structured so Codex (or any agent with image-generation access) can drive the work batch-by-batch and drop results back into the exact asset paths the game already loads.

The game already has a complete asset manifest at `src/content/data/assetManifest.json` with **every key, target path, exact pixel dimensions, and a placeholder colour** that hints at the intended palette per asset. Treat that manifest as the authoritative spec for *what* needs to exist and *at what size*. This brief defines *style* and *prompt scaffolding*.

---

## 1. Global art direction

**One-line pitch:** *Hand-painted JRPG storybook meets chemistry-fantasy. Think early Octopath Traveler / Sea of Stars / Chained Echoes — painterly 2D, warm lighting, readable silhouettes, alchemical iconography woven into landscape and creature design.*

### House style — apply to every asset

- **Medium:** Painterly 2D illustration. Visible brushwork, soft edges, no harsh outlines. Avoid: "vector," "flat," "cel-shaded anime," "pixel art," "3D render," "low poly," "isometric."
- **Lighting:** Cinematic, single dominant light source with warm-cool colour contrast. Subtle rim light on characters. Atmospheric depth (slight fog/glow in midground).
- **Palette:** Each region has its own palette (see §3). Across all assets, lean toward jewel tones + warm neutrals; avoid muddy greys and pure black.
- **Composition for sprites:** Subject centred, generous negative space, transparent background (PNG alpha). No ground shadow baked in (the engine handles that).
- **Composition for tilesets/backgrounds:** Seamless edges where the manifest says so (tilesheets); painterly horizon-line for battle backgrounds.
- **Theme weave:** Every asset should carry chemistry imagery somewhere — atoms, beakers, bond lines, crystalline lattices, vapour, ember-glow, pH droplets. Make it feel like a world where chemistry IS magic, not a science-classroom overlay.
- **No text, no UI, no watermark, no signature** in any image.

### Negative prompt (append to every prompt)

```
no text, no letters, no watermark, no signature, no UI, no border, no frame,
no pixel art, no 3D render, no anime cel-shading, no photographic realism,
no harsh outlines, no muddy palette, no modern technology, no firearms
```

---

## 2. Workflow for Codex

For each asset:

1. Read its entry in `src/content/data/assetManifest.json` → note the **`key`**, **target file path**, **`w` × `h`**, and **`color`** (palette hint).
2. Find that asset in the relevant section of this brief (§4–§9) for its **subject prompt**.
3. Compose the full DALL·E prompt as:
   `{HOUSE_STYLE_PREAMBLE} + {SUBJECT_PROMPT} + {REGION_PALETTE_HINT} + {COMPOSITION_NOTE_FOR_SIZE} + {NEGATIVE_PROMPT}`
4. Generate at DALL·E's native resolution, then **resize / crop** to the manifest's exact `w × h` before saving. Maintain aspect ratio; pad with transparent for sprites if needed.
5. Save to the manifest's exact path under `public/assets/images/<filename>.png`.
6. Commit in batches of ~10–20 assets with a message like `art: region 3 enemy sprites (DALL·E)`.
7. After each batch, run `npx tsc --noEmit && npx vitest run && npm run build` to confirm nothing broke (these are static assets — should always pass — but the BootScene listing matters).

**HOUSE_STYLE_PREAMBLE** (paste into every prompt):

```
Painterly 2D JRPG illustration in the style of Octopath Traveler, Sea of Stars,
and Chained Echoes. Hand-painted brushwork, soft edges, cinematic warm lighting
with cool shadows, atmospheric depth, jewel-tone palette, alchemical and
chemistry-fantasy iconography integrated into the design. Readable silhouette,
centred composition, transparent background.
```

---

## 3. Region palettes & themes

The game has 8 regions. Each has a strong thematic identity — match every asset *for that region* to its palette.

| # | Region | Topic | Palette | Mood |
|---|---|---|---|---|
| 1 | **The Elemental Reaches** | atomic structure | misty grey-green, pale gold, soft cyan electron-glow | dawn meadows, floating proton motes, drifting orbital rings |
| 2 | **The Bonding Forge** | bonding | rust-orange, smoulder-red, brass, deep umber | volcanic forge-canyon, molten bond-rivers, anvils carved into cliffs |
| 3 | **Reaction Hollow** | reaction types | charred black, ember-orange, deep crimson, ash-grey | smouldering crater, fissures spitting reagent flame, soot air |
| 4 | **The Balance Halls** | balancing equations | marble white, deep teal, gold filigree | ancient cathedral of giant brass scales, hanging coefficient lanterns |
| 5 | **Catalyst Crags** | reaction rates | quartz-violet, sage, copper-verdigris | wind-carved spires, crystalline catalysts pulsing in cliff faces |
| 6 | **The Acid Wastes** | acids/bases/pH | sickly chartreuse, indigo, bone-white, litmus pink/blue | salt-crusted dunes, pH pools, bleached coral spires |
| 7 | **The Crucible** | energy changes | molten orange, ice-blue, charcoal, white-hot core | half the land glows red-hot, the other is frost-locked; mirror world |
| 8 | **Equilibrium's Heart** | reversible reactions / Le Châtelier | luminous teal, deep purple, silver, gold | reality-warping cathedral floating in still mirror-water, double arrows ⇌ etched into stone |

When generating any asset, **append the region's palette + mood line** to its subject prompt.

---

## 4. Tilesets (8 assets)

**Spec per tileset:** `tiles_<region>` — 64×64 single tile (the engine repeats it). Must tile seamlessly horizontally AND vertically. No directional lighting — flat ambient. Subtle texture, not a single flat colour. **Density and detail are critical** — current placeholders are flat colour, which makes regions look sparse. Add hand-painted grass blades, cracked stone veins, ember sparks, salt crystals, water ripples, etc. — but keep the value range tight so the tile reads as ground, not as a focal element.

For each region, prompt the tileset as:

```
{HOUSE_STYLE_PREAMBLE}
A seamless tileable 64x64 ground texture for {REGION_NAME}: {REGION_PALETTE+MOOD}.
The texture is busy and detailed at the micro level (small {region-specific
details — e.g. "ember-glowing cracks and obsidian shards" for Reaction Hollow})
but maintains a consistent mid-tone value so it reads as walkable terrain, not
as a focal element. Hand-painted, no harsh edges, must tile seamlessly on all 4
sides. Top-down 3/4 perspective.
{NEGATIVE_PROMPT}
```

The 8 tile keys (from manifest):
`tiles_elemental_reaches`, `tiles_bonding_forge`, `tiles_reaction_hollow`, `tiles_balance_halls`, `tiles_catalyst_crags`, `tiles_acid_wastes`, `tiles_the_crucible`, `tiles_equilibriums_heart`

**Optional upgrade (recommended):** Generate a 256×256 *tilesheet* per region with multiple variants (path/grass/edge/decor) — then either pick one tile per region OR extend the tilemap engine to use variant tiles. For now, single-tile is fine — but generate richer textures than the current flat fills.

---

## 5. Battle backgrounds (8 assets)

**Spec:** `bg_battle_<region>` — 1920×896. Full-bleed painted environment. The hero stands lower-left, enemy lower-right (composition should leave both spots visually open — vignette toward centre, big sky/ceiling element up top).

Prompt per region:

```
{HOUSE_STYLE_PREAMBLE}
A wide cinematic 1920x896 battle backdrop for {REGION_NAME}.
{REGION_PALETTE+MOOD}. The horizon sits roughly 1/3 from the bottom, with a
dramatic sky or ceiling feature occupying the top 2/3 ({region-specific —
e.g. "swirling orbital rings of luminous particles drifting through a dawn
sky" for Elemental Reaches}). Foreground stage area is uncluttered, framed
by side elements ({e.g. "obsidian spires and ember-glowing fissures" for
Reaction Hollow}) leaving a clear central battlefield. Cinematic painterly
illustration, atmospheric haze, no characters, no UI.
{NEGATIVE_PROMPT}
```

---

## 6. Enemy sprites

There are ~50 enemy sprites at various sizes (96×96 wilds → 256×256 final boss). Each is named like `enemy_<id>` in the manifest with its target dimensions.

**Universal enemy prompt template:**

```
{HOUSE_STYLE_PREAMBLE}
Front-facing fantasy creature sprite: {SUBJECT_DESCRIPTION}. Painted with
strong silhouette readability for a {WxH} game sprite. {REGION_PALETTE_HINT}.
Pose is menacing but legible — full body visible, slight 3/4 angle, idle
combat stance. Transparent background, no shadow on ground.
{NEGATIVE_PROMPT}
```

Then plug in the per-enemy SUBJECT_DESCRIPTION. Here are starting descriptions for the named bosses & key wilds — extrapolate the rest from the names (the manifest's `label` field is a useful hint):

**Region 1 — Elemental Reaches:**
- `enemy_protium` — A small luminous hydrogen-spirit, single glowing proton-orb suspended in a wisp of electron-haze, soft white-gold light
- `enemy_electrid` — A buzzing cloud of crackling yellow electrons spiralling around an invisible core, lightning-tendrils
- `enemy_shellfracture` — A jagged broken-shell construct of overlapping orbital rings, splintered shards floating in formation
- `enemy_unstable_deuteride` *(mini-boss, 192×192)* — A volatile twin-proton entity with one neutron, pulsing red, fissures of unstable energy
- `enemy_unstable_isotope` *(region boss, 256×256)* — A massive radioactive isotope-lord, three concentric electron rings spinning at different speeds, crimson core, ambient warning glow

**Region 2 — Bonding Forge:**
- `enemy_bond_mote` — A tiny brass spark with two glowing rod-arms that snap into bond shapes
- `enemy_ion_shard` — A crystalline +/− polarised shard, half copper-warm half steel-cool
- `enemy_covalent_wisp` — Twin lavender wisps orbiting a shared electron-pair, intertwined
- `enemy_slag_golem` — Hulking molten-metal humanoid, brass-and-magma plating
- `enemy_unstable_halide` *(mini-boss)* — A halogen-elemental, seven jagged electron-petals around a central reactive nucleus, orange-green glow
- `enemy_sundered_lattice` *(region boss, 256×256)* — A colossal shattered ionic lattice given form, cubic crystal limbs, copper-and-rust palette, fragments orbit it

**Region 3 — Reaction Hollow:**
- `enemy_synthor` — Two-fused-form creature mid-synthesis, half-merged silhouettes
- `enemy_combustix` — A fire elemental with visible C+O₂→CO₂ glyph traces in its smoke
- `enemy_decomposeer` — A decaying figure shedding component parts mid-decomposition
- `enemy_displacid` — A reactive lizard-thing with a displacement-trail behind it
- `enemy_volatile_mixture` *(mini-boss)* — Sloshing multi-chamber alchemical vessel-creature, four reagent colours separated by glass barriers
- `enemy_eternal_flame` *(region boss, 256×256)* — A perpetual self-feeding combustion entity, white-hot core with crimson outer flames

**Region 4 — Balance Halls:**
- `enemy_equilet` — A small floating brass-scale spirit with two pans
- `enemy_coeffix` — A coefficient-imp, numeric glyphs orbiting its head
- `enemy_tilted_flask` — A lopsided alchemical flask-creature, contents spilling
- `enemy_mass_thief` — A shadowy figure smuggling atoms out of an equation
- `enemy_unbalanced_flask` *(mini-boss)* — A larger tilted vessel-titan with reagent overflow staining marble floor
- `enemy_lopsided_equation` *(region boss, 256×256)* — A judge-like marble figure holding wildly unbalanced scales of glowing atoms

**Region 5 — Catalyst Crags:**
- `enemy_sparkrate` — A jittery quartz-crystal sprite vibrating at high frequency
- `enemy_collidon` — A multi-legged collision-creature, motion-blur tendrils
- `enemy_surfax` — A surface-area construct, fractal-broken stone body exposing maximum surface
- `enemy_enzymoid` — A biological enzyme-blob, lock-and-key shapes visible
- `enemy_rate_spike` *(mini-boss)* — A jagged crystal-spire creature pulsing with accelerating rhythm
- `enemy_runaway_reaction` *(region boss, 256×256)* — A self-amplifying catalyst beast, copper-verdigris armour, sparks cascading off in chain reactions

**Region 6 — Acid Wastes:**
- `enemy_litmuse` — A pink/blue duality sprite, half-acid half-base, litmus-paper texture
- `enemy_protolyte` — A hydrogen-ion proton-imp, glowing with positive charge
- `enemy_corrodent` — An acid-dripping reptilian, chartreuse vapour trail
- `enemy_alkalith` — A blocky basic mineral-creature, bone-white with indigo veins
- `enemy_neutraliser` *(mini-boss)* — A neutralisation-reaction made flesh, half corroded half crystallised, salt-droplets forming around it
- `enemy_ph_tyrant` *(region boss, 256×256)* — A towering pH-monarch, half-acid-half-base body, crown of crystalline salts, robes of corrosive vapour

**Region 7 — The Crucible:**
- `enemy_cinderling` — A small ember-creature trailing heat-shimmer
- `enemy_exotherm` — A heat-radiating beast, visible thermal aura
- `enemy_cracklith` — A thermally-cracked stone golem, glowing fissures
- `enemy_endotherm` — A frost-absorbing creature, surrounded by visible cold-draw
- `enemy_flashpoint` *(mini-boss)* — A violent ignition-creature at the moment of combustion, white-hot
- `enemy_heat_sink` *(region boss, 256×256)* — A dual-natured titan: one side white-hot molten, the other side ice-frosted; jagged thermal boundary down its centreline

**Region 8 — Equilibrium's Heart:**
- `enemy_flux_wisp` — A drifting reversible-arrow spirit, ⇌ glyph embedded in its luminous form
- `enemy_tilted_scale` — A floating off-balance scale-entity, both pans glowing with reagents
- `enemy_reverse_eddy` — A current-reversing water-spirit, time-flowing-both-ways visual
- `enemy_closed_vessel` — A sealed equilibrium-flask creature, reaction perpetually balancing inside its transparent body
- `enemy_forward_drift` *(mini-boss)* — A Synthesis-affinity entity made of converging reagent streams, pulled toward an unseen forward state, teal-and-purple flame
- `enemy_great_imbalance` *(final boss, 256×256)* — A colossal world-breaking equilibrium-tyrant, central scale-of-creation tilted catastrophically, gold-and-silver robes shredded by reagent storm, twin orbiting reactant/product moons, sense of cosmic stakes

**"_half" sprites** (e.g. `enemy_shellfracture_half`) are the "wounded/sundered" alternate sprites used mid-battle when an enemy splits or transforms — generate as a damaged version of the parent (e.g. half-form, fragmented, missing pieces).

---

## 7. Hero portraits (12 assets, 3 classes × 2 stages × 2 views)

Three classes, each with two evolution stages, each in **overworld** (64×96, side-view walking sprite) and **battle** (192×192, front-view combat pose) variants.

### Classes

- **Pyron** (combustion specialist) — Stage 0 "Pyron": young pyromancer-alchemist, leather-and-brass gear, smouldering gauntlets, ember-red hair. Stage 1 "Pyrochemist": evolved, brighter orange/gold robes, crown of suspended flame-runes, more battle-worn.
- **Aqualis** (solvent/dissolution) — Stage 0 "Aqualis": young water-alchemist, indigo-and-silver robes, glass-vial bandolier, calm eyes. Stage 1 "Solvent Adept": evolved, flowing cerulean cloak that ripples like liquid, glowing-glass focus orb.
- **Ionix** (charge/ionic) — Stage 0 "Ionix": young ionic-mage, violet-and-black, copper circlet with crackling charge between prongs, lean. Stage 1 "Nucleon": evolved, regal purple-and-electric-cyan, suspended ion-rings orbiting their shoulders.

### Prompt template

```
{HOUSE_STYLE_PREAMBLE}
{CLASS_DESCRIPTION_AT_STAGE_N}, full body, {overworld: 3/4 side-angle walking
pose, simplified detail for 64x96 sprite | battle: front-facing combat-ready
pose, full detail for 192x192 portrait}. Painterly JRPG character art,
expressive face, clear silhouette, alchemical chemistry-fantasy aesthetic.
Transparent background.
{NEGATIVE_PROMPT}
```

---

## 8. NPC portraits (~30 assets)

All NPC overworld sprites are 64×96. The manifest's `label` field hints at the role (Pr = Professor, Ar = Archivist, Sk = Shrinekeeper, etc.). NPCs include:

- **Region scholars** (lesson-givers): Professor Bohrlin (R1, Bohr-themed atom-physicist), Smith Valentia (R2, bonding-smith), Alchemist Vera (R3, reaction-alchemist), Archivist Pollux (R4, equation-scholar), Kineticist Vasco (R5), Apothecary Vitra (R6), Thermologist Calor (R7), Equilibrist Lethe (R8)
- **Region archivists/secondaries**: Archivist Mendel (R1), Lorekeeper Octet (R2, octet-rule themed), Pyrologist Ignis (R3), Weighmaster Libra (R4), Chemurge Sela (R5), Salter Mordant (R6), Forgemaster Pyra (R7), Warden Haldane (R8)
- **Shrinekeepers** (Challenge Shrine NPCs): Shrinekeeper Quanta (R1), Mortar (R2), Cinder (R3), Scale (R4), Tally (R5), Litmus (R6), Ember (R7), Cyra (R8)
- **Shopkeepers** (the v0.15.0 vendors, one per region): `vendor-mara` (R1, friendly trader with brass-and-leather satchel), `merchant-rho` (R2, gruff bonding-forge supplier), `trader-kira` (R3, smoky-cloaked reagent peddler), `vendor-theron` (R4, polished marble-merchant), `merchant-vex` (R5, crystal-bedecked rate-trader), `trader-osh` (R6, hooded acid-pack peddler), `vendor-brix` (R7, fire-forged armourer), `merchant-mira` (R8, ethereal silver-robed final-region merchant)

Per NPC, write a 1-line description matching the name + role + region palette. Prompt template:

```
{HOUSE_STYLE_PREAMBLE}
{NPC_DESCRIPTION}, full body, 3/4 side-angle standing pose for a 64x96
overworld sprite. Painterly JRPG NPC art, distinctive silhouette, clear
personality through pose and props, {REGION_PALETTE_HINT}. Transparent
background.
{NEGATIVE_PROMPT}
```

**Bonus — Vendor "portrait" panels for shop UI** *(new requirement from gameplay polish pass)*: The ShopScene UI shows a larger vendor portrait on the left when shopping. If Codex has bandwidth, generate a second variant for each of the 8 shopkeepers at **320×400** (`npc_vendor_<id>_portrait.png` — new asset, not yet in manifest; add the key after generating). This is a chest-up shoulder portrait with expressive face for the shop greeting. Update the manifest in the same commit that introduces the new key.

---

## 9. Title screen & worldmap

- `title_art` (1920×800) — Full painted title-screen splash showing all 8 regions hinted at across the canvas, dramatic central focal point (the equilibrium scale floating above a shattered cathedral). No text — the title text overlays in-engine.
- `worldmap` (1920×1280) — Top-down painted map of Æquor's continent with all 8 region zones visually distinguished by their palettes; rivers/paths connect them; subtle parchment edge feel without literal scroll borders.

---

## 10. Status-effect icons (6 assets)

All 48×48. Stylised circular alchemical glyph badges, painterly but iconic — readable at small size.

- `icon_status_oxidised` — Rusted iron-bloom glyph, copper-brown
- `icon_status_dissolved` — Bubbling green dissolution swirl
- `icon_status_catalysed` — Gold spinning catalyst rune
- `icon_status_precipitated` — Falling white crystalline shards
- `icon_status_endothermicChill` — Cyan frost-bloom
- `icon_status_combusting` — Orange ignition burst

```
{HOUSE_STYLE_PREAMBLE}
A circular 48x48 status-effect icon: {EFFECT_DESCRIPTION}. Painterly alchemical
glyph style, readable at small size, single dominant colour with painted
highlights, subtle inner glow. Centred on transparent background.
{NEGATIVE_PROMPT}
```

---

## 11. UI elements (2 assets, low priority)

- `ui_textbox` (64×64) — A single corner-piece for a 9-slice textbox frame: ornate alchemical brass-and-parchment corner, expandable. (Or generate a full pre-built 9-slice spritesheet if Codex prefers — note any new file structure in a manifest update.)
- `ui_chainmeter` (64×64) — A meter segment graphic for the chain/combo meter: glowing reagent-vial fill style.

---

## 12. Delivery / batching plan for Codex

Suggested commit order (smallest visible wins first):

1. **Batch A — Title + worldmap** (2 assets) — biggest visible impact for menu/world screens.
2. **Batch B — Hero portraits, battle-size only** (6 assets) — players see these every fight.
3. **Batch C — Region 1 full set** (tile + battle bg + 7 enemies + 3 region NPCs + shopkeeper + shop portrait = ~13 assets) — ship a full-region polish so you can compare before/after, then decide whether to continue.
4. **Batch D–J** — Regions 2–8 in the same pattern as Batch C.
5. **Batch K — Hero overworld sprites + remaining NPC portraits + status icons + UI elements** — polish pass.

After each batch: `npm run build` → visual smoke-test in dev → commit `art: <batch description> (DALL·E)` → push.

---

## 13. Acceptance criteria

- Every asset listed in `assetManifest.json` has a real PNG at its declared path with correct `w × h`.
- BootScene loads without 404s.
- Visual coherence: a screenshot from any single region should *feel like the same world* across tile, background, enemies, NPCs.
- No text-in-images, no DALL·E watermark artefacts, no JPEG block-compression on PNGs.
- Transparent backgrounds on all sprite-type assets (heroes, enemies, NPCs, icons).

---

## 14. If anything is ambiguous

Make the call that best serves visual cohesion within the region's palette. Don't ask — generate, commit, and iterate. The procedural placeholders are the floor — anything painterly that respects palette + dimensions is an upgrade.
