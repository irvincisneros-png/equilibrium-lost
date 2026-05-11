import type {
  QuestionDef, SkillDef, ClassDef, EnemyDef, ItemDef, RegionDef, NpcDef, AssetManifest, GameContent, TypeChart
} from './types';

export interface ValidationResult { errors: string[]; warnings: string[]; }
const ok = (): ValidationResult => ({ errors: [], warnings: [] });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

function requireFields(o: Record<string, unknown>, spec: Record<string, (v: unknown) => boolean>, who: string, errs: string[]) {
  for (const [k, pred] of Object.entries(spec)) {
    if (!(k in o) || !pred(o[k])) errs.push(`${who}: missing/invalid field "${k}"`);
  }
}

// --- question: malformed => WARNING (skip), never an error (game continues) ---
export function validateQuestion(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.warnings.push('question: not an object — skipped'); return r; }
  const id = isStr(raw['id']) ? raw['id'] : '(no id)';
  const base = isStr(raw['topic']) && (raw['difficulty'] === 1 || raw['difficulty'] === 2 || raw['difficulty'] === 3) && isStr(raw['prompt']) && isStr(raw['explanation']);
  if (!base) { r.warnings.push(`question ${id}: missing/invalid topic/difficulty/prompt/explanation — skipped`); return r; }
  if (raw['format'] === 'mcq') {
    const opts = raw['options'];
    if (!isArr(opts) || opts.length !== 4 || !opts.every(isStr)) r.warnings.push(`question ${id}: mcq needs exactly 4 string options — skipped`);
    else if (!isNum(raw['answerIndex']) || (raw['answerIndex'] as number) < 0 || (raw['answerIndex'] as number) > 3) r.warnings.push(`question ${id}: mcq answerIndex must be 0..3 — skipped`);
  } else if (raw['format'] === 'balanceEquation') {
    const eq = raw['equation'];
    const sideOk = (s: unknown) => isArr(s) && s.length > 0 && s.every((t: unknown) => isObj(t) && isStr(t['formula']) && isNum(t['coeff']) && (t['coeff'] as number) >= 1);
    if (!isObj(eq) || !sideOk(eq['reactants']) || !sideOk(eq['products'])) r.warnings.push(`question ${id}: balanceEquation needs reactants/products with formula+coeff>=1 — skipped`);
  } else {
    r.warnings.push(`question ${id}: unknown format "${String(raw['format'])}" — skipped`);
  }
  return r;
}

export function validateSkill(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('skill: not an object'); return r; }
  requireFields(raw, {
    id: isStr, name: isStr, affinity: isStr, power: isNum, energyCost: isNum,
    questionDifficulty: (v) => v === 1 || v === 2 || v === 3, accuracy: isNum,
    isSignature: isBool, isCatalystBurst: isBool, description: isStr
  }, `skill ${isStr(raw['id']) ? raw['id'] : '(no id)'}`, r.errors);
  if ('topic' in raw && raw['topic'] !== null && !isStr(raw['topic'])) r.errors.push(`skill ${String(raw['id'])}: topic must be a string or null`);
  return r;
}

export function validateClass(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('class: not an object'); return r; }
  const who = `class ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  const stats = (v: unknown) => isObj(v) && isNum(v['hp']) && isNum(v['atk']) && isNum(v['def']) && isNum(v['spd']);
  requireFields(raw, { id: isStr, name: isStr, theme: isStr, baseStats: stats, growth: stats, signatureAffinity: isStr,
    startingSkillIds: (v) => isArr(v) && v.every(isStr), skillUnlocks: isArr, evolutions: isArr }, who, r.errors);
  return r;
}

export function validateEnemy(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('enemy: not an object'); return r; }
  const who = `enemy ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  const stats = (v: unknown) => isObj(v) && isNum(v['hp']) && isNum(v['atk']) && isNum(v['def']) && isNum(v['spd']);
  requireFields(raw, { id: isStr, name: isStr, affinity: isStr, baseStats: stats, level: isNum, attackPower: isNum,
    skillIds: (v) => isArr(v) && v.every(isStr), xpYield: isNum, role: isStr, spriteKey: isStr }, who, r.errors);
  return r;
}

