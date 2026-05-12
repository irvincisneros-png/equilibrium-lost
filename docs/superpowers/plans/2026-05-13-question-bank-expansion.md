# Question-Bank Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow all 7 topic question banks from ~45 (atomic-structure: 60) to ≈270 genuinely-distinct questions each, fixing the answer-position skew and putting a real hint on every item — pure JSON content plus a strengthened regression test.

**Architecture:** The spec ([docs/superpowers/specs/2026-05-13-equilibrium-lost-question-bank-expansion.md](../specs/2026-05-13-equilibrium-lost-question-bank-expansion.md)) carries the schema, the per-bank quality bar, and a concept map per topic. We (1) widen the existing per-bank size assertions so `npm test` stays green during the work; (2) regenerate each of the 7 `src/content/data/questions/<topic>.json` files via one dispatched subagent per bank (subagents write the JSON and self-verify with a node one-liner — they do NOT commit and do NOT run `vite build`, only the read-only `npx tsc --noEmit && npm test`, to avoid concurrency hazards); (3) the main session reviews each file, runs all three gates, and commits each bank; (4) tighten the regression test to enforce the full bar (size ≥250, ≥30 per difficulty, answerIndex spread, hint+explanation present, every balanceEquation actually balances with coeffs 1–9, unique ids & prompts); (5) verification spot-read + finish the branch (merge `--no-ff` → push → tag `v0.9.0-questionbanks`).

**Tech Stack:** TypeScript, Vite, Vitest; data-driven JSON content loaded via `src/content/loadGameContent.ts`; `node` for ad-hoc verification one-liners.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `src/content/data/questions/atomic-structure.json` | Modify (rewrite) | ≈270 atomic-structure questions |
| `src/content/data/questions/bonding.json` | Modify (rewrite) | ≈270 bonding questions |
| `src/content/data/questions/reaction-types.json` | Modify (rewrite) | ≈270 reaction-types questions |
| `src/content/data/questions/balancing-equations.json` | Modify (rewrite) | ≈270 balancing-equations questions (50–70 of them `balanceEquation` format) |
| `src/content/data/questions/reaction-rates.json` | Modify (rewrite) | ≈270 reaction-rates questions; fix the B-skew |
| `src/content/data/questions/acids-bases.json` | Modify (rewrite) | ≈270 acids-bases questions; fix the B-skew |
| `src/content/data/questions/energy-changes.json` | Modify (rewrite) | ≈270 energy-changes questions |
| `tests/content/realContent.test.ts` | Modify | widen the 7 weak per-bank size asserts (Task 1); add a strict `expanded question banks` describe block + a small balanceEquation balance-checker (Task 9) |

No other files change. No changes to `src/content/types.ts`, `src/content/schema.ts`, `src/systems/QuizEngine.ts`, `src/ui/QuizPanel.ts`, `src/content/loadGameContent.ts`, or any scene.

---

## Task 1: Widen the existing per-bank size assertions (keep `npm test` green during generation)

**Files:**
- Modify: `tests/content/realContent.test.ts`

The 7 existing per-bank tests assert `40 ≤ qs.length ≤ 60`. Once a bank is expanded to ≈270 the upper bound fails. Widen it now so the suite stays green no matter what order the banks land in. (The lower bound `≥40` and the `≥5 per difficulty` and `some(balanceEquation)` checks all stay true throughout — expansion only adds.)

- [ ] **Step 1: Widen the upper bound on every per-bank size assert**

Edit `tests/content/realContent.test.ts` with a replace-all: change every occurrence of

```ts
    expect(qs.length).toBeLessThanOrEqual(60);
```

to

```ts
    expect(qs.length).toBeLessThanOrEqual(400);
```

(There are 7 — one per bank. Nothing else in the file uses `toBeLessThanOrEqual(60)`.)

- [ ] **Step 2: Run the gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass, 160 tests still green.

- [ ] **Step 3: Commit**

