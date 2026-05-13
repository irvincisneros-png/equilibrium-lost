# Equilibrium bank — Codex review (2026-05-13)

Codex reviewed all 80 items in `src/content/data/questions/equilibrium.json` against the Year-10 / NSW Stage 5 brief. Findings below; this is the source of truth for the fix pass tracked in branch `equilibrium-bank-fixes`.

## Hard chemistry errors (fix-first)
1. **eq-072** — claims "forward rate greatly exceeds reverse rate" at equilibrium. At equilibrium forward and reverse rates are **equal** by definition. Correct framing: the mixture is mostly products, but rates are equal.
2. **eq-049** — cobalt chloride equilibrium direction reversed. Conventional: `pink [Co(H₂O)₆]²⁺ + 4Cl⁻ ⇌ blue [CoCl₄]²⁻ + 6H₂O`, forward endothermic. Heating → blue; cooling → pink.
3. **eq-050** — same cobalt chloride error as eq-049; near-duplicate.
4. **eq-044** — uses "halving by dilution" which changes all concentrations; direction depends on stoichiometry. Use "some product is selectively removed" instead.
5. **eq-030** — two defensible correct answers (adding NaOH and adding more dichromate both can shift left). Replace the dichromate distractor.

## Specification / chemistry-precision issues
- eq-005: "reverse reaction cannot occur" is too absolute → use "equal rates cannot be maintained because material escapes."
- eq-012: "more reactant" underspecified → "increasing the concentration of an aqueous or gaseous reactant."
- eq-016: pressure-decrease distractor doesn't always shift → specify "with unequal gas moles."
- eq-019: pressure rule too broad → add "when the two sides have different numbers of gas moles."
- eq-024: constant colour alone ≠ proof of dynamic equilibrium (could be stalled).
- eq-038: drifts into "equilibrium expression" / activity language → reword qualitatively about CaCO₃.
- eq-060: marked answer assumes endothermic-forward but prompt doesn't state it → add the premise.

## Curriculum drift (Stage-6 territory)
- eq-055 — isotope-labelling evidence too advanced.
- eq-058, eq-076 — kinetic/thermodynamic trapping with heavy vocabulary.
- eq-062 — concentration ratio `[B]/[A] = 4` drifts toward Kc notation.
- eq-063 — ΔH notation + over-specific "V₂O₅ inactive below ~400°C."
- eq-064 — isotope-labelling again; near-duplicate of eq-055.

## Hint giveaways
- eq-011 — hint contains "oppose" (the keyword in the answer).
- eq-059 — hint contains "recovered and reused."
- eq-073 — hint mentions "reversible-reaction arrow."
- eq-080 — hint walks through the entire balancing solution.

## Duplicate clusters (cull to 1-2 per cluster)
- Dynamic-equilibrium definition: eq-003 ↔ eq-066; eq-004 ↔ eq-008.
- Closed-system: eq-005 ↔ eq-009 ↔ eq-067.
- **Catalyst-no-shift (8 items!):** eq-013, eq-016, eq-031, eq-036, eq-046, eq-057, eq-069, eq-071 → keep eq-046 (the misconception item).
- Fizzy-drink CO₂: eq-014 ↔ eq-074.
- Warm carbonated CO₂: eq-018 ↔ eq-035.
- Position-of-equilibrium left/right: eq-021 ↔ eq-042 ↔ eq-079.
- Haber temperature compromise: eq-023 ↔ eq-039.
- Endothermic + temperature: eq-027 ↔ eq-034.
- Cobalt chloride: eq-049 ↔ eq-050.
- Isotope evidence: eq-055 ↔ eq-064.
- NO kinetic trap: eq-058 ↔ eq-076.

## Concept gaps to fill (use replacement slots)
- Particle-model representations of dynamic equilibrium.
- Observation-based reversible reaction examples for school demos (chromate/dichromate colour, Fe³⁺/SCN⁻).
- Distinction between "equilibrium reached" and "reaction complete."
- Open vs closed beyond just "gas escaping."
- **Removing** reactants/products (most existing items only add).
- Everyday qualitative contexts that aren't Haber.

## Overall summary (Codex)
Chemistry mostly sound; the 5 hard errors must go. Heavy skew toward Haber + catalyst + pressure + left/right. Several difficulty-3 items drift into Stage-6 notation. Hints generally helpful but several collapse to the answer.

## Top-5 fix-first ids
1. eq-072 · 2. eq-049 · 3. eq-050 · 4. eq-044 · 5. eq-030.
