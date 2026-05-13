import type { Affinity, Stats, StatKey, StatusEffectInstance } from '../../content/types';

export interface Combatant {
  side: 'player' | 'enemy';
  name: string;
  affinity: Affinity;
  signatureAffinity: Affinity;   // for the affinity damage bonus (= affinity for enemies)
  level: number;
  maxHp: number; hp: number;
  atk: number; def: number; spd: number;
  maxEnergy: number; energy: number;
  statuses: StatusEffectInstance[];
  buffs: Partial<Record<StatKey, number>>; // stat stages, −6..+6
  isBoss: boolean;
  skillIds: string[];            // for the enemy AI; for the player this is the equipped loadout
  attackPower: number;           // basic-attack power
  enemyId?: string;              // set for enemies (used by Decomposition split)
  splitIntoId?: string;
  catalystBurstSkillId?: string; // populated Task 19, consumed Tasks 19/45
  skillTiers?: Record<string, number>; // player only; enemies are always tier 0
}

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'skill'; skillId: string; quizCorrect: boolean | null; widget?: { coeffs?: number[] }; fastAnswer?: boolean }
  | { kind: 'catalystBurst' }
  | { kind: 'item'; itemId: string }
  | { kind: 'run' };

export type BattleOutcome = 'ongoing' | 'playerWin' | 'playerLose' | 'fled';

export type BattleEvent =
  | { t: 'turnStart'; side: 'player' | 'enemy'; turn: number }
  | { t: 'energyRegen'; side: 'player' | 'enemy'; amount: number }
  | { t: 'attack'; side: 'player' | 'enemy'; skillId?: string; affinity: Affinity }
  | { t: 'quizFizzle'; skillId: string }
  | { t: 'damage'; target: 'player' | 'enemy'; amount: number; effectiveness: number; crit: boolean }
  | { t: 'heal'; target: 'player' | 'enemy'; amount: number }
  | { t: 'statusApplied'; target: 'player' | 'enemy'; id: string; turns: number }
  | { t: 'statusTick'; target: 'player' | 'enemy'; id: string; damage?: number }
  | { t: 'statusExpired'; target: 'player' | 'enemy'; id: string }
  | { t: 'buffsStripped'; target: 'player' | 'enemy' }
  | { t: 'extraAction'; side: 'player' | 'enemy' }
  | { t: 'precipitatedSkip'; side: 'player' | 'enemy' }
  | { t: 'chainChanged'; chain: number; multiplier: number; burstReady: boolean }
  | { t: 'enemySwitch'; toName: string; toEnemyId: string }
  | { t: 'item'; itemId: string; target: 'player' | 'enemy' }
  | { t: 'faint'; side: 'player' | 'enemy' }
  | { t: 'fleeFailed' }
  | { t: 'outcome'; outcome: BattleOutcome };

export interface BattleState {
  player: Combatant;
  enemy: Combatant;
  enemyQueue: Combatant[];        // additional enemies (Decomposition split → second half fights after the first)
  turn: number;                   // increments each time both sides have acted
  chain: number;                  // 0..5
  catalystBurstReady: boolean;
  pendingExtraActionFor: ('player' | 'enemy')[]; // FIFO of extra actions granted this turn
  outcome: BattleOutcome;
  rng: () => number;
  log: BattleEvent[];
  // remembers whose action came first this turn, for ordering
  actedThisTurn: { player: boolean; enemy: boolean };
}

export const clone = <T>(x: T): T => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
export const clampStage = (s: number): number => Math.max(-6, Math.min(6, s));
export function applyStage(value: number, stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? Math.floor(value * (2 + s) / 2) : Math.floor(value * 2 / (2 - s));
}
