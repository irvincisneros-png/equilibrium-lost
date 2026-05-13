// ---------- chemistry "types" ----------
export type Affinity =
  | 'Neutral' | 'Atomic' | 'Acid' | 'Base' | 'Metal' | 'Ionic' | 'Covalent'
  | 'Synthesis' | 'Decomposition' | 'Combustion' | 'Exothermic' | 'Endothermic'
  | 'Catalyst' | 'Precipitation';

export interface Stats { hp: number; atk: number; def: number; spd: number; }
export type StatKey = keyof Stats;

export type StatusId =
  | 'oxidised' | 'dissolved' | 'catalysed' | 'precipitated' | 'endothermicChill' | 'combusting';

export interface StatusEffectInstance { id: StatusId; turnsRemaining: number; magnitude: number; }

// ---------- skills ----------
export interface SkillBehavior {
  applyStatus?: { id: StatusId; chance: number; turns: number; magnitude: number };
  healPercent?: number;       // % of caster maxHp healed
  grantExtraAction?: boolean;  // Catalyst
  splitTarget?: boolean;       // Decomposition
  stripBuffs?: boolean;        // Precipitation
}
export interface SkillDef {
  id: string;
  name: string;
  affinity: Affinity;
  power: number;               // 0 for pure-utility skills
  energyCost: number;
  topic: string | null;        // question topic; null = no quiz (basic-attack-like skills only)
  questionDifficulty: 1 | 2 | 3; // preferred difficulty band when this skill triggers a quiz
  accuracy: number;            // 0..100
  isSignature: boolean;        // part of a class signature line
  isCatalystBurst: boolean;    // the move fired by a Catalyst Burst
  behavior?: SkillBehavior;
  description: string;
}

// ---------- classes / progression ----------
export interface EvolutionDef {
  stage: number;               // 1, 2, 3 (stage 0 = base, implicit)
  name: string;
  atLevel: number;
  requiresRegionClearedId: string;
  statBonus: Stats;
  spriteKey: string;           // overworld + battle prefix; manifest resolves variants
  newSignatureSkillId: string;
}
export interface ClassDef {
  id: string;
  name: string;
  theme: string;
  baseStats: Stats;
  growth: Stats;               // added per level beyond level 1
  signatureAffinity: Affinity; // grants the 1.25x affinity bonus
  startingSkillIds: string[];
  startingItemIds: { itemId: string; qty: number }[];
  skillUnlocks: { level: number; skillId: string }[];
  evolutions: EvolutionDef[];
}

// ---------- enemies ----------
export type EnemyRole = 'wild' | 'miniBoss' | 'regionBoss' | 'finalBoss';
export interface EnemyDef {
  id: string;
  name: string;
  affinity: Affinity;
  baseStats: Stats;            // at `level`
  level: number;
  attackPower: number;         // basic-attack power
  skillIds: string[];          // AI uses these (enemies never take quizzes)
  xpYield: number;
  role: EnemyRole;
  spriteKey: string;
  splitIntoId?: string;        // if hit by a splitTarget skill, replaced by two of these
  teachesSkillId?: string;     // TM-style: player learns this on defeat
  bossSoftScale?: boolean;     // region/final bosses soft-scale to player level
  battleBackgroundKey?: string; // overrides region default if set
}

// ---------- items ----------
export type ItemKind = 'buffer' | 'reagent' | 'statBooster' | 'energy' | 'evolutionMaterial';
export interface ItemEffect {
  healHp?: number;
  healHpPercent?: number;
  revive?: boolean;            // only works on a fainted target
  reviveHpPercent?: number;
  restoreEnergy?: number;
  statBoostStages?: Partial<Record<StatKey, number>>; // applied as buff stages
}
export interface ItemDef { id: string; name: string; kind: ItemKind; usableInBattle: boolean; effect: ItemEffect; description: string; }

