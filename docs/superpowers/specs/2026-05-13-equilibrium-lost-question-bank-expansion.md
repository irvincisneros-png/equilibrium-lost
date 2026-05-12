# Spec — Question-Bank Expansion (all 7 topics → ≈270 each)

**Date:** 2026-05-13
**Branch:** `feat/question-banks`
**Status:** approved (design), pending spec review

## Goal

Each of the 7 topic question banks in `src/content/data/questions/<topic>.json` currently holds ~45 items
(atomic-structure: 60) and recycles a small set of ideas. Grow each bank to **≈270 genuinely distinct
questions** — broader syllabus coverage, varied contexts/numbers/phrasings, real Year-10 misconceptions
as distractors — while keeping the existing schema and `validateQuestion` rules, fixing the answer-position
skew (R5/R6/R7 banks lean heavily on "B"), and putting a usable hint on every item.

Pure content work. No changes to `QuestionDef`, `QuizEngine`, `QuizPanel`, `loadGameContent`, or any scene.
One new regression test asserting per-bank size + a roughly-even answerIndex spread.

## The 7 banks

| Topic (`topic` field) | File | ID prefix | Now | Target | balanceEquation target |
|---|---|---|---|---|---|
| `atomic-structure` | `atomic-structure.json` | `as` | 60 | ≈270 | 0–2 (keep the existing 2 if still valid; this topic barely uses it) |
| `bonding` | `bonding.json` | `b` | 45 | ≈270 | 6–10 |
| `reaction-types` | `reaction-types.json` | `rt` | 45 | ≈270 | 6–10 |
| `balancing-equations` | `balancing-equations.json` | `be` | 45 | ≈270 | **50–70** (this topic's core skill) |
| `reaction-rates` | `reaction-rates.json` | `rr` | 45 | ≈270 | 3–6 |
| `acids-bases` | `acids-bases.json` | `ab` | 45 | ≈270 | 6–10 (neutralisation equations) |
| `energy-changes` | `energy-changes.json` | `ec` | 45 | ≈270 | 3–6 |

"≈270" means **250–290 inclusive** — the regression test floor is **≥250 per bank**.

## Schema (unchanged — repeated here so generators don't have to go read it)

Each item is one JSON object in the bank's top-level array:

```jsonc
{
  "id": "as-061",                 // string, unique within the bank; keep existing IDs; new ones continue the
                                  //   prefix sequence, zero-padded to 3 digits (as-061 … as-NNN)
  "topic": "atomic-structure",    // MUST equal the bank's topic string exactly (with hyphens)
  "difficulty": 1,                // 1 | 2 | 3  (the only allowed values)
  "format": "mcq",                // "mcq" | "balanceEquation"
  "prompt": "…",                  // non-empty string; the question text shown to the player

  // --- if format === "mcq": ---
  "options": ["…","…","…","…"],   // EXACTLY 4 non-empty strings
  "answerIndex": 2,               // integer 0..3 — index of the correct option

  // --- if format === "balanceEquation": ---
  "equation": {
    "reactants": [ { "formula": "H2", "coeff": 2 }, … ],   // ≥1 term; coeff is a POSITIVE INTEGER ≥1 and is the CORRECT answer
    "products":  [ { "formula": "H2O", "coeff": 2 }, … ]   // ≥1 term; same rules
  },
  // (no options/answerIndex for balanceEquation)

  "explanation": "…",             // non-empty; ONE line shown after a wrong answer — say WHY, briefly
  "hint": "…"                     // non-empty; shown in Study Mode — a nudge, NOT the answer
}
```

**Text encoding:** `prompt`, `options`, `explanation`, `hint` strings MAY use Unicode subscripts (`₀₁₂₃₄₅₆₇₈₉`), the arrow `→`, `Δ`, `°`, `·`, en-dashes etc. for readability (existing data does, e.g. `H₂O`, `CO₂`) — but the `equation.reactants[].formula` / `equation.products[].formula` fields MUST stay plain ASCII (`H2O`, `CO2`, `H2SO4`, `Mg(OH)2`, `NH4NO3`) for consistency with existing data. **balanceEquation prompts must be distinct from one another** — name the reaction or context ("Balance the combustion of methane:", "Magnesium ribbon burns in air — balance the equation:", "Find the coefficients: __ Zn + __ HCl → __ ZnCl₂ + __ H₂"), never a bare repeated "Balance this equation."

`validateQuestion` (in `src/content/schema.ts`) is the contract. A malformed item is **skipped with a warning**, never a hard error — but for this milestone any `validateQuestion` warning on any item is a defect to fix. Hard rules that bite:

- `difficulty` is `1`, `2`, or `3` — nothing else (no `0`, no `4`, not a string).
- mcq → `options.length === 4`, every option a non-empty string, `answerIndex` an integer in `0..3`.
- balanceEquation → `equation.reactants` and `equation.products` each a non-empty array of `{formula:string, coeff:number≥1}`. **The coefficients you write ARE the answer**, so they must actually balance the equation, and they should be the *lowest-integer* set (don't write `2 H2 + 1 O2 → 2 H2O` as `4,2,4`).
- `topic` must equal the bank's topic string. `id` unique in the bank.
- `prompt`, `explanation`, `hint` all non-empty strings.

The `QuizPanel` UI: mcq renders as A/B/C/D buttons (the option strings, in order — so to "move" a correct answer you physically reorder the array and update `answerIndex`). balanceEquation renders a `[▲] n [▼] formula` stepper per term (`coeff` capped at **9** in the UI — do not author a balanceEquation whose correct coeff is >9). Subscripts: write formulas plainly (`H2O`, `CO2`, `H2SO4`, `Mg(OH)2`, `NH4+`) — the panel shows them as-is, that's fine; be consistent.

## Per-bank quality bar (every bank must meet ALL of these)

1. **Size:** 250–290 items.
2. **Difficulty mix:** roughly d1 ≈ 100, d2 ≈ 100, d3 ≈ 70 — each band within ±15% of that, and each band has ≥ 30 items (so the "≥5 each" floor is trivially met and `QuizEngine`'s difficulty-widening always has stock).
   - d1 = direct recall / one-step lookup ("what is the charge of a proton?", "name the gas given off when a metal reacts with acid").
   - d2 = apply / one calculation / classify a new example ("an atom has 11 p and 12 n — mass number?", "is `Zn + CuSO4 → ZnSO4 + Cu` displacement or combustion?").
   - d3 = multi-step, compare two scenarios, explain *why*, spot the subtle error, harder balance ("which change would BOTH speed up the reaction AND give the same amount of product?").
3. **answerIndex spread (mcq only):** across the bank's mcq items, each of `0,1,2,3` is the answer for **20–30%** of them. (Pre-existing items that are out of band get their option array reordered + `answerIndex` updated to fix it. This is the explicit fix for the R5/R6/R7 "everything is B" problem — and atomic-structure also currently leans on index 1; fix it too.)
4. **balanceEquation count:** per the table above; never an `equation` term with correct `coeff` > 9; every balanceEquation actually balances at lowest integers.
5. **Hint on every item** — a genuine nudge ("count protons + neutrons", "Group number ≈ valence electrons", "which side of the arrow are the products?"), never a restatement of the answer, never empty.
6. **Explanation on every item** — one line, states the reasoning, not just "Correct answer: C".
7. **Reading level:** NSW Stage 5 (Years 9–10) science. Short sentences. Define jargon in-line the first time it's load-bearing in a question ("a catalyst (something that speeds a reaction without being used up)…" — but don't do this in *every* question, only where the term is the thing being tested obliquely). Metric units. Arithmetic only — no logs, no algebra beyond rearranging a one-step formula. Australian spelling ("neutralise", "sulfur" per IUPAC/ACARA, "colour", "fibre").
8. **Genuine diversity, not padding:** allocate questions across the topic's **concept map** (below). Vary: the specific substances/elements/numbers, the context (lab, industrial, everyday, biological, geological, historical), the question archetype (recall / calculate / classify / predict-the-product / compare-two-cases / interpret-a-described-diagram / spot-the-error / odd-one-out / true-or-false-which-statement / "a student says X — what's wrong"), and *which* misconception each wrong option embodies. Two questions that test the same fact with only a swapped element or number do not both count — small variation is fine for *practice volume* within a concept cell, but each concept cell must show real range of archetype and context, not 25 copies of one template.
9. **Distractors are plausible & instructive** — wrong options should be the answers a student who holds a specific misconception would pick, or a near-miss (off-by-one, swapped reactant/product, right idea wrong magnitude), not obvious nonsense. Avoid "none of the above" / "all of the above" unless genuinely the best fit (rare).
10. **No duplicate prompts** within a bank (normalised: lowercase, collapse whitespace, strip punctuation) — and no near-duplicate of an existing kept item.
11. **Self-consistent & correct chemistry** — every fact accurate at Year-10 level; every calculation checks out; every balanceEquation balances. When the syllabus simplifies (e.g. "shell 3 holds 8" for the first 20 elements), follow the NSW Stage-5 simplification, don't "correct" it to the university version.

## Treatment of existing items

Per Q3=(a): keep existing questions, **but** a generator may rewrite/replace an existing item that is weak,
near-duplicate, mis-levelled, or has a hint that gives away the answer; and it **must** re-spread `answerIndex`
across the whole bank by physically reordering option arrays. Keep the existing `id` on any item that is kept
or merely re-ordered/re-hinted; only brand-new items get new IDs. Net result: the *entire* bank (old + new)
meets the quality bar above — not just the additions.

## Concept maps (the coverage grid for generation)

For each topic: the concept cells to spread ~270 questions across, the misconceptions to mine for distractors,
and notes on where balanceEquation / harder d3 items belong. Budgets are approximate — hit the cells, don't
obsess over exact counts.

### 1. `atomic-structure` (Region 1 — "The Elemental Reaches"), prefix `as`, target ≈270
Concept cells:
- **Subatomic particles**: proton/neutron/electron — charge, relative mass, location (nucleus vs shells). (~30)
- **Atomic number & mass number**: Z = protons = electrons in a neutral atom; A = protons + neutrons; deduce one from the others; read `^A_Z X` notation described in words. (~35)
- **Isotopes**: same Z, different A; same chemical behaviour, different mass; examples (C-12/13/14, Cl-35/37, H-1/2/3); why relative atomic masses aren't whole numbers. (~30)
- **Relative atomic mass (weighted average)**: simple two-isotope weighted-mean calculation (e.g. Cl: 75% × 35 + 25% × 37); reading abundances. (~20, mostly d2/d3)
- **Electron configuration / shells (first 20 elements)**: shell capacities 2, 8, 8; write the configuration (2,8,1 etc.); deduce element from configuration; "how many shells / how many in the outer shell". (~35)
- **Valence (outer-shell) electrons & group**: group number ↔ valence electrons; why Group 18 is unreactive (full outer shell); period number ↔ number of shells. (~30)
- **Ions**: atoms lose/gain electrons to fill the outer shell → +/- ions; predict the charge from group (Group 1→+1, 2→+2, 16→2−, 17→1−); ion vs atom (which changes: electrons, not protons); cation/anion. (~30)
- **The periodic table as a map of structure**: metals (left/centre) vs non-metals (right), reactive metals (Group 1) vs noble gases (Group 18), why elements in a group behave alike (same valence count); locate an element given a clue. (~25)
- **History/models of the atom** (NSW Stage 5 names them lightly): Dalton → Thomson ("plum pudding") → Rutherford (gold-foil, nucleus) → Bohr (shells); what each model added/changed; "mostly empty space". (~20)
- **Atom basics & vocabulary**: element vs compound vs mixture at the particle level (atoms of one kind vs bonded different kinds vs not bonded), "smallest particle of an element", neutral atom, why atoms are neutral. (~15)
Misconceptions to mine: "atomic number = mass"; "isotopes are different elements"; "ions have different numbers of protons"; "electrons are in the nucleus"; "the outer shell always holds 8"; "Group 1 metals are unreactive because they only have 1 electron"; "noble gases have no electrons in the outer shell"; relative atomic mass = number of isotopes / always a whole number; mixing up period and group.
balanceEquation: not natural here — keep the 2 existing ones if they validate and make sense (e.g. they may actually be simple ionic-formula style); otherwise 0 is fine.

### 2. `bonding` (Region 2 — "The Bonding Forge"), prefix `b`, target ≈270
Concept cells:
- **Why atoms bond**: to reach a stable (full) outer shell; "noble-gas configuration". (~20)
- **Ionic bonding**: metal + non-metal; electron *transfer*; oppositely charged ions; electrostatic attraction; lattice (giant ionic structure). (~30)
- **Writing ionic formulae**: combine ions so charges cancel (Na⁺ + Cl⁻ → NaCl; Mg²⁺ + Cl⁻ → MgCl₂; Al³⁺ + O²⁻ → Al₂O₃; with polyatomic ions: NH₄⁺, OH⁻, NO₃⁻, CO₃²⁻, SO₄²⁻ — including brackets, Mg(OH)₂); name ↔ formula. (~35, lots of d2/d3)
- **Covalent bonding**: non-metal + non-metal; electron *sharing*; single/double/triple bonds (H₂, O₂, N₂, H₂O, CO₂, CH₄, NH₃, HCl, Cl₂); "molecule". (~35)
- **Metallic bonding**: lattice of positive ions in a "sea" of delocalised electrons. (~15)
- **Properties from structure** (the big one):
  - ionic: high melting point, brittle, conducts when molten/dissolved (ions free to move) not when solid, often soluble in water. (~25)
  - simple molecular/covalent: low melting/boiling point (weak forces *between* molecules), doesn't conduct (no free charges). (~20)
  - giant covalent (diamond/graphite/silica — NSW touches diamond & graphite): very high melting point; diamond hard & non-conducting; graphite soft, layers, conducts (delocalised electrons). (~20)
  - metallic: conducts (mobile electrons) solid or molten, malleable/ductile (layers slide), high melting point, shiny. (~25)
- **Classify a substance**: given a property set or a formula, say ionic / covalent-molecular / metallic / giant covalent; predict a property from the bond type. (~25, d2/d3)
- **Electron-dot / Lewis ideas described in words** (NSW does dot diagrams): "how many shared pairs in …", "how many electrons does X share". (~15)
Misconceptions: "ionic bonds share electrons / covalent bonds transfer them"; "molecules of NaCl"; "metals are held by ionic bonds"; "covalent substances conduct because they have electrons"; "ionic solids conduct"; "bigger molecule = stronger covalent bond = higher melting point" (it's the *intermolecular* force that's weak); "graphite can't conduct because it's a non-metal"; charges don't cancel when writing formulae.
balanceEquation (6–10): formation reactions that are simple to balance — e.g. `2Na + Cl2 → 2NaCl`, `2Mg + O2 → 2MgO`, `N2 + 3H2 → 2NH3`, `2H2 + O2 → 2H2O`, `4Al + 3O2 → 2Al2O3` — framed as "balance the formation of the ionic/covalent compound".

### 3. `reaction-types` (Region 3 — "Reaction Hollow"), prefix `rt`, target ≈270
NSW Stage 5 reaction types: **combustion, corrosion (slow oxidation), decomposition, precipitation, neutralisation (acid+base), acid + metal, acid + metal carbonate**, plus the general ideas of **synthesis/combination** and **displacement (single & "double"/metathesis)** and **oxidation as gain of oxygen**. Concept cells:
- **Combustion**: fuel + O₂ → oxides (+ energy); complete vs incomplete (CO, soot); hydrocarbon combustion → CO₂ + H₂O; word equations. (~30)
- **Corrosion / slow oxidation**: rusting (iron + oxygen + water → hydrated iron oxide), tarnishing; conditions; it's oxidation. (~20)
- **Decomposition**: one → two or more; thermal decomposition of carbonates (CaCO₃ → CaO + CO₂), of hydrogen peroxide, electrolysis as decomposition; spot a decomposition. (~30)
- **Precipitation**: two soluble ionic solutions → an insoluble solid (the precipitate); recognise from "a solid forms / cloudy"; e.g. silver nitrate + sodium chloride → silver chloride↓. (~25)
- **Acid + metal** → salt + hydrogen gas; which metals react (reactivity series, above hydrogen); the "pop" test; name the salt. (~30)
- **Acid + base (neutralisation)** → salt + water; acid + metal oxide; acid + metal hydroxide. (~25) *(deeper neutralisation lives in the acids-bases bank — here it's "which type of reaction is this?")*
- **Acid + metal carbonate** → salt + water + carbon dioxide; the limewater test for CO₂; e.g. HCl + CaCO₃. (~25)
- **Synthesis / combination**: elements/simple compounds → one product (2H₂ + O₂ → 2H₂O; iron + sulfur → iron sulfide). (~20)
- **Displacement**: a more reactive metal pushes a less reactive one out of its compound (Zn + CuSO₄ → ZnSO₄ + Cu); use the reactivity series to predict if it happens; halogen displacement (Cl₂ + 2KBr → 2KCl + Br₂). (~25, d2/d3)
- **Oxidation/reduction (Stage-5 level: gain/loss of oxygen)**: which substance was oxidised; combustion & corrosion as oxidation; reduction of a metal oxide by carbon. (~20)
- **Classify-the-reaction (mixed)**: given a word or symbol equation, name the type; given the type, pick the example; "which of these is NOT a …". (~30, the workhorse d2 cell)
Misconceptions: "all reactions with oxygen are combustion"; "rusting isn't a chemical reaction"; "precipitate = the liquid"; "acid + metal makes oxygen"; "neutralisation always gives a neutral pH" (only if exact); "displacement happens regardless of reactivity order"; "decomposition needs two reactants"; calling combustion "decomposition" because "it breaks the fuel down".
balanceEquation (6–10): one clean example from several types — combustion of CH₄ (`CH4 + 2O2 → CO2 + 2H2O`) and a simple hydrocarbon, decomposition `2H2O2 → 2H2O + O2`, displacement `Zn + 2HCl → ZnCl2 + H2`, synthesis `2Mg + O2 → 2MgO`, carbonate + acid `CaCO3 + 2HCl → CaCl2 + H2O + CO2` — framed "balance this [combustion/decomposition/…] reaction".

### 4. `balancing-equations` (Region 4 — "The Balance Halls"), prefix `be`, target ≈270
This bank is **balanceEquation-heavy: 50–70 of the ~270 are `format:"balanceEquation"`**; the rest are mcq *about* balancing (conservation of mass, what coefficients mean vs subscripts, "which coefficient goes in the blank", word↔symbol, reading equations). Concept cells:
- **Conservation of mass / why we balance**: atoms aren't created or destroyed; same number of each atom on both sides; mass of products = mass of reactants (closed system); the historical "mass seems to vanish/appear" (gas escaping / O₂ absorbed). (~30 mcq)
- **Coefficients vs subscripts**: a coefficient multiplies the whole formula; you may NOT change subscripts to balance; "2H₂O means how many H / how many O atoms"; count atoms in `3Ca(NO3)2`. (~30 mcq)
- **Word ↔ symbol equations**: translate "magnesium + oxygen → magnesium oxide" to `2Mg + O2 → 2MgO`; read a symbol equation back into words; states (s)(l)(g)(aq) at Stage-5 level (recognise them; not required in the `equation` object). (~25 mcq)
- **"Fill the blank coefficient" (mcq)**: a partly-balanced equation with one coefficient missing → pick it; or "which set of coefficients balances …". (~30 mcq)
- **Is this balanced? (mcq)**: given an equation, yes/no + which atom is wrong. (~20 mcq)
- **Balance it (balanceEquation widget)** — spread across difficulty:
  - *d1 (~20):* one coefficient ≠ 1, small numbers. `2H2 + O2 → 2H2O`, `2Mg + O2 → 2MgO`, `H2 + Cl2 → 2HCl` (1,1,2), `2Na + Cl2 → 2NaCl`, `C + O2 → CO2` (all 1 — still valid, a good "it's already balanced" case but use sparingly), `N2 + O2 → 2NO`.
  - *d2 (~25):* a couple of non-1 coefficients. `CH4 + 2O2 → CO2 + 2H2O`, `2H2O2 → 2H2O + O2`, `2KClO3 → 2KCl + 3O2`, `4Al + 3O2 → 2Al2O3`, `Zn + 2HCl → ZnCl2 + H2`, `CaCO3 + 2HCl → CaCl2 + H2O + CO2` (1,2,1,1,1), `2NaOH + H2SO4 → Na2SO4 + 2H2O`, `Fe + 2HCl → FeCl2 + H2`, `2Fe2O3 + 3C → 4Fe + 3CO2`, combustion of `C2H6`, `C3H8` (C₃H₈ + 5O₂ → 3CO₂ + 4H₂O), photosynthesis `6CO2 + 6H2O → C6H12O6 + 6O2`.
  - *d3 (~15–20):* slightly larger sets but **every coefficient ≤ 9**. `2C4H10 + 13O2 → 8CO2 + 10H2O` — NO, 13 > 9, exclude. Use ones that stay ≤9: `4NH3 + 5O2 → 4NO + 6H2O` — 5 & 6 ok, but 4… all ≤9 ✓; `2Al + 3H2SO4 → Al2(SO4)3 + 3H2`; `3Ca(OH)2 + 2H3PO4 → Ca3(PO4)2 + 6H2O`; `2KMnO4 → K2MnO4 + MnO2 + O2` (2,1,1,1); `Pb(NO3)2 + 2KI → PbI2 + 2KNO3`; `Fe2O3 + 3CO → 2Fe + 3CO2`; `2C2H2 + 5O2 → 4CO2 + 2H2O` (5 ok); `Cu + 4HNO3 → Cu(NO3)2 + 2NO2 + 2H2O` (4 ok). **Generator must verify each balances and max coeff ≤ 9 before including.**
Misconceptions: "you can balance by changing subscripts"; "coefficients change what the substance is"; "mass is lost when a gas is given off"; counting atoms in bracketed/coefficient'd formulae wrong (`3Ca(NO3)2` → forgetting to multiply through); thinking an equation with all-1 coefficients "isn't balanced because there are no numbers"; balancing one element and breaking another.

### 5. `reaction-rates` (Region 5 — "Catalyst Crags"), prefix `rr`, target ≈270 — **also the worst answerIndex skew (B-heavy), fix it**
NSW Stage 5: rate = how fast reactants are used / products formed; collision theory; the four factors **temperature, concentration (and pressure for gases), surface area, catalyst**; measuring rate (gas volume, mass loss, time-to-cloudy, temperature). Concept cells:
- **What is "rate"** & how we measure it: faster = product made / reactant used more quickly; ways to follow a reaction (volume of gas collected, loss of mass on a balance, "disappearing cross"/turbidity, change in colour, pH, temperature); read a described rate graph (steeper = faster; curve flattens when a reactant runs out; flat = finished; two curves compared). (~40, lots of "interpret the graph described in words" d2/d3)
- **Collision theory basics**: particles must collide, with enough energy (≥ activation energy) and the right orientation; "more frequent and/or more energetic collisions → faster". (~25)
- **Temperature**: ↑T → particles move faster → collide more often AND more collisions have ≥ Eₐ → much faster. Real contexts: food in the fridge, light sticks in warm vs iced water, summer vs winter. (~30)
- **Concentration / pressure**: ↑concentration (or, for gases, ↑pressure / ↓volume) → particles closer → collide more often → faster. Contexts: dilute vs concentrated acid, fanning a fire (more O₂). (~30)
- **Surface area (particle size)**: powder vs lump → more surface exposed → more collisions per second → faster. Contexts: chewing food, sawdust/flour explosions, indigestion tablet whole vs crushed, kindling vs logs. (~30)
- **Catalysts**: speed a reaction without being used up; provide a lower-activation-energy path; not in the equation / recovered unchanged; enzymes as biological catalysts; catalytic converters; manganese dioxide on hydrogen peroxide. (~30)
- **Combine factors / predict & explain**: given a change, does rate go up/down and *why* (link to collisions); "which change would speed it up the most"; "which change does NOT affect rate"; "which two changes both …"; design a fair test (change one factor, keep others constant). (~40, the d2/d3 workhorse)
- **Rate vs amount/yield**: a faster reaction doesn't make *more* product (same reactants → same amount), it just gets there sooner; the graph reaches the same plateau, just sooner; catalyst/surface area/concentration affect rate, the *amount* depends on amount of limiting reactant. (~25, an important d3 cell — many students get this wrong)
- **Activation energy / energy profile (light touch — deeper in energy-changes)**: minimum energy to react; catalysts lower it; only collisions above it succeed. (~15)
Misconceptions (and the answer-position fix): "a catalyst is used up"; "a catalyst is a reactant"; "higher temperature makes more product"; "powder reacts faster because it weighs less / has more mass"; "stirring is a separate magic factor" (it's really keeping concentration even / surface contact); "rate stays constant through a reaction"; "the flat part of the graph means the reaction is slow" (it's *finished*); "concentration only matters for the acid"; "you can speed it up by adding more product"; "increasing pressure speeds up reactions of solids/liquids". When fixing the existing items, **re-order option arrays so each of A/B/C/D ends up the answer 20–30% of the time** — don't just renumber.

### 6. `acids-bases` (Region 6 — "The Acid Wastes"), prefix `ab`, target ≈270 — **also B-heavy, fix it**
NSW Stage 5: properties of acids & bases, pH scale, indicators, neutralisation, the three reactions of acids (metal, base/oxide/hydroxide, carbonate), strong vs weak (qualitative), dilution, everyday/industrial acids & bases, safety. Concept cells:
- **Properties of acids**: sour, corrosive, turn blue litmus red, pH < 7, react with reactive metals (→ salt + H₂), with bases (→ salt + water), with carbonates (→ salt + water + CO₂); common acids HCl, H₂SO₄, HNO₃, ethanoic/acetic (vinegar), citric, carbonic. (~30)
- **Properties of bases & alkalis**: bitter, slippery/soapy feel, turn red litmus blue, pH > 7; **base vs alkali** (an alkali is a soluble base); common bases NaOH, KOH, Ca(OH)₂ (limewater/slaked lime), NH₃/ammonia solution, Mg(OH)₂ & CaCO₃ (antacids), metal oxides/hydroxides/carbonates. (~30)
- **The pH scale**: 0–14; 7 = neutral; <7 acidic, >7 basic/alkaline; lower pH = more acidic / "stronger" in everyday terms; each step is ×10 in acidity (qualitative — "pH 3 is ten times more acidic than pH 4"); place everyday substances (lemon juice ~2, vinegar ~3, rain ~5–6, pure water 7, blood ~7.4, baking soda ~9, ammonia cleaner ~11, oven cleaner ~13). (~35)
- **Indicators**: litmus (red/blue), universal indicator (full colour range → approximate pH), phenolphthalein (colourless ↔ pink), methyl orange; red cabbage as a natural indicator; what colour in acid vs base vs neutral. (~30)
- **Neutralisation**: acid + base → salt + water; the ionic essence H⁺ + OH⁻ → H₂O; pH moves toward 7; only *exactly* matched amounts give pH 7; everyday examples (antacid for indigestion, lime on acidic soil, toothpaste on mouth acids, baking soda on a bee/ant sting or an acid spill, treating bee vs wasp stings). (~30)
- **Naming salts**: acid → which salt anion (hydrochloric→chloride, sulfuric→sulfate, nitric→nitrate, ethanoic→ethanoate, carbonic→carbonate, phosphoric→phosphate); metal/base → which cation; predict the salt from acid + base/metal/carbonate ("sulfuric acid + sodium hydroxide → sodium sulfate + water"). (~30, d2/d3)
- **Acid + metal**: → salt + hydrogen; the pop test; reactivity matters (no reaction with Cu, Ag, Au); rate ↑ with concentration/temperature/surface area (ties to rates). (~20)
- **Acid + metal oxide / hydroxide**: → salt + water (these are bases). Acid + **carbonate / hydrogencarbonate**: → salt + water + CO₂ (limewater turns milky); fizzing. (~25)
- **Strong vs weak / concentrated vs dilute (qualitative)**: strong acid = fully ionised (HCl, H₂SO₄) vs weak = partly (ethanoic, citric, carbonic) — at Stage-5 this is "strong acids are more reactive / lower pH at the same concentration"; **don't confuse "strong" with "concentrated"** (concentration = how much per volume; strength = how fully it ionises) — a dilute strong acid vs a concentrated weak acid. (~25, good d3 cell)
- **Safety & everyday/industrial**: dilute when mixing ("add acid to water, not water to acid"), wear goggles, wash spills with lots of water then neutralise; uses — sulfuric acid (batteries, fertiliser), HCl (cleaning, stomach), NaOH (drain/oven cleaner, soap), Ca(OH)₂ (treating soil/lakes), ammonia (cleaners, fertiliser); acid rain (SO₂/NOₓ → sulfuric/nitric acid, effects on stone & lakes). (~25)
Misconceptions (and the position fix): "strong acid = concentrated acid"; "all acids are dangerous / no acids are safe to eat" (citric, ethanoic); "neutralisation always = pH 7"; "a base and an alkali are different things entirely"; "pH 6 is twice as acidic as pH 7" (it's ten times); "bases aren't corrosive" (NaOH very much is); "litmus goes green in acid"; "salt" means only NaCl; "acid + metal gives oxygen"; "the higher the pH the more acidic". Same answerIndex re-spread requirement as reaction-rates.
balanceEquation (6–10): neutralisations & acid reactions that balance cleanly with coeffs ≤9 — `HCl + NaOH → NaCl + H2O` (all 1), `H2SO4 + 2NaOH → Na2SO4 + 2H2O`, `2HCl + Ca(OH)2 → CaCl2 + 2H2O`, `2HCl + CaCO3 → CaCl2 + H2O + CO2`, `Zn + 2HCl → ZnCl2 + H2`, `Mg + 2HCl → MgCl2 + H2`, `2HCl + Mg(OH)2 → MgCl2 + 2H2O`, `H2SO4 + CaCO3 → CaSO4 + H2O + CO2`, `3HCl + Al(OH)3 → AlCl3 + 3H2O` (3 ok), `2HNO3 + Ca(OH)2 → Ca(NO3)2 + 2H2O`.

### 7. `energy-changes` (Region 7 — "The Crucible"), prefix `ec`, target ≈270
NSW Stage 5: exothermic vs endothermic, energy diagrams/profiles, bond breaking (in, endothermic) vs bond making (out, exothermic), activation energy, catalysts lower Eₐ, conservation of energy, everyday examples, simple "is the surroundings hotter or colder?" reasoning. Concept cells:
- **Exothermic reactions**: release energy to the surroundings → temperature rises; ΔH negative (sign optional at Stage 5 — "energy released"); examples: combustion, neutralisation, respiration, most oxidations, hand warmers (iron oxidation, or crystallising sodium acetate), explosives, self-heating cans, adding water to quicklime. (~35)
- **Endothermic reactions**: absorb energy from the surroundings → temperature falls; ΔH positive; examples: thermal decomposition (e.g. CaCO₃ → CaO + CO₂), photosynthesis, dissolving ammonium nitrate (instant cold packs), citric acid + sodium hydrogencarbonate, electrolysis, "sherbet" cooling the tongue. (~35)
- **Tell which from observations**: "the beaker got warm/cold" → exo/endo; "energy was needed to keep it going" → endo; a cold pack vs a hand warmer; classifying a described experiment. (~30)
- **Energy profile diagrams (described in words)**: reactants level, products level, the activation-energy "hump"; exothermic → products *below* reactants (energy released = the drop); endothermic → products *above* reactants; "what does the height of the hump represent" (Eₐ); "what does the difference between reactant and product levels represent" (energy released/absorbed, ΔH); reading a described diagram to say exo/endo and compare two profiles. (~40, the big d2/d3 cell)
- **Bond energy reasoning**: breaking bonds **absorbs** energy (endothermic step); making bonds **releases** energy (exothermic step); overall: if energy released making new bonds > energy used breaking old bonds → exothermic (and vice versa); simple "energy in to break = X, energy out making = Y, so the reaction is exo/endo and releases/absorbs (Y−X)" arithmetic. (~30, d2/d3, a couple use small given numbers)
- **Activation energy**: the minimum energy a collision needs to react; even exothermic reactions need it (why a fire needs a spark); a higher Eₐ → slower; relate to the energy profile hump and to collision theory. (~25)
- **Catalysts & energy**: a catalyst provides an alternative path with **lower activation energy** → more collisions succeed → faster; it does **not** change whether the reaction is exo/endo, does not change the energy released/absorbed, does not change the reactant/product levels — only the hump's height; enzymes. (~25)
- **Conservation of energy / where the energy goes**: energy isn't created or destroyed — in an exothermic reaction the chemical (stored) energy of the reactants becomes heat/light; in endothermic, absorbed heat becomes stored chemical energy; "the universe's total energy is unchanged". (~20)
- **Everyday & practical contexts**: fuels and food as energy stores; comparing fuels (energy released per gram, qualitative); cold packs/hot packs design; why we eat (respiration is exothermic); calorimetry idea at a basic level (measure temperature change of water to compare fuels — fair-test thinking). (~25)
Misconceptions: "breaking bonds releases energy" (it absorbs); "exothermic reactions don't need any energy to start"; "a catalyst makes a reaction release more energy / makes an endothermic reaction exothermic"; "the surroundings get cold in an exothermic reaction"; "energy is used up / destroyed in a reaction"; "activation energy is the energy released"; "endothermic reactions feel hot"; reading the energy diagram upside-down (products below = endothermic).
balanceEquation (3–6): an exothermic and an endothermic example, balanced cleanly — combustion `CH4 + 2O2 → CO2 + 2H2O` ("a strongly exothermic reaction — balance it"), `2H2 + O2 → 2H2O`, decomposition `2H2O2 → 2H2O + O2` or `CaCO3 → CaO + CO2` (endothermic), respiration/photosynthesis `C6H12O6 + 6O2 → 6CO2 + 6H2O` (6 ok).

## Execution plan

1. **This spec** committed on `feat/question-banks`.
2. **Implementation plan** via `writing-plans` → tasks:
   - T1–T7: one generation task per bank (independent — disjoint files).
   - T8: verification pass.
   - T9: regression test + finish (merge/tag).
3. **Generation (T1–T7)** — run as **parallel subagents, one per bank**. Each subagent gets: this spec (esp. the schema block, the per-bank quality bar, and *its* concept map), the current contents of its bank file, and a tight checklist. It must:
   - produce the full new JSON array (existing items kept/improved + new items, all meeting the bar),
   - keep it valid JSON, sorted/grouped sensibly (e.g. by difficulty then id, or keep author order — just be consistent within the file),
   - self-check before reporting: counts, difficulty histogram, answerIndex histogram (20–30% each), no `validateQuestion` warnings, every balanceEquation balances with max coeff ≤ 9, no duplicate prompts, every item has hint+explanation,
   - run `npx tsc --noEmit && npm test && npm run build` and confirm green,
   - commit `feat(content): expand <topic> question bank (≈270, diversified)`.
4. **Verification pass (T8)** — I independently re-check all 7: counts (250–290), difficulty bands (each within ±15% of 100/100/70 and ≥30), answerIndex spread (each of 0–3 in 20–30% of mcq items), `validateQuestion` clean across the whole `questions/` dir, every balanceEquation balances at lowest integers with all coeffs ≤9, normalised-prompt dedup within each bank, spot-read ~10 items/bank for reading level + chemical correctness, then full `npm test` + `tsc --noEmit` + `npm run build`. Fix anything that fails.
5. **Regression test (T9)** — add `src/__tests__/questionBanks.test.ts` (or extend `realContent.test.ts`): for each of the 7 banks assert ≥250 items, all `validateQuestion`-clean, each difficulty 1/2/3 has ≥30 items, and for mcq items each answerIndex 0–3 appears in ≥18% of them (a lenient floor — the authoring target is 20–30%). Then `finishing-a-development-branch`: merge `--no-ff` into `main`, push (auto-deploys to GitHub Pages), tag `v0.9.0-questionbanks`.

## Out of scope (explicitly not in this milestone)

- Any new question `format` (drag-and-drop / `orderSteps` / `sortBuckets` / etc.) — separate future milestone.
- Changes to `QuizEngine`, `QuizPanel`, `loadGameContent`, scenes, regions, enemies, skills, tilemaps.
- Re-balancing combat, the skill-progression milestone, or Region 8.
- Translating formulas to use Unicode subscripts in the data (the panel renders plain text fine; keep it plain).

## Success criteria

- All 7 banks at 250–290 items; total ≈1,900 questions (was ~330).
- `npx tsc --noEmit`, `npm test`, `npm run build` all green; new regression test passing; total test count goes up.
- Each bank: difficulty bands ≈100/100/70 (±15%, ≥30 each); answerIndex 0/1/2/3 each 20–30% of its mcq items; balanceEquation count per the table; every item has a non-empty hint and explanation; no `validateQuestion` warnings; no duplicate prompts.
- Spot-reading any 10 items from any bank: chemically correct, NSW Stage-5 reading level, distractors plausible, hint is a nudge not the answer, content visibly varied in context and archetype (not template clones).
- Merged to `main`, pushed, deployed, tagged `v0.9.0-questionbanks`.