export function validateItem(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('item: not an object'); return r; }
  requireFields(raw, { id: isStr, name: isStr, kind: isStr, usableInBattle: isBool, effect: isObj, description: isStr },
    `item ${isStr(raw['id']) ? raw['id'] : '(no id)'}`, r.errors);
  return r;
}

export function validateRegion(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('region: not an object'); return r; }
  const who = `region ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  requireFields(raw, { id: isStr, index: isNum, name: isStr, topic: isStr, tilemapKey: isStr, tilesetKey: isStr,
    battleBackgroundKey: isStr, wildEnemyIds: (v) => isArr(v) && v.every(isStr), encounterRatePerStep: isNum,
    miniBossId: isStr, regionBossId: isStr, npcIds: (v) => isArr(v) && v.every(isStr), shrine: isObj, bossReward: isObj }, who, r.errors);
  if (isObj(raw['shrine'])) requireFields(raw['shrine'], { questionTopic: isStr, questionCount: isNum, passRatio: isNum, rewardXp: isNum,
    rewardItemIds: (v) => isArr(v) && v.every(isStr) }, `${who}.shrine`, r.errors);
  if ('unlocksRegionId' in raw && raw['unlocksRegionId'] !== null && !isStr(raw['unlocksRegionId'])) r.errors.push(`${who}: unlocksRegionId must be string|null`);
  return r;
}

export function validateNpc(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('npc: not an object'); return r; }
  const who = `npc ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  requireFields(raw, { id: isStr, name: isStr, spriteKey: isStr, tile: (v) => isObj(v) && isNum(v['x']) && isNum(v['y']),
    dialogue: (v) => isArr(v) && v.length > 0 }, who, r.errors);
  if (isArr(raw['dialogue'])) {
    for (const n of raw['dialogue'] as unknown[]) {
      if (!isObj(n) || !isStr(n['id']) || !isStr(n['text'])) r.errors.push(`${who}: a dialogue node is missing id/text`);
    }
  }
  return r;
}

export function validateAssetManifest(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('assetManifest: not an object'); return r; }
  for (const k of ['images', 'tilemaps', 'audio'] as const) if (!isObj(raw[k])) r.errors.push(`assetManifest: "${k}" must be an object`);
  if (!isArr(raw['placeholders'])) r.errors.push('assetManifest: "placeholders" must be an array');
  return r;
}

export function validateTypeChart(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('typeChart: not an object'); return r; }
  for (const [atk, row] of Object.entries(raw)) {
    if (!isObj(row)) { r.errors.push(`typeChart["${atk}"] must be an object`); continue; }
    for (const [def, mult] of Object.entries(row)) if (!isNum(mult)) r.errors.push(`typeChart["${atk}"]["${def}"] must be a number`);
  }
  return r;
}

// top-level: required collections must be non-empty; cross-references checked as warnings
export function validateGameContent(c: GameContent): ValidationResult {
  const r = ok();
  if (!c.classes?.length) r.errors.push('content: classes is empty');
  if (!Object.keys(c.skills ?? {}).length) r.errors.push('content: skills is empty');
  if (!Object.keys(c.enemies ?? {}).length) r.errors.push('content: enemies is empty');
  if (!c.regions?.length) r.errors.push('content: regions is empty');
  if (!Object.keys(c.items ?? {}).length) r.errors.push('content: items is empty');
  if (!Object.keys(c.questions ?? {}).length) r.errors.push('content: questions is empty');
  if (!c.assets) r.errors.push('content: assetManifest missing');
  // cross-ref warnings (don't crash; helps content authors)
  const skillIds = new Set(Object.keys(c.skills ?? {}));
  for (const cls of c.classes ?? []) for (const sid of [...cls.startingSkillIds, ...cls.skillUnlocks.map(u => u.skillId)])
    if (!skillIds.has(sid)) r.warnings.push(`class ${cls.id} references unknown skill "${sid}"`);
  const enemyIds = new Set(Object.keys(c.enemies ?? {}));
  for (const reg of c.regions ?? []) {
    for (const eid of [...reg.wildEnemyIds, reg.miniBossId, reg.regionBossId]) if (!enemyIds.has(eid)) r.warnings.push(`region ${reg.id} references unknown enemy "${eid}"`);
    if (!c.questions?.[reg.topic]?.length) r.warnings.push(`region ${reg.id} topic "${reg.topic}" has no questions`);
  }
  return r;
}