// ---------- regions ----------
export interface RegionDef {
  id: string;
  index: number;               // 1..8
  name: string;
  topic: string;               // question topic file key
  tilemapKey: string;          // matches a key in assetManifest.tilemaps
  tilesetKey: string;
  battleBackgroundKey: string;
  wildEnemyIds: string[];
  encounterRatePerStep: number;// 0..1
  miniBossId: string;
  regionBossId: string;
  npcIds: string[];
  shrine: { questionTopic: string; questionCount: number; passRatio: number; rewardXp: number; rewardItemIds: string[]; };
  unlocksRegionId: string | null;
  bossReward: { xp: number; itemIds: string[]; skillId?: string };
}

// ---------- questions ----------
export interface BalanceEquationSpec {
  reactants: { formula: string; coeff: number }[];
  products: { formula: string; coeff: number }[];
}
export interface QuestionDef {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  format: 'mcq' | 'balanceEquation' | 'orderSteps';
  prompt: string;
  options?: string[];          // mcq: length 4
  answerIndex?: number;        // mcq: 0..3
  equation?: BalanceEquationSpec; // balanceEquation: coeff fields are the correct answer
  steps?: string[];            // orderSteps: 3..6 items, stored in the correct order
  explanation: string;         // one-line, shown after a wrong answer
  hint?: string;               // shown in Study Mode
}

// ---------- NPC dialogue ----------
export interface DialogueChoice { label: string; next: string; }
export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string;
  next?: string;               // linear continuation
  choices?: DialogueChoice[];  // branch
  setFlag?: string;            // sets a story flag on visit
  end?: boolean;               // terminal node
  launch?: 'shrine' | string; // 'shrine' or 'battle:<enemyId>' — handled by DialogueScene on end
}
export interface NpcDef {
  id: string;
  name: string;
  spriteKey: string;
  tile: { x: number; y: number };
  facing?: 'up' | 'down' | 'left' | 'right';
  dialogue: DialogueNode[];    // node[0] is the entry node
}

// ---------- asset manifest ----------
export type PlaceholderShape = 'rect' | 'circle';
export interface PlaceholderAsset { key: string; w: number; h: number; color: string; label?: string; shape?: PlaceholderShape; }
export interface AssetManifest {
  // logical key -> real file path (used by Phaser loader once real art exists)
  images: Record<string, string>;
  tilemaps: Record<string, string>;
  audio: Record<string, string>;
  // logical key -> placeholder spec (used until real art exists)
  placeholders: PlaceholderAsset[];
}

// ---------- type chart ----------
// attackerAffinity -> defenderAffinity -> multiplier (missing = 1)
export type TypeChart = Record<string, Record<string, number>>;

// ---------- save ----------
export interface TopicQuizStat { topic: string; asked: number; correct: number; recentMisses: number; }
export interface RegionProgress { entered: boolean; miniBossDefeated: boolean; bossDefeated: boolean; shrineCleared: boolean; }
export interface SaveSettings { studyMode: boolean; answerTimer: boolean; musicVolume: number; }
export interface SaveData {
  version: number;
  classId: string;
  evolutionStage: number;      // 0 = base
  level: number;
  xp: number;                  // total accumulated
  stats: Stats;                // current max stats (derived; stored for migration safety)
  currentHp: number;
  currentEnergy: number;
  unlockedSkillIds: string[];
  equippedSkillIds: string[];  // length 1..5
  skillTiers: Record<string, number>;  // skillId -> tier 0..MAX_TIER (absent => 0)
  reagentPoints: number;               // currency spent in the Refine Skills screen
  items: { itemId: string; qty: number }[];
  currentRegionId: string;
  regionProgress: Record<string, RegionProgress>;
  storyFlags: Record<string, boolean>;
  playerTile: { regionId: string; x: number; y: number };
  quizStats: Record<string, TopicQuizStat>; // keyed by topic
  settings: SaveSettings;
}

// ---------- loaded content bundle ----------
export interface GameContent {
  classes: ClassDef[];
  skills: Record<string, SkillDef>;
  enemies: Record<string, EnemyDef>;
  regions: RegionDef[];
  items: Record<string, ItemDef>;
  typeChart: TypeChart;
  questions: Record<string, QuestionDef[]>; // keyed by topic
  npcs: Record<string, NpcDef>;
  assets: AssetManifest;
}
