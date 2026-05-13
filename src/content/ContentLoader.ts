import type { GameContent, QuestionDef, ItemDef, SkillDef, ClassDef, EnemyDef, RegionDef, NpcDef, AssetManifest, TypeChart } from './types';
import {
  validateClass, validateSkill, validateEnemy, validateItem, validateRegion, validateNpc,
  validateAssetManifest, validateTypeChart, validateQuestion, validateGameContent, type ValidationResult
} from './schema';

export class ContentError extends Error {
  constructor(public readonly issues: string[]) { super(`Content failed to load:\n - ${issues.join('\n - ')}`); this.name = 'ContentError'; }
}

interface RawContent {
  classes: unknown[]; skills: Record<string, unknown>; enemies: Record<string, unknown>;
  regions: unknown[]; items: Record<string, unknown>; typeChart: unknown;
  questions: Record<string, unknown[]>; npcs: Record<string, unknown>; assets: unknown;
}

function collect(...rs: ValidationResult[]): ValidationResult {
  return { errors: rs.flatMap(r => r.errors), warnings: rs.flatMap(r => r.warnings) };
}

export const ContentLoader = {
  /** Validate + index raw imported JSON. Drops malformed questions/items (warning); throws ContentError on hard errors. */
  fromRaw(raw: RawContent): { content: GameContent; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // classes
    raw.classes.forEach((c) => { const v = validateClass(c); errors.push(...v.errors); warnings.push(...v.warnings); });
    // skills
    for (const [id, s] of Object.entries(raw.skills)) { const v = validateSkill({ ...(s as object), id: (s as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // enemies
    for (const [id, e] of Object.entries(raw.enemies)) { const v = validateEnemy({ ...(e as object), id: (e as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // regions
    raw.regions.forEach((rg) => { const v = validateRegion(rg); errors.push(...v.errors); warnings.push(...v.warnings); });
    // npcs
    for (const [id, n] of Object.entries(raw.npcs)) { const v = validateNpc({ ...(n as object), id: (n as any)?.id ?? id }); errors.push(...v.errors); warnings.push(...v.warnings); }
    // type chart + assets
    { const v = collect(validateTypeChart(raw.typeChart), validateAssetManifest(raw.assets)); errors.push(...v.errors); warnings.push(...v.warnings); }

    // items: drop malformed with warning
    const items: Record<string, ItemDef> = {};
    for (const [id, it] of Object.entries(raw.items)) {
      const v = validateItem({ ...(it as object), id: (it as any)?.id ?? id });
      if (v.errors.length) warnings.push(`item ${id}: ${v.errors.join('; ')} — skipped`);
      else items[id] = it as ItemDef;
    }
    // questions: drop malformed with warning
    const questions: Record<string, QuestionDef[]> = {};
    for (const [topic, list] of Object.entries(raw.questions)) {
      const kept: QuestionDef[] = [];
      for (const q of list) { const v = validateQuestion(q); if (v.warnings.length) warnings.push(...v.warnings); else kept.push(q as QuestionDef); }
      questions[topic] = kept;
    }

    const content: GameContent = {
      classes: raw.classes as ClassDef[],
      skills: raw.skills as Record<string, SkillDef>,
      enemies: raw.enemies as Record<string, EnemyDef>,
      regions: (raw.regions as RegionDef[]).slice().sort((a, b) => a.index - b.index),
      items,
      typeChart: raw.typeChart as TypeChart,
      questions,
      npcs: raw.npcs as Record<string, NpcDef>,
      assets: raw.assets as AssetManifest,
      equipment: {},
      shops: {},
    };

    const top = validateGameContent(content);
    errors.push(...top.errors); warnings.push(...top.warnings);
    if (errors.length) throw new ContentError(errors);
    return { content, warnings };
  }
};