```bash
git add tests/content/realContent.test.ts
git commit -m "test: widen question-bank size bounds ahead of expansion

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Tasks 2–8: Generate the 7 banks (one dispatched subagent per bank)

These seven tasks are **independent** (disjoint files) and SHOULD be dispatched as parallel subagents in a single message. Use `subagent_type: general-purpose` and `model: sonnet`. Each subagent gets the prompt template below with `<TOPIC>`, `<FILE>`, `<PREFIX>`, `<BAL_TARGET>`, and `<CONCEPT_MAP_SECTION_NUMBER>` filled in, plus the full text of the spec file pasted in. Each subagent:

- reads the spec (esp. the schema block, "Per-bank quality bar", and *its* concept map section), and the current contents of its `<FILE>`;
- produces the **complete new JSON array** (existing items kept or improved + new items, the whole thing meeting the bar);
- writes `<FILE>` in a single Write call;
- runs the self-verification one-liner (below) and iterates until it prints all-OK;
- runs `npx tsc --noEmit && npm test` and confirms green (the per-bank size tests for *other* banks may temporarily fail if those subagents haven't finished — that's expected; what matters is tsc clean + no NEW failures attributable to *this* file: a malformed item shows up as a `loadGameContent` warning making `tests/content/realContent.test.ts` "loads without ... warnings" red — that one IS this subagent's responsibility);
- does **NOT** `git commit` and does **NOT** run `npm run build`;
- reports back: final question count, difficulty histogram, answerIndex histogram, balanceEquation count, and confirmation the one-liner printed all-OK.

The plain breakdown per bank (also in the spec table):

| Task | `<TOPIC>` | `<FILE>` | `<PREFIX>` | `<BAL_TARGET>` (balanceEquation count) | concept-map section in spec |
|---|---|---|---|---|---|
| 2 | `atomic-structure` | `src/content/data/questions/atomic-structure.json` | `as` | keep the existing 2 (`as-048`, `as-049`); 0–2 total | §1 |
| 3 | `bonding` | `src/content/data/questions/bonding.json` | `b` | 6–10 | §2 |
| 4 | `reaction-types` | `src/content/data/questions/reaction-types.json` | `rt` | 6–10 | §3 |
| 5 | `balancing-equations` | `src/content/data/questions/balancing-equations.json` | `be` | **50–70** | §4 |
| 6 | `reaction-rates` | `src/content/data/questions/reaction-rates.json` | `rr` | 3–6 | §5 |
| 7 | `acids-bases` | `src/content/data/questions/acids-bases.json` | `ab` | 6–10 | §6 |
| 8 | `energy-changes` | `src/content/data/questions/energy-changes.json` | `ec` | 3–6 | §7 |

### Subagent self-verification one-liner

The subagent runs this after writing `<FILE>` (substituting the path and topic). It checks: count, difficulty histogram, format histogram, answerIndex spread (each 0–3 ≥ 18% of mcq), every item has non-empty hint+explanation, mcq has exactly 4 string options + integer answerIndex 0–3, balanceEquation has reactants/products with integer coeffs 1–9 that actually balance, no duplicate ids, no duplicate normalised prompts.

```bash
node -e '
const fs=require("fs");
const TOPIC="<TOPIC>"; const path="<FILE>";
const qs=JSON.parse(fs.readFileSync(path,"utf8"));
const fail=[];
const norm=s=>s.toLowerCase().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"").trim();
// formula -> {element:count}
function parseFormula(formula){
  const f=String(formula).replace(/\s+/g,"").replace(/[+\-]+\d*$|\d*[+\-]+$/,"");
  let i=0; const read=()=>{const loc={}; const add=(e,n)=>loc[e]=(loc[e]||0)+n;
    while(i<f.length&&f[i]!==")"){
      if(f[i]==="("){i++; const sub=read(); if(f[i]!==")")throw new Error("paren "+formula); i++;
        let num=""; while(i<f.length&&/\d/.test(f[i]))num+=f[i++]; const m=num?parseInt(num,10):1;
        for(const [e,n] of Object.entries(sub))add(e,n*m);
      } else if(/[A-Z]/.test(f[i])){ let el=f[i++]; while(i<f.length&&/[a-z]/.test(f[i]))el+=f[i++];
        let num=""; while(i<f.length&&/\d/.test(f[i]))num+=f[i++]; add(el,num?parseInt(num,10):1);
      } else { i++; }
    } return loc; };
  return read();
}
function balances(eq){
  const side=ts=>{const t={}; for(const x of ts){const c=parseFormula(x.formula); for(const [e,n] of Object.entries(c))t[e]=(t[e]||0)+n*x.coeff;} return t;};
  const L=side(eq.reactants), R=side(eq.products), els=new Set([...Object.keys(L),...Object.keys(R)]);
  for(const e of els) if((L[e]||0)!==(R[e]||0)) return false;
  return true;
}
const ids=new Set(), prompts=new Set();
const diff={1:0,2:0,3:0}, fmt={}, ans={0:0,1:0,2:0,3:0};
let mcqN=0;
for(const q of qs){
  if(q.topic!==TOPIC)fail.push(q.id+": wrong topic");
  if(![1,2,3].includes(q.difficulty))fail.push(q.id+": bad difficulty"); else diff[q.difficulty]++;
  if(!q.hint||!String(q.hint).trim())fail.push(q.id+": empty hint");
  if(!q.explanation||!String(q.explanation).trim())fail.push(q.id+": empty explanation");
  if(ids.has(q.id))fail.push(q.id+": duplicate id"); ids.add(q.id);
  const np=norm(q.prompt||""); if(prompts.has(np))fail.push(q.id+": duplicate prompt"); prompts.add(np);
  fmt[q.format]=(fmt[q.format]||0)+1;
  if(q.format==="mcq"){ mcqN++;
    if(!Array.isArray(q.options)||q.options.length!==4||!q.options.every(o=>typeof o==="string"&&o.length))fail.push(q.id+": mcq needs 4 string options");
    if(!Number.isInteger(q.answerIndex)||q.answerIndex<0||q.answerIndex>3)fail.push(q.id+": bad answerIndex"); else ans[q.answerIndex]++;
  } else if(q.format==="balanceEquation"){
    const eq=q.equation; const sideOk=s=>Array.isArray(s)&&s.length&&s.every(t=>t&&typeof t.formula==="string"&&t.formula.length&&Number.isInteger(t.coeff)&&t.coeff>=1&&t.coeff<=9);
    if(!eq||!sideOk(eq.reactants)||!sideOk(eq.products))fail.push(q.id+": bad equation (coeffs must be ints 1..9)");
    else { try{ if(!balances(eq))fail.push(q.id+": equation does not balance"); }catch(e){ fail.push(q.id+": "+e.message); } }
  } else fail.push(q.id+": unknown format "+q.format);
}
for(const i of [0,1,2,3]) if(mcqN && ans[i]/mcqN < 0.18) fail.push("answerIndex "+i+" only "+(100*ans[i]/mcqN).toFixed(1)+"% of mcq (<18%)");
for(const d of [1,2,3]) if(diff[d]<30) fail.push("difficulty "+d+" only "+diff[d]+" items (<30)");
if(qs.length<255||qs.length>290) fail.push("count "+qs.length+" outside 255..290");
console.log("count",qs.length,"diff",JSON.stringify(diff),"fmt",JSON.stringify(fmt),"mcqAnsIdx%",JSON.stringify(Object.fromEntries([0,1,2,3].map(i=>[i,+(100*ans[i]/mcqN).toFixed(1)]))));
if(fail.length){ console.log("FAIL:\n"+fail.join("\n")); process.exit(1);} else console.log("ALL OK");
'
```

### Subagent prompt template (Tasks 2–8)

```
You are generating the <TOPIC> question bank for "Equilibrium Lost", a Year-10 (NSW Stage 5)
Chemistry RPG. Your job: rewrite the file <FILE> so it contains ≈270 (target 260–285, never below 255)
genuinely distinct, high-quality questions that meet the standard in the spec below. This is content
work — do NOT change any code, schema, or other files.

