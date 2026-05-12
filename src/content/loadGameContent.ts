import classes from './data/classes.json';
import skills from './data/skills.json';
import enemies from './data/enemies.json';
import regions from './data/regions.json';
import items from './data/items.json';
import typeChart from './data/typeChart.json';
import assets from './data/assetManifest.json';
import npcs from './data/npcs.json';
import atomicStructure from './data/questions/atomic-structure.json';
import bonding from './data/questions/bonding.json';
import reactionTypes from './data/questions/reaction-types.json';
import balancingEquations from './data/questions/balancing-equations.json';
import reactionRates from './data/questions/reaction-rates.json';
import acidsBases from './data/questions/acids-bases.json';
import energyChanges from './data/questions/energy-changes.json';
import { ContentLoader } from './ContentLoader';
import type { GameContent } from './types';

export function loadGameContent(): { content: GameContent; warnings: string[] } {
  return ContentLoader.fromRaw({
    classes: classes as unknown[],
    skills: skills as Record<string, unknown>,
    enemies: enemies as Record<string, unknown>,
    regions: regions as unknown[],
    items: items as Record<string, unknown>,
    typeChart,
    questions: { 'atomic-structure': atomicStructure as unknown[], 'bonding': bonding as unknown[], 'reaction-types': reactionTypes as unknown[], 'balancing-equations': balancingEquations as unknown[], 'reaction-rates': reactionRates as unknown[], 'acids-bases': acidsBases as unknown[], 'energy-changes': energyChanges as unknown[] },
    npcs: npcs as Record<string, unknown>,
    assets
  });
}
