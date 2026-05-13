#!/usr/bin/env node
// Dev tool: validate a question bank against the project's quality bar.
//   node scripts/check-question-bank.mjs <topic>           # e.g. atomic-structure
//   node scripts/check-question-bank.mjs --all             # check every bank
// Exit code 1 if any check fails. See docs/superpowers/specs/2026-05-13-...-question-bank-expansion.md.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/content/data/questions');

// "Ca(NO3)2" / "Mg(OH)2" / "H2SO4" / "Na+" -> { element: atomCount }  (trailing ionic charge ignored)
export function parseFormula(formula) {
  const f = String(formula).replace(/\s+/g, '').replace(/[+-]+\d*$|\d*[+-]+$/, '');
  let i = 0;
  const read = () => {
    const loc = {};
    const add = (el, n) => { loc[el] = (loc[el] ?? 0) + n; };
    while (i < f.length && f[i] !== ')') {
      const ch = f[i];
      if (ch === '(') {
        i++;
        const sub = read();
        if (f[i] !== ')') throw new Error(`unbalanced parens in "${formula}"`);
        i++;
        let num = '';
        while (i < f.length && /\d/.test(f[i])) num += f[i++];
        const m = num ? parseInt(num, 10) : 1;
        for (const [el, n] of Object.entries(sub)) add(el, n * m);
      } else if (/[A-Z]/.test(ch)) {
        let el = f[i++];
        while (i < f.length && /[a-z]/.test(f[i])) el += f[i++];
        let num = '';
        while (i < f.length && /\d/.test(f[i])) num += f[i++];
        add(el, num ? parseInt(num, 10) : 1);
      } else { i++; }
    }
    return loc;
  };
  return read();
}

export function equationBalances(eq) {
  const side = (terms) => {
    const tot = {};
    for (const t of terms) for (const [el, n] of Object.entries(parseFormula(t.formula))) tot[el] = (tot[el] ?? 0) + n * t.coeff;
    return tot;
  };
  const L = side(eq.reactants), R = side(eq.products);
  for (const el of new Set([...Object.keys(L), ...Object.keys(R)])) if ((L[el] ?? 0) !== (R[el] ?? 0)) return false;
  return true;
}

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

export function checkBank(topic) {
  const path = join(DIR, `${topic}.json`);
  const qs = JSON.parse(readFileSync(path, 'utf8'));
  const fail = [];
  const ids = new Set(), prompts = new Set();
  const diff = { 1: 0, 2: 0, 3: 0 }, fmt = {}, ans = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let mcqN = 0;
  for (const q of qs) {
    const id = q.id ?? '(no id)';
    if (q.topic !== topic) fail.push(`${id}: topic is "${q.topic}", expected "${topic}"`);
    if (![1, 2, 3].includes(q.difficulty)) fail.push(`${id}: bad difficulty ${q.difficulty}`); else diff[q.difficulty]++;
    if (!q.hint || !String(q.hint).trim()) fail.push(`${id}: empty/missing hint`);
    if (!q.explanation || !String(q.explanation).trim()) fail.push(`${id}: empty/missing explanation`);
    if (!q.prompt || !String(q.prompt).trim()) fail.push(`${id}: empty/missing prompt`);
    if (ids.has(id)) fail.push(`${id}: duplicate id`); ids.add(id);
    const np = norm(q.prompt ?? '');
    if (prompts.has(np)) fail.push(`${id}: duplicate prompt ("${q.prompt}")`); prompts.add(np);
    fmt[q.format] = (fmt[q.format] ?? 0) + 1;
    if (q.format === 'mcq') {
      mcqN++;
      if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(o => typeof o === 'string' && o.length)) fail.push(`${id}: mcq needs exactly 4 non-empty string options`);
      if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) fail.push(`${id}: answerIndex must be an integer 0..3`); else ans[q.answerIndex]++;
    } else if (q.format === 'balanceEquation') {
      const eq = q.equation;
      const sideOk = (s) => Array.isArray(s) && s.length && s.every(t => t && typeof t.formula === 'string' && t.formula.length && Number.isInteger(t.coeff) && t.coeff >= 1 && t.coeff <= 9);
      if (!eq || !sideOk(eq.reactants) || !sideOk(eq.products)) fail.push(`${id}: equation needs reactants/products with formula + integer coeff 1..9`);
      else { try { if (!equationBalances(eq)) fail.push(`${id}: equation does not balance`); } catch (e) { fail.push(`${id}: ${e.message}`); } }
    } else if (q.format === 'orderSteps') {
      if (!Array.isArray(q.steps) || q.steps.length < 3 || q.steps.length > 6 || !q.steps.every(s => typeof s === 'string' && s.length)) {
        fail.push(`${id}: orderSteps needs 3-6 non-empty string steps`);
      }
    } else fail.push(`${id}: unknown format "${q.format}"`);
  }
  for (const i of [0, 1, 2, 3]) if (mcqN && ans[i] / mcqN < 0.18) fail.push(`answerIndex ${i} is only ${(100 * ans[i] / mcqN).toFixed(1)}% of mcq items (need ≥18%, aim 20–30%)`);
  for (const d of [1, 2, 3]) if (diff[d] < 30) fail.push(`difficulty ${d} has only ${diff[d]} items (need ≥30)`);
  if (qs.length < 250 || qs.length > 350) fail.push(`bank has ${qs.length} items (need 250–350, aim ≈270)`);
  const ansPct = Object.fromEntries([0, 1, 2, 3].map(i => [i, mcqN ? +(100 * ans[i] / mcqN).toFixed(1) : 0]));
  return { topic, count: qs.length, diff, fmt, ansPct, fail };
}

// --- CLI (only when run directly, not when imported) ---
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = process.argv[2];
  const topics = arg === '--all' || !arg
    ? readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
    : [arg.replace(/\.json$/, '')];
  let bad = false;
  for (const t of topics) {
    const r = checkBank(t);
    console.log(`${r.topic}: n=${r.count} diff=${JSON.stringify(r.diff)} fmt=${JSON.stringify(r.fmt)} mcqAnsIdx%=${JSON.stringify(r.ansPct)}`);
    if (r.fail.length) { bad = true; console.log('  FAIL:\n' + r.fail.map(x => '   - ' + x).join('\n')); }
    else console.log('  ALL OK');
  }
  process.exit(bad ? 1 : 0);
}