=== THE SPEC (read all of it, then re-read the schema block, "Per-bank quality bar", "Treatment of
existing items", "Text encoding", and concept-map section <CONCEPT_MAP_SECTION_NUMBER>) ===
<<<paste the full text of docs/superpowers/specs/2026-05-13-equilibrium-lost-question-bank-expansion.md here>>>

=== YOUR BANK ===
- topic string (the `topic` field of every item): "<TOPIC>"   (exact, with hyphens)
- file to overwrite: <FILE>
- id prefix for NEW items: "<PREFIX>-" + zero-padded 3-digit number, continuing after the current max
- balanceEquation count for this bank: <BAL_TARGET>
- the file's CURRENT contents are below — keep good items (keep their ids), improve/replace weak or
  near-duplicate or mis-levelled ones or ones whose hint gives away the answer, and re-spread answerIndex
  across the WHOLE bank by physically reordering the 4 option strings (so e.g. an item whose answer was
  option B becomes one whose answer is option D — update answerIndex to match the new position):
<<<paste the current contents of <FILE> here>>>

=== WHAT TO DO ===
1. Build a coverage list from concept-map section <CONCEPT_MAP_SECTION_NUMBER>: the cells, their
   approximate budgets, the misconceptions to mine for distractors.
2. Write ≈270 items across those cells, varying substances/numbers/contexts/archetypes per the quality
   bar (recall / calculate / classify / predict-the-product / compare-two-cases / interpret-a-described-
   diagram / spot-the-error / odd-one-out / which-statement-is-true / "a student says X — what's wrong").
   Difficulty mix ≈ d1:100 / d2:100 / d3:70 (each band ≥30). Every item gets a one-line `explanation`
   (the reasoning) and a `hint` (a nudge, never the answer). NSW Stage-5 reading level, Australian
   spelling, metric units, arithmetic only. Distractors must be plausible (a real misconception or a
   near-miss), not nonsense. No duplicate prompts. balanceEquation: coeffs are the answer, must actually
   balance at lowest integers, every coeff ≤ 9, formulas in the `equation` object are plain ASCII,
   each balanceEquation prompt names the reaction/context (distinct prompts).
3. Write the complete new JSON array to <FILE> in ONE write (valid JSON; group by difficulty then id, or
   keep author order — just be consistent).
4. Run the self-verification one-liner (provided separately) against <FILE>; fix anything it flags;
   repeat until it prints "ALL OK".
5. Run `npx tsc --noEmit && npm test`. tsc must be clean. In `tests/content/realContent.test.ts` the
   test 'loads without throwing and reports no cross-reference warnings' must be GREEN (a malformed item
   in your file makes it red — fix it). Other per-bank size tests may be red if sibling banks aren't
   expanded yet — ignore those, they're not your file.
6. Do NOT git commit. Do NOT run `npm run build`.
7. Report: final count, difficulty histogram, format histogram, mcq answerIndex %s, balanceEquation
   count, and "self-check: ALL OK".

If you run low on output budget, it is fine to stop at ~255 well-made items rather than rushing junk —
report the count and that you stopped early so the orchestrator can ask you to add more.
```

- [ ] **Step 1 (Task 2):** Dispatch the `atomic-structure` subagent (template above, §1, prefix `as`, keep `as-048`/`as-049`).
- [ ] **Step 2 (Task 3):** Dispatch the `bonding` subagent (§2, prefix `b`, balanceEquation 6–10).
- [ ] **Step 3 (Task 4):** Dispatch the `reaction-types` subagent (§3, prefix `rt`, balanceEquation 6–10).
- [ ] **Step 4 (Task 5):** Dispatch the `balancing-equations` subagent (§4, prefix `be`, balanceEquation **50–70**).
- [ ] **Step 5 (Task 6):** Dispatch the `reaction-rates` subagent (§5, prefix `rr`, balanceEquation 3–6) — emphasise fixing the B-heavy answer skew.
- [ ] **Step 6 (Task 7):** Dispatch the `acids-bases` subagent (§6, prefix `ab`, balanceEquation 6–10) — emphasise fixing the B-heavy answer skew.
- [ ] **Step 7 (Task 8):** Dispatch the `energy-changes` subagent (§7, prefix `ec`, balanceEquation 3–6).
- [ ] **Step 8:** For any subagent that reported a count < 255 or a self-check FAIL, re-dispatch it with its previous output + the file's current contents and ask it to add/fix until the one-liner is ALL OK.

(Dispatch Tasks 2–8 concurrently — one message, seven Agent calls.)

---

## Task 9: Commit the 7 banks, then tighten the regression test

**Files:**
- Modify: `src/content/data/questions/*.json` (already written by the subagents — this task reviews + commits them)
- Modify: `tests/content/realContent.test.ts`

- [ ] **Step 1: Sanity-check each generated file from the main session**

For each of the 7 files run the same self-verification one-liner (from Tasks 2–8) and confirm "ALL OK". Skim ~10 items per file for chemical correctness, reading level, and that distractors/hints are sensible. Fix anything small inline; if a file is badly off, re-dispatch its subagent.

- [ ] **Step 2: Run all three gates with the new content in place**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; tests pass (the widened per-bank tests from Task 1 still pass — banks now have 250–290 items, ≥5 per difficulty, ≥1 balanceEquation where required); build OK.

- [ ] **Step 3: Commit each bank**

```bash
git add src/content/data/questions/atomic-structure.json && git commit -m "feat(content): expand atomic-structure bank (~270 Q, diversified, answers re-spread)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/bonding.json && git commit -m "feat(content): expand bonding bank (~270 Q, diversified, answers re-spread)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/reaction-types.json && git commit -m "feat(content): expand reaction-types bank (~270 Q, diversified, answers re-spread)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/balancing-equations.json && git commit -m "feat(content): expand balancing-equations bank (~270 Q, ~60 balanceEquation, diversified)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/reaction-rates.json && git commit -m "feat(content): expand reaction-rates bank (~270 Q, diversified, B-skew fixed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/acids-bases.json && git commit -m "feat(content): expand acids-bases bank (~270 Q, diversified, B-skew fixed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git add src/content/data/questions/energy-changes.json && git commit -m "feat(content): expand energy-changes bank (~270 Q, diversified, answers re-spread)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Add the strict regression suite to `tests/content/realContent.test.ts`**

Append this `describe` block at the end of the file (inside the same module, after the existing top-level `describe('shipped content', …)` — i.e. a new sibling top-level `describe`). It enforces the full quality bar and includes a small formula parser so every authored `balanceEquation` is checked to actually balance.

```ts
describe('expanded question banks', () => {
  // formula -> { element: atomCount }; handles nested parens and a trailing ionic charge
  function parseFormula(formula: string): Record<string, number> {
    const f = formula.replace(/\s+/g, '').replace(/[+-]+\d*$|\d*[+-]+$/, '');
    let i = 0;
    const read = (): Record<string, number> => {
      const loc: Record<string, number> = {};
      const add = (el: string, n: number): void => { loc[el] = (loc[el] ?? 0) + n; };
      while (i < f.length && f[i] !== ')') {
        const ch = f[i]!;
        if (ch === '(') {
          i++;
          const sub = read();
          if (f[i] !== ')') throw new Error(`unbalanced parens in ${formula}`);
          i++;
          let num = '';
          while (i < f.length && /\d/.test(f[i]!)) num += f[i++];
          const m = num ? parseInt(num, 10) : 1;
          for (const [el, n] of Object.entries(sub)) add(el, n * m);
        } else if (/[A-Z]/.test(ch)) {
          let el = f[i++]!;
          while (i < f.length && /[a-z]/.test(f[i]!)) el += f[i++];
          let num = '';
          while (i < f.length && /\d/.test(f[i]!)) num += f[i++];
          add(el, num ? parseInt(num, 10) : 1);
        } else { i++; }
      }
      return loc;
    };
    return read();
  }
  function equationBalances(eq: { reactants: { formula: string; coeff: number }[]; products: { formula: string; coeff: number }[] }): boolean {
    const side = (terms: { formula: string; coeff: number }[]): Record<string, number> => {
      const tot: Record<string, number> = {};
      for (const t of terms) for (const [el, n] of Object.entries(parseFormula(t.formula))) tot[el] = (tot[el] ?? 0) + n * t.coeff;
      return tot;
    };
    const L = side(eq.reactants), R = side(eq.products);
    for (const el of new Set([...Object.keys(L), ...Object.keys(R)])) if ((L[el] ?? 0) !== (R[el] ?? 0)) return false;
    return true;
  }

  const BANKS: Array<{ topic: string; needsBalance: boolean }> = [
    { topic: 'atomic-structure', needsBalance: false },
    { topic: 'bonding', needsBalance: true },
    { topic: 'reaction-types', needsBalance: true },
    { topic: 'balancing-equations', needsBalance: true },
    { topic: 'reaction-rates', needsBalance: true },
    { topic: 'acids-bases', needsBalance: true },
    { topic: 'energy-changes', needsBalance: true },
  ];

  const { content } = loadGameContent();
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

  for (const { topic, needsBalance } of BANKS) {
    describe(topic, () => {
      const qs = content.questions[topic]!;

      it('has 250–400 questions', () => {
        expect(qs.length).toBeGreaterThanOrEqual(250);
        expect(qs.length).toBeLessThanOrEqual(400);
      });

      it('each difficulty 1/2/3 has at least 30 questions', () => {
        for (const d of [1, 2, 3]) expect(qs.filter(q => q.difficulty === d).length, `difficulty ${d}`).toBeGreaterThanOrEqual(30);
      });

      it('every question has a non-empty hint and explanation', () => {
        for (const q of qs) {
          expect(!!q.hint && q.hint.trim().length > 0, `${q.id} hint`).toBe(true);
          expect(q.explanation.trim().length > 0, `${q.id} explanation`).toBe(true);
        }
      });

      it('mcq answerIndex is spread — each of 0..3 is the answer for at least 18% of mcq items', () => {
        const mcq = qs.filter(q => q.format === 'mcq');
        expect(mcq.length).toBeGreaterThan(0);
        for (const idx of [0, 1, 2, 3]) {
          const share = mcq.filter(q => q.answerIndex === idx).length / mcq.length;
          expect(share, `answerIndex ${idx} share = ${(share * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.18);
        }
      });

      it('ids are unique and prompts are not duplicated', () => {
        const ids = qs.map(q => q.id);
        expect(new Set(ids).size, 'unique ids').toBe(ids.length);
        const prompts = qs.map(q => norm(q.prompt));
        expect(new Set(prompts).size, 'unique normalised prompts').toBe(prompts.length);
      });

      if (needsBalance) {
        it('has at least one balanceEquation question', () => {
          expect(qs.some(q => q.format === 'balanceEquation')).toBe(true);
        });
      }

      it('every balanceEquation balances with all coefficients between 1 and 9', () => {
        for (const q of qs.filter(q => q.format === 'balanceEquation')) {
          expect(q.equation, `${q.id} equation`).toBeDefined();
          const eq = q.equation!;
          for (const t of [...eq.reactants, ...eq.products]) {
            expect(Number.isInteger(t.coeff) && t.coeff >= 1 && t.coeff <= 9, `${q.id} coeff for ${t.formula} = ${t.coeff}`).toBe(true);
          }
          expect(equationBalances(eq), `${q.id} does not balance`).toBe(true);
        }
      });
    });
  }
});
```

- [ ] **Step 5: Run the gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Test count rises (≈160 → ≈160 + ~40 new `it`s from the new describe block). If any new `it` fails, fix the offending bank's JSON (it's a content defect — re-dispatch the subagent for that bank with the failure message, or fix small things inline) and re-run.

- [ ] **Step 6: Commit**

```bash
git add tests/content/realContent.test.ts
git commit -m "test: enforce expanded-bank quality bar (size, difficulty mix, answer spread, balanced equations)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Verification pass

**Files:** none (read-only review)

- [ ] **Step 1: Stats sweep**

For each of the 7 banks print: count, difficulty histogram, format histogram, answerIndex histogram (% of mcq), balanceEquation count. Confirm: count 250–290; each difficulty ≥30 and roughly 100/100/70 (±15%); each answerIndex 0–3 is 20–30% of mcq (the test floor is 18% — aim for the tighter band, fix outliers); balanceEquation count matches the spec table per bank.

```bash
for f in src/content/data/questions/*.json; do node -e '
const q=require("./"+process.argv[1]); const d={1:0,2:0,3:0},a={0:0,1:0,2:0,3:0},fm={}; let m=0;
for(const x of q){d[x.difficulty]++; fm[x.format]=(fm[x.format]||0)+1; if(x.format==="mcq"){m++;a[x.answerIndex]++;}}
console.log(process.argv[1].replace(/.*\//,""),"n="+q.length,"diff="+JSON.stringify(d),"fmt="+JSON.stringify(fm),"ans%="+JSON.stringify(Object.fromEntries([0,1,2,3].map(i=>[i,+(100*a[i]/m).toFixed(1)]))));
' "$f"; done
```

- [ ] **Step 2: Dedup across kept + new**

For each bank, confirm no two items share a normalised prompt (the Task 9 test already checks this, but eyeball the closest pairs):

```bash
for f in src/content/data/questions/*.json; do node -e '
const q=require("./"+process.argv[1]); const n=s=>s.toLowerCase().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"").trim();
const seen=new Map(); for(const x of q){const k=n(x.prompt); if(seen.has(k))console.log(process.argv[1],"DUP:",seen.get(k),"==",x.id,"|",x.prompt); else seen.set(k,x.id);}
' "$f"; done
```

- [ ] **Step 3: Spot-read for quality**

Read ~10 random items from each bank. Check: chemically correct at Year-10 level; reading level fits NSW Stage 5; distractors are plausible misconceptions/near-misses not nonsense; the hint nudges without giving the answer; the explanation states the reasoning; content is visibly varied (different contexts/archetypes, not template clones). Fix anything off inline; commit fixes with `fix(content): …`.

- [ ] **Step 4: Final gate run**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green. Note the test count.

---

## Task 11: Finish the branch

**Files:** none

- [ ] **Step 1: Confirm clean tree and green gates**

Run: `git status` (clean) and `npx tsc --noEmit && npm test && npm run build` (all pass).

- [ ] **Step 2: Update the project memory note** (it currently says banks are ~45 each)

Edit `/Users/irvincisneros/.claude/projects/-Users-irvincisneros/memory/equilibrium-lost-project.md`: update the line about the 7 question banks to say they're now ≈270 each (≈1,900 total), difficulty ≈100/100/70, answerIndex spread across A/B/C/D, balanceEquation counts per the spec, and that the B-skew nit is resolved. (This is a memory-file edit, not a repo commit.)

- [ ] **Step 3: Merge to main, push, tag**

```bash
git checkout main
git merge --no-ff feat/question-banks -m "Merge: expand all 7 question banks to ~270 each (v0.9.0-questionbanks)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
npx tsc --noEmit && npm test && npm run build   # gates green on main
git push origin main
git tag v0.9.0-questionbanks
git push origin v0.9.0-questionbanks
```

- [ ] **Step 4: Watch the Pages deploy**

Run: `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')` (or `gh run list --branch main --limit 3`) and confirm the GitHub Actions deploy to https://irvincisneros-png.github.io/equilibrium-lost/ succeeds.

- [ ] **Step 5: Report** the final per-bank counts, total question count, and test count to the user.

---

## Notes / risks

- **Subagent output budget:** ~270 questions ≈ 12–16k tokens of JSON. If a subagent truncates (count < 255 or invalid JSON), re-dispatch it with its prior output to continue/repair (Task 8 Step 8 / Task 9 Step 1). Setting the floor at 255 and target 260–285 leaves headroom.
- **Concurrency:** subagents run only read-only gates (`tsc`, `vitest run`) — safe in parallel. They don't `git commit` (main session does, in Task 9) and don't `vite build`. Each writes only its own `<topic>.json` in a single Write call.
- **`npm test` red during generation:** the per-bank size tests for not-yet-expanded banks may briefly fail while siblings are in flight — that's expected; the authoritative "no malformed content" signal for a given subagent is the `loadGameContent` "no warnings" test.
- **Out of scope:** no new question `format`, no `QuizEngine`/`QuizPanel`/scene/region changes, no combat re-balance, no skill-progression work, no Region 8.
