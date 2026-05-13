# Economy + Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Drachms (currency), 47-item equipment system, and 8 per-region shops in a single milestone (v0.15.0-economy-equipment).

**Architecture:** Two sequential subagent phases — Phase A covers the pure data/logic layer (no Phaser, fully testable), Phase B covers the UI/scene layer which depends on Phase A types being committed. Equipment bonuses are layered on via `effectiveStats()` at display/battle time; `save.stats` is never mutated. Drachms are awarded in `applyVictory` using a formula on the enemy level with no enemies.json changes needed.

**Tech Stack:** TypeScript, Vitest, Phaser 3, Vite. JSON data files in `src/content/data/`. Pure logic in `src/systems/`. Phaser scenes in `src/scenes/`.

---

## Phase A — Data Layer (no Phaser, fully testable)

Dispatch as a single Sonnet subagent. All gates must pass at every commit inside this phase: `npx tsc --noEmit`, `npm test`, `npm run build`.

---

### Task A1: Extend types.ts with EquipmentDef, ShopDef, SaveData v4, GameContent

**Files:**
- Modify: `src/content/types.ts`

- [ ] **Step 1: Write the failing tsc check**

Run: `npx tsc --noEmit`
Expected: PASS (baseline confirmation before edits)

- [ ] **Step 2: Add EquipmentDef, ShopDef to types.ts; extend EnemyDef, SaveData, GameContent**

Open `src/content/types.ts`. Make the following additions:

After the `EnemyDef` interface (around line 78), add `dropEquipmentId?` to the existing interface:
```ts
export interface EnemyDef {
  id: string;
  name: string;
  affinity: Affinity;
  baseStats: Stats;
  level: number;
  attackPower: number;
  skillIds: string[];
  xpYield: number;
  role: EnemyRole;
  spriteKey: string;
  splitIntoId?: string;
  teachesSkillId?: string;
  bossSoftScale?: boolean;
  battleBackgroundKey?: string;
  dropEquipmentId?: string;        // first-clear boss drop; references an EquipmentDef id
}
```

After the `NpcDef` interface (around line 149), add:
```ts
// ---------- equipment ----------
export interface EquipmentDef {
  id: string;
  name: string;
  kind: 'weapon' | 'armour' | 'accessory';
  family: string;            // forge-arms | crucible-plate | ignition-set | vialwork | glassweave | buffer-set | voltaic | shieldplate | charge-set | universal
  wieldableBy: string[];     // classIds; empty array = any class (universal)
  tier: 1 | 2 | 3;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  hpBonus: number;
  description: string;       // ≤15 words, chem-flavoured
  shopPrice: number | null;  // null = boss-drop only
  dropFrom: Array<'miniBoss' | 'regionBoss' | 'finalBoss'>;
}

// ---------- shops ----------
export interface ShopDef {
  id: string;
  name: string;
  regionId: string;
  equipmentIds: string[];
}
```

Update `DialogueNode.launch` to include `'shop'`:
```ts
export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string;
  next?: string;
  choices?: DialogueChoice[];
  setFlag?: string;
  end?: boolean;
  launch?: 'shrine' | 'shop' | string; // 'shrine', 'shop', or 'battle:<enemyId>'
}
```

Update `SaveData` to add v4 fields (append after `settings`):
```ts
export interface SaveData {
  version: number;
  classId: string;
  evolutionStage: number;
  level: number;
  xp: number;
  stats: Stats;
  currentHp: number;
  currentEnergy: number;
  unlockedSkillIds: string[];
  equippedSkillIds: string[];
  skillTiers: Record<string, number>;
  reagentPoints: number;
  items: { itemId: string; qty: number }[];
  currentRegionId: string;
  regionProgress: Record<string, RegionProgress>;
  storyFlags: Record<string, boolean>;
  playerTile: { regionId: string; x: number; y: number };
  quizStats: Record<string, TopicQuizStat>;
  settings: SaveSettings;
  drachms: number;                            // v4
  ownedEquipmentIds: string[];                // v4
  equipped: {                                 // v4
    weapon: string | null;
    armour: string | null;
    accessory: string | null;
  };
}
```

Update `GameContent` to add equipment and shops:
```ts
export interface GameContent {
  classes: ClassDef[];
  skills: Record<string, SkillDef>;
  enemies: Record<string, EnemyDef>;
  regions: RegionDef[];
  items: Record<string, ItemDef>;
  typeChart: TypeChart;
  questions: Record<string, QuestionDef[]>;
  npcs: Record<string, NpcDef>;
  assets: AssetManifest;
  equipment: Record<string, EquipmentDef>;   // v4
  shops: Record<string, ShopDef>;             // v4
}
```

- [ ] **Step 3: Run tsc to confirm no type errors**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content/types.ts
git commit -m "feat(types): add EquipmentDef, ShopDef, SaveData v4 fields, EnemyDef.dropEquipmentId"
```

---

### Task A2: Create src/systems/equipment.ts

**Files:**
- Create: `src/systems/equipment.ts`
- Create: `tests/systems/equipment.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/systems/equipment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { equippedStatBonus, effectiveStats, canEquip } from '../../src/systems/equipment';
import type { EquipmentDef, SaveData } from '../../src/content/types';

const weapon: EquipmentDef = {
  id: 'test-weapon', name: 'Test Weapon', kind: 'weapon', family: 'forge-arms',
  wieldableBy: ['pyron'], tier: 1, atkBonus: 5, defBonus: 0, spdBonus: 2, hpBonus: 8,
  description: 'A test weapon.', shopPrice: 80, dropFrom: []
};
const armour: EquipmentDef = {
  id: 'test-armour', name: 'Test Armour', kind: 'armour', family: 'crucible-plate',
  wieldableBy: ['pyron'], tier: 1, atkBonus: 0, defBonus: 4, spdBonus: 0, hpBonus: 10,
  description: 'A test armour.', shopPrice: 90, dropFrom: []
};
const universalAcc: EquipmentDef = {
  id: 'universal-acc', name: 'Universal Acc', kind: 'accessory', family: 'universal',
  wieldableBy: [], tier: 2, atkBonus: 8, defBonus: 0, spdBonus: 3, hpBonus: 0,
  description: 'A universal accessory.', shopPrice: null, dropFrom: ['miniBoss']
};

const equipMap: Record<string, EquipmentDef> = {
  'test-weapon': weapon,
  'test-armour': armour,
  'universal-acc': universalAcc,
};

const baseEquipped = { weapon: null, armour: null, accessory: null };
const baseStats = { hp: 50, atk: 10, def: 8, spd: 7 };

describe('equippedStatBonus', () => {
  it('returns zero Stats when no equipment is equipped', () => {
    const bonus = equippedStatBonus(baseEquipped, equipMap);
    expect(bonus).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
  });

  it('sums weapon + armour bonuses correctly', () => {
    const bonus = equippedStatBonus(
      { weapon: 'test-weapon', armour: 'test-armour', accessory: null },
      equipMap
    );
    expect(bonus).toEqual({ atk: 5, def: 4, spd: 2, hp: 18 });
  });

  it('includes accessory bonus', () => {
    const bonus = equippedStatBonus(
      { weapon: null, armour: null, accessory: 'universal-acc' },
      equipMap
    );
    expect(bonus).toEqual({ atk: 8, def: 0, spd: 3, hp: 0 });
  });

  it('ignores unknown equipment ids gracefully', () => {
    const bonus = equippedStatBonus(
      { weapon: 'nonexistent', armour: null, accessory: null },
      equipMap
    );
    expect(bonus).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
  });
});

describe('effectiveStats', () => {
  it('returns save.stats unchanged when nothing is equipped', () => {
    const mockSave = { stats: baseStats, equipped: baseEquipped } as unknown as SaveData;
    expect(effectiveStats(mockSave, equipMap)).toEqual(baseStats);
  });

  it('adds equipment bonuses on top of save.stats without mutating save', () => {
    const mockSave = {
      stats: baseStats,
      equipped: { weapon: 'test-weapon', armour: 'test-armour', accessory: null }
    } as unknown as SaveData;
    const result = effectiveStats(mockSave, equipMap);
    expect(result).toEqual({ hp: 68, atk: 15, def: 12, spd: 9 });
    expect(mockSave.stats).toEqual(baseStats); // not mutated
  });
});

describe('canEquip', () => {
  it('returns true when classId is in wieldableBy', () => {
    expect(canEquip(weapon, 'pyron')).toBe(true);
  });

  it('returns false when classId is not in wieldableBy', () => {
    expect(canEquip(weapon, 'aqualis')).toBe(false);
  });

  it('returns true for any class when wieldableBy is empty (universal)', () => {
    expect(canEquip(universalAcc, 'pyron')).toBe(true);
    expect(canEquip(universalAcc, 'aqualis')).toBe(true);
    expect(canEquip(universalAcc, 'ionix')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/systems/equipment.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement src/systems/equipment.ts**

Create `src/systems/equipment.ts`:
```ts
import type { EquipmentDef, SaveData, Stats } from '../content/types';

export function equippedStatBonus(
  equipped: SaveData['equipped'],
  equipmentMap: Record<string, EquipmentDef>
): Stats {
  let atk = 0, def = 0, spd = 0, hp = 0;
  for (const slot of [equipped.weapon, equipped.armour, equipped.accessory]) {
    if (!slot) continue;
    const e = equipmentMap[slot];
    if (!e) continue;
    atk += e.atkBonus; def += e.defBonus; spd += e.spdBonus; hp += e.hpBonus;
  }
  return { atk, def, spd, hp };
}

export function effectiveStats(
  save: SaveData,
  equipmentMap: Record<string, EquipmentDef>
): Stats {
  const bonus = equippedStatBonus(save.equipped, equipmentMap);
  return {
    hp:  save.stats.hp  + bonus.hp,
    atk: save.stats.atk + bonus.atk,
    def: save.stats.def + bonus.def,
    spd: save.stats.spd + bonus.spd,
  };
}

export function canEquip(equipDef: EquipmentDef, classId: string): boolean {
  return equipDef.wieldableBy.length === 0 || equipDef.wieldableBy.includes(classId);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run tests/systems/equipment.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 6: Commit**

```bash
git add src/systems/equipment.ts tests/systems/equipment.test.ts
git commit -m "feat(systems): add equipment.ts with equippedStatBonus, effectiveStats, canEquip"
```

---

### Task A3: Bump SaveManager to v4 (migration + newGame)

**Files:**
- Modify: `src/systems/SaveManager.ts`
- Modify: `tests/systems/saveManager.test.ts`

- [ ] **Step 1: Write failing tests (append to saveManager.test.ts)**

Add to `tests/systems/saveManager.test.ts` after the existing `describe` blocks:

```ts
describe('SaveManager.newGame v4', () => {
  it('seeds drachms=0, ownedEquipmentIds=[], equipped with null slots', () => {
    const s = SaveManager.newGame('pyron', content);
    expect(s.version).toBe(4);
    expect(s.drachms).toBe(0);
    expect(s.ownedEquipmentIds).toEqual([]);
    expect(s.equipped).toEqual({ weapon: null, armour: null, accessory: null });
  });
});

describe('SaveManager migration v3→v4', () => {
  it('migrates a v3 save to v4, adding drachms, ownedEquipmentIds, and equipped', () => {
    const v3 = SaveManager.newGame('ionix', content);
    (v3 as unknown as Record<string, unknown>).version = 3;
    delete (v3 as unknown as Record<string, unknown>).drachms;
    delete (v3 as unknown as Record<string, unknown>).ownedEquipmentIds;
    delete (v3 as unknown as Record<string, unknown>).equipped;
    const st = memStorage();
    st.setItem(SAVE_KEY, JSON.stringify(v3));
    const r = SaveManager.load(content, st);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe(4);
      expect(r.data.drachms).toBe(0);
      expect(r.data.ownedEquipmentIds).toEqual([]);
      expect(r.data.equipped).toEqual({ weapon: null, armour: null, accessory: null });
    }
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run tests/systems/saveManager.test.ts`
Expected: FAIL (version mismatch, missing fields)

- [ ] **Step 3: Update SaveManager.ts**

In `src/systems/SaveManager.ts`:

1. Bump `CURRENT_SAVE_VERSION` to `4`.

2. Add the v3→v4 migration step at the end of the `STEPS` array (inside `migrate`):
```ts
(o) => { // 3 -> 4 : Economy + Equipment
  o.drachms = 0;
  o.ownedEquipmentIds = [];
  o.equipped = { weapon: null, armour: null, accessory: null };
  o.version = 4;
},
```

3. In `newGame`, add the three new fields to the returned object after `settings`:
```ts
drachms: 0,
ownedEquipmentIds: [],
equipped: { weapon: null, armour: null, accessory: null },
```

4. In `migrate`, extend the shape-checks block (after the existing checks) to verify v4 fields:
```ts
if (typeof o.drachms !== 'number') throw new Error('corrupt: bad drachms');
if (!isArr(o.ownedEquipmentIds)) throw new Error('corrupt: bad ownedEquipmentIds');
if (!isObj(o.equipped)) throw new Error('corrupt: bad equipped');
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run tests/systems/saveManager.test.ts`
Expected: PASS

- [ ] **Step 5: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 6: Commit**

```bash
git add src/systems/SaveManager.ts tests/systems/saveManager.test.ts
git commit -m "feat(save): bump to v4 — drachms, ownedEquipmentIds, equipped; migration step added"
```

---

### Task A4: Award Drachms and boss equipment drops in applyVictory

**Files:**
- Modify: `src/scenes/battleVictory.ts`
- Modify: `tests/scenes/battleVictory.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/scenes/battleVictory.test.ts`:

```ts
describe('applyVictory — Drachm awards', () => {
  it('a wild kill awards floor(level × 3) Drachms', () => {
    const save = SaveManager.newGame('pyron', content);
    const protium = content.enemies['protium']!; // level 2
    const { save: after } = applyVictory(save, protium, region1, 0, content);
    expect(after.drachms).toBe(Math.floor(protium.level * 3));
  });

  it('a miniBoss kill awards floor(level × 8) Drachms plus equipment drop banner on first clear', () => {
    const save = SaveManager.newGame('pyron', content);
    const miniBoss = content.enemies[region1.miniBossId]!; // unstable-deuteride Lv6
    // inject a dropEquipmentId into the enemy def for testing
    const enemyWithDrop = { ...miniBoss, dropEquipmentId: 'lab-relic-alpha' };
    // inject the equipment into content
    const contentWithEquip = {
      ...content,
      equipment: {
        'lab-relic-alpha': {
          id: 'lab-relic-alpha', name: 'Lab Relic Alpha', kind: 'accessory',
          family: 'universal', wieldableBy: [], tier: 2,
          atkBonus: 8, defBonus: 0, spdBonus: 3, hpBonus: 0,
          description: 'A universal lab relic.', shopPrice: null, dropFrom: ['miniBoss']
        }
      },
      shops: {}
    };
    const { save: after, banners } = applyVictory(save, enemyWithDrop, region1, 0, contentWithEquip);
    expect(after.drachms).toBe(Math.floor(enemyWithDrop.level * 8));
    expect(after.ownedEquipmentIds).toContain('lab-relic-alpha');
    expect(banners.some(b => /Lab Relic Alpha/i.test(b))).toBe(true);
  });

  it('a second miniBoss kill does not duplicate the equipment drop', () => {
    const save = SaveManager.newGame('pyron', content);
    const miniBoss = { ...content.enemies[region1.miniBossId]!, dropEquipmentId: 'lab-relic-alpha' };
    const contentWithEquip = {
      ...content,
      equipment: {
        'lab-relic-alpha': {
          id: 'lab-relic-alpha', name: 'Lab Relic Alpha', kind: 'accessory',
          family: 'universal', wieldableBy: [], tier: 2,
          atkBonus: 8, defBonus: 0, spdBonus: 3, hpBonus: 0,
          description: 'A universal lab relic.', shopPrice: null, dropFrom: ['miniBoss']
        }
      },
      shops: {}
    };
    const { save: after1 } = applyVictory(save, miniBoss, region1, 0, contentWithEquip);
    const { save: after2 } = applyVictory(after1, miniBoss, region1, 0, contentWithEquip);
    expect(after2.ownedEquipmentIds.filter(id => id === 'lab-relic-alpha')).toHaveLength(1);
  });

  it('a regionBoss kill awards floor(level × 15) Drachms', () => {
    const save = SaveManager.newGame('pyron', content);
    save.level = 10;
    const boss = content.enemies[region1.regionBossId]!; // the-unstable-isotope Lv9
    const contentWithEquip = { ...content, equipment: {}, shops: {} };
    const { save: after } = applyVictory(save, boss, region1, 0, contentWithEquip);
    expect(after.drachms).toBe(Math.floor(boss.level * 15));
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run tests/scenes/battleVictory.test.ts`
Expected: FAIL (drachms is undefined, content.equipment missing)

- [ ] **Step 3: Update applyVictory in battleVictory.ts**

In `src/scenes/battleVictory.ts`:

1. Change the Drachm award section. Add it after the Reagent Points block (around line 83, after `s.reagentPoints += rpGain`):

```ts
// Drachms (economy currency)
const drachmsGain = enemyDef.role === 'miniBoss' ? Math.floor(enemyDef.level * 8)
  : (enemyDef.role === 'regionBoss' || enemyDef.role === 'finalBoss') ? Math.floor(enemyDef.level * 15)
  : Math.floor(enemyDef.level * 3);
s.drachms = (s.drachms ?? 0) + drachmsGain;

// Boss equipment drop (first-clear only, before bossDefeated is set)
if (enemyDef.dropEquipmentId && !rp.bossDefeated) {
  const dropId = enemyDef.dropEquipmentId;
  if (!s.ownedEquipmentIds.includes(dropId)) {
    s.ownedEquipmentIds.push(dropId);
    const dropName = content.equipment?.[dropId]?.name ?? dropId;
    banners.push(`Found: ${dropName}!`);
  }
}
```

**Important:** This block must come BEFORE `rp.bossDefeated = true` is set. In the current code, `rp.bossDefeated = true` is set inside the `else if (role === 'regionBoss' || role === 'finalBoss')` block. The equipment drop check uses `!rp.bossDefeated` to gate first-clear. The Drachm award has no first-clear restriction (awarded every kill).

The full updated boss-clear section should be:
```ts
const rp: RegionProgress = (s.regionProgress[region.id] ??= { entered: true, miniBossDefeated: false, bossDefeated: false, shrineCleared: false });
if (enemyDef.role === 'miniBoss') {
  // Equipment drop (first-clear, before flag is set)
  if (enemyDef.dropEquipmentId && !rp.miniBossDefeated) {
    const dropId = enemyDef.dropEquipmentId;
    if (!s.ownedEquipmentIds.includes(dropId)) {
      s.ownedEquipmentIds.push(dropId);
      banners.push(`Found: ${content.equipment?.[dropId]?.name ?? dropId}!`);
    }
  }
  rp.miniBossDefeated = true;
  s.storyFlags[`miniboss_${region.id}_done`] = true;
  banners.push('The guardian falls — the path ahead is clear.');
} else if (enemyDef.role === 'regionBoss' || enemyDef.role === 'finalBoss') {
  // Equipment drop (first-clear, before flag is set)
  if (enemyDef.dropEquipmentId && !rp.bossDefeated) {
    const dropId = enemyDef.dropEquipmentId;
    if (!s.ownedEquipmentIds.includes(dropId)) {
      s.ownedEquipmentIds.push(dropId);
      banners.push(`Found: ${content.equipment?.[dropId]?.name ?? dropId}!`);
    }
  }
  rp.bossDefeated = true;
  s.storyFlags[`equilibrium_restored_${region.id}`] = true;
  award(region.bossReward.xp, 'Region cleared!');
  for (const itemId of region.bossReward.itemIds) {
    const e = s.items.find(i => i.itemId === itemId);
    if (e) e.qty += 1; else s.items.push({ itemId, qty: 1 });
  }
  if (region.bossReward.skillId) learn(region.bossReward.skillId, `Learned ${content.skills[region.bossReward.skillId]?.name ?? region.bossReward.skillId}!`);
  banners.push(`Equilibrium restored to ${region.name}!`);
}
if (enemyDef.role === 'finalBoss') {
  s.storyFlags['game_complete'] = true;
  banners.push('Equilibrium is whole again. Æquor is saved.');
}

// Reagent Points
const rpGain = enemyDef.role === 'miniBoss' ? RP_AWARDS.miniBoss
  : enemyDef.role === 'regionBoss' ? RP_AWARDS.regionBoss
  : enemyDef.role === 'finalBoss' ? RP_AWARDS.finalBoss
  : RP_AWARDS.wild;
s.reagentPoints += rpGain;
banners.push(`+${rpGain} Reagent Points`);

// Drachms
const drachmsGain = (enemyDef.role === 'regionBoss' || enemyDef.role === 'finalBoss')
  ? Math.floor(enemyDef.level * 15)
  : enemyDef.role === 'miniBoss'
  ? Math.floor(enemyDef.level * 8)
  : Math.floor(enemyDef.level * 3);
s.drachms = (s.drachms ?? 0) + drachmsGain;
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run tests/scenes/battleVictory.test.ts`
Expected: PASS (all tests including new Drachm tests)

- [ ] **Step 5: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 6: Commit**

```bash
git add src/scenes/battleVictory.ts tests/scenes/battleVictory.test.ts
git commit -m "feat(battle): award Drachms on victory; equipment drop on first-clear boss kill"
```

---

### Task A5: Add validateEquipment and validateShop to schema.ts

**Files:**
- Modify: `src/content/schema.ts`

- [ ] **Step 1: Add validators at the end of schema.ts**

```ts
export function validateEquipment(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('equipment: not an object'); return r; }
  const who = `equipment ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  requireFields(raw, {
    id: isStr, name: isStr,
    kind: (v) => v === 'weapon' || v === 'armour' || v === 'accessory',
    family: isStr,
    wieldableBy: (v) => Array.isArray(v) && (v as unknown[]).every(isStr),
    tier: (v) => v === 1 || v === 2 || v === 3,
    atkBonus: isNum, defBonus: isNum, spdBonus: isNum, hpBonus: isNum,
    description: isStr,
    dropFrom: (v) => Array.isArray(v),
  }, who, r.errors);
  if ('shopPrice' in raw && raw['shopPrice'] !== null && !isNum(raw['shopPrice'])) {
    r.errors.push(`${who}: shopPrice must be number or null`);
  }
  return r;
}

export function validateShop(raw: unknown): ValidationResult {
  const r = ok();
  if (!isObj(raw)) { r.errors.push('shop: not an object'); return r; }
  const who = `shop ${isStr(raw['id']) ? raw['id'] : '(no id)'}`;
  requireFields(raw, {
    id: isStr, name: isStr, regionId: isStr,
    equipmentIds: (v) => Array.isArray(v) && (v as unknown[]).every(isStr),
  }, who, r.errors);
  return r;
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 3: Commit**

```bash
git add src/content/schema.ts
git commit -m "feat(schema): add validateEquipment and validateShop"
```

---

### Task A6: Extend ContentLoader and loadGameContent.ts

**Files:**
- Modify: `src/content/ContentLoader.ts`
- Modify: `src/content/loadGameContent.ts`

- [ ] **Step 1: Extend ContentLoader.ts**

In `src/content/ContentLoader.ts`:

1. Add `equipment` and `shops` imports to the `RawContent` interface:
```ts
interface RawContent {
  classes: unknown[]; skills: Record<string, unknown>; enemies: Record<string, unknown>;
  regions: unknown[]; items: Record<string, unknown>; typeChart: unknown;
  questions: Record<string, unknown[]>; npcs: Record<string, unknown>; assets: unknown;
  equipment: Record<string, unknown>;   // new
  shops: Record<string, unknown>;       // new
}
```

2. Import the new validators at the top:
```ts
import {
  validateClass, validateSkill, validateEnemy, validateItem, validateRegion, validateNpc,
  validateAssetManifest, validateTypeChart, validateQuestion, validateGameContent,
  validateEquipment, validateShop, type ValidationResult
} from './schema';
```

3. Inside `fromRaw`, after the npcs validation block, add equipment and shop validation:
```ts
// equipment
const equipment: Record<string, EquipmentDef> = {};
for (const [id, e] of Object.entries(raw.equipment)) {
  const v = validateEquipment({ ...(e as object), id: (e as Record<string,unknown>)?.id ?? id });
  if (v.errors.length) errors.push(...v.errors);
  else equipment[id] = e as EquipmentDef;
}
// shops
const shops: Record<string, ShopDef> = {};
for (const [id, s] of Object.entries(raw.shops)) {
  const v = validateShop({ ...(s as object), id: (s as Record<string,unknown>)?.id ?? id });
  if (v.errors.length) errors.push(...v.errors);
  else shops[id] = s as ShopDef;
}
```

4. Add `EquipmentDef` and `ShopDef` to the import from `./types`:
```ts
import type { GameContent, QuestionDef, ItemDef, SkillDef, ClassDef, EnemyDef, RegionDef, NpcDef, AssetManifest, TypeChart, EquipmentDef, ShopDef } from './types';
```

5. Add the new fields to the `content` object:
```ts
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
  equipment,    // new
  shops,        // new
};
```

- [ ] **Step 2: Update loadGameContent.ts**

In `src/content/loadGameContent.ts`, add the imports for the new JSON files (create empty stubs first if files don't exist yet):

```ts
import equipment from './data/equipment.json';
import shops from './data/shops.json';
```

And add them to the `ContentLoader.fromRaw` call:
```ts
export function loadGameContent(): { content: GameContent; warnings: string[] } {
  return ContentLoader.fromRaw({
    classes: classes as unknown[],
    skills: skills as Record<string, unknown>,
    enemies: enemies as Record<string, unknown>,
    regions: regions as unknown[],
    items: items as Record<string, unknown>,
    typeChart,
    questions: { 'atomic-structure': atomicStructure as unknown[], 'bonding': bonding as unknown[], 'reaction-types': reactionTypes as unknown[], 'balancing-equations': balancingEquations as unknown[], 'reaction-rates': reactionRates as unknown[], 'acids-bases': acidsBases as unknown[], 'energy-changes': energyChanges as unknown[], 'equilibrium': equilibrium as unknown[] },
    npcs: npcs as Record<string, unknown>,
    assets,
    equipment: equipment as Record<string, unknown>,
    shops: shops as Record<string, unknown>,
  });
}
```

- [ ] **Step 3: Create empty stub JSON files so tsc doesn't fail**

Create `src/content/data/equipment.json`:
```json
{}
```

Create `src/content/data/shops.json`:
```json
{}
```

- [ ] **Step 4: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green (empty equipment/shops is valid)

- [ ] **Step 5: Commit**

```bash
git add src/content/ContentLoader.ts src/content/loadGameContent.ts src/content/data/equipment.json src/content/data/shops.json
git commit -m "feat(content): wire equipment.json and shops.json into content loader"
```

---

### Task A7: Create equipment.json (47 items)

**Files:**
- Modify: `src/content/data/equipment.json`

- [ ] **Step 1: Write equipment.json with all 47 items**

Replace `src/content/data/equipment.json` with:

```json
{
  "ember-rod":         { "id": "ember-rod",         "name": "Ember Rod",         "kind": "weapon",    "family": "forge-arms",     "wieldableBy": ["pyron"],   "tier": 1, "atkBonus": 4, "defBonus": 0, "spdBonus": 1, "hpBonus": 5,  "description": "A forged rod channelling combustion energy.",    "shopPrice": 80,  "dropFrom": [] },
  "ignition-lance":    { "id": "ignition-lance",    "name": "Ignition Lance",    "kind": "weapon",    "family": "forge-arms",     "wieldableBy": ["pyron"],   "tier": 1, "atkBonus": 6, "defBonus": 0, "spdBonus": 2, "hpBonus": 6,  "description": "A sharp lance with a smouldering tip.",          "shopPrice": 115, "dropFrom": [] },
  "catalyst-blade":    { "id": "catalyst-blade",    "name": "Catalyst Blade",    "kind": "weapon",    "family": "forge-arms",     "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 9, "defBonus": 0, "spdBonus": 3, "hpBonus": 15, "description": "A blade imbued with catalytic reaction energy.",  "shopPrice": 230, "dropFrom": [] },
  "pyroclast-arm":     { "id": "pyroclast-arm",     "name": "Pyroclast Arm",     "kind": "weapon",    "family": "forge-arms",     "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 11,"defBonus": 1, "spdBonus": 4, "hpBonus": 18, "description": "Heavy arm that erupts on impact.",               "shopPrice": 290, "dropFrom": [] },
  "forge-sovereign":   { "id": "forge-sovereign",   "name": "Forge Sovereign",   "kind": "weapon",    "family": "forge-arms",     "wieldableBy": ["pyron"],   "tier": 3, "atkBonus": 15,"defBonus": 2, "spdBonus": 5, "hpBonus": 32, "description": "Master weapon of the forge-born pyron lineage.", "shopPrice": null,"dropFrom": [] },

  "reagent-vial":      { "id": "reagent-vial",      "name": "Reagent Vial",      "kind": "weapon",    "family": "vialwork",       "wieldableBy": ["aqualis"], "tier": 1, "atkBonus": 3, "defBonus": 0, "spdBonus": 2, "hpBonus": 5,  "description": "A vial of reactive solution, weaponised.",       "shopPrice": 80,  "dropFrom": [] },
  "acid-flask":        { "id": "acid-flask",        "name": "Acid Flask",        "kind": "weapon",    "family": "vialwork",       "wieldableBy": ["aqualis"], "tier": 1, "atkBonus": 5, "defBonus": 0, "spdBonus": 3, "hpBonus": 6,  "description": "A flask of concentrated acid solution.",         "shopPrice": 115, "dropFrom": [] },
  "buffer-lance":      { "id": "buffer-lance",      "name": "Buffer Lance",      "kind": "weapon",    "family": "vialwork",       "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 8, "defBonus": 1, "spdBonus": 4, "hpBonus": 16, "description": "Lance buffered in equilibrium with its target.", "shopPrice": 240, "dropFrom": [] },
  "dissolution-staff": { "id": "dissolution-staff", "name": "Dissolution Staff", "kind": "weapon",    "family": "vialwork",       "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 11,"defBonus": 0, "spdBonus": 5, "hpBonus": 18, "description": "Staff tuned to dissolve enemy reactions.",       "shopPrice": 290, "dropFrom": [] },
  "titration-spire":   { "id": "titration-spire",   "name": "Titration Spire",   "kind": "weapon",    "family": "vialwork",       "wieldableBy": ["aqualis"], "tier": 3, "atkBonus": 14,"defBonus": 1, "spdBonus": 6, "hpBonus": 32, "description": "Perfected by a thousand careful titrations.",    "shopPrice": null,"dropFrom": [] },

  "volt-rod":          { "id": "volt-rod",          "name": "Volt Rod",          "kind": "weapon",    "family": "voltaic",        "wieldableBy": ["ionix"],   "tier": 1, "atkBonus": 4, "defBonus": 0, "spdBonus": 1, "hpBonus": 5,  "description": "A rod crackling with ionic charge.",             "shopPrice": 85,  "dropFrom": [] },
  "charge-lance":      { "id": "charge-lance",      "name": "Charge Lance",      "kind": "weapon",    "family": "voltaic",        "wieldableBy": ["ionix"],   "tier": 1, "atkBonus": 5, "defBonus": 0, "spdBonus": 2, "hpBonus": 6,  "description": "A lance that discharges on each strike.",        "shopPrice": 115, "dropFrom": [] },
  "electrode-saber":   { "id": "electrode-saber",   "name": "Electrode Saber",   "kind": "weapon",    "family": "voltaic",        "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 9, "defBonus": 0, "spdBonus": 3, "hpBonus": 16, "description": "A saber forged from an electrode core.",         "shopPrice": 240, "dropFrom": [] },
  "ion-cannon":        { "id": "ion-cannon",        "name": "Ion Cannon",        "kind": "weapon",    "family": "voltaic",        "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 12,"defBonus": 1, "spdBonus": 4, "hpBonus": 18, "description": "Fires concentrated ionic bursts on contact.",    "shopPrice": 290, "dropFrom": [] },
  "voltaic-sovereign": { "id": "voltaic-sovereign", "name": "Voltaic Sovereign", "kind": "weapon",    "family": "voltaic",        "wieldableBy": ["ionix"],   "tier": 3, "atkBonus": 14,"defBonus": 2, "spdBonus": 5, "hpBonus": 30, "description": "Ionix pinnacle weapon, fully charged.",          "shopPrice": null,"dropFrom": [] },

  "cinder-vest":       { "id": "cinder-vest",       "name": "Cinder Vest",       "kind": "armour",    "family": "crucible-plate", "wieldableBy": ["pyron"],   "tier": 1, "atkBonus": 0, "defBonus": 4, "spdBonus": 0, "hpBonus": 8,  "description": "Vest hardened in a forge fire.",                  "shopPrice": 90,  "dropFrom": [] },
  "forge-carapace":    { "id": "forge-carapace",    "name": "Forge Carapace",    "kind": "armour",    "family": "crucible-plate", "wieldableBy": ["pyron"],   "tier": 1, "atkBonus": 0, "defBonus": 5, "spdBonus": 1, "hpBonus": 10, "description": "Thick carapace of forge-fired ore.",              "shopPrice": 120, "dropFrom": [] },
  "magma-plate":       { "id": "magma-plate",       "name": "Magma Plate",       "kind": "armour",    "family": "crucible-plate", "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 1, "defBonus": 8, "spdBonus": 2, "hpBonus": 20, "description": "Plating that absorbs intense thermal shocks.",    "shopPrice": 250, "dropFrom": [] },
  "crucible-mantle":   { "id": "crucible-mantle",   "name": "Crucible Mantle",   "kind": "armour",    "family": "crucible-plate", "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 0, "defBonus": 11,"spdBonus": 1, "hpBonus": 22, "description": "Mantle forged in the deepest crucible fires.",    "shopPrice": 310, "dropFrom": [] },
  "inferno-aegis":     { "id": "inferno-aegis",     "name": "Inferno Aegis",     "kind": "armour",    "family": "crucible-plate", "wieldableBy": ["pyron"],   "tier": 3, "atkBonus": 2, "defBonus": 15,"spdBonus": 3, "hpBonus": 38, "description": "Legendary armour of the pyron elders.",          "shopPrice": 740, "dropFrom": [] },

  "flask-wrap":        { "id": "flask-wrap",        "name": "Flask Wrap",        "kind": "armour",    "family": "glassweave",     "wieldableBy": ["aqualis"], "tier": 1, "atkBonus": 0, "defBonus": 3, "spdBonus": 1, "hpBonus": 8,  "description": "Glassweave that distributes impact forces.",      "shopPrice": 90,  "dropFrom": [] },
  "membrane-coat":     { "id": "membrane-coat",     "name": "Membrane Coat",     "kind": "armour",    "family": "glassweave",     "wieldableBy": ["aqualis"], "tier": 1, "atkBonus": 0, "defBonus": 5, "spdBonus": 2, "hpBonus": 10, "description": "Semipermeable coat filtering incoming harm.",     "shopPrice": 120, "dropFrom": [] },
  "buffer-plate":      { "id": "buffer-plate",      "name": "Buffer Plate",      "kind": "armour",    "family": "glassweave",     "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 0, "defBonus": 9, "spdBonus": 2, "hpBonus": 20, "description": "Plate tuned to buffer all incoming force.",       "shopPrice": 250, "dropFrom": [] },
  "solvent-shield":    { "id": "solvent-shield",    "name": "Solvent Shield",    "kind": "armour",    "family": "glassweave",     "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 0, "defBonus": 11,"spdBonus": 3, "hpBonus": 22, "description": "Dissolves incoming attack force on contact.",     "shopPrice": 310, "dropFrom": [] },
  "aqualis-mantle":    { "id": "aqualis-mantle",    "name": "Aqualis Mantle",    "kind": "armour",    "family": "glassweave",     "wieldableBy": ["aqualis"], "tier": 3, "atkBonus": 1, "defBonus": 15,"spdBonus": 4, "hpBonus": 40, "description": "Mantle woven by master aqualis chemists.",        "shopPrice": 760, "dropFrom": [] },

  "static-wrap":       { "id": "static-wrap",       "name": "Static Wrap",       "kind": "armour",    "family": "shieldplate",    "wieldableBy": ["ionix"],   "tier": 1, "atkBonus": 0, "defBonus": 4, "spdBonus": 0, "hpBonus": 7,  "description": "Wrap that deflects static charges away.",        "shopPrice": 90,  "dropFrom": [] },
  "insulating-plate":  { "id": "insulating-plate",  "name": "Insulating Plate",  "kind": "armour",    "family": "shieldplate",    "wieldableBy": ["ionix"],   "tier": 1, "atkBonus": 0, "defBonus": 6, "spdBonus": 1, "hpBonus": 9,  "description": "Plate that insulates vital organs from charge.",  "shopPrice": 120, "dropFrom": [] },
  "conductive-shield": { "id": "conductive-shield", "name": "Conductive Shield", "kind": "armour",    "family": "shieldplate",    "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 0, "defBonus": 9, "spdBonus": 2, "hpBonus": 20, "description": "Conducts harmful energy safely away.",           "shopPrice": 250, "dropFrom": [] },
  "ionic-bulwark":     { "id": "ionic-bulwark",     "name": "Ionic Bulwark",     "kind": "armour",    "family": "shieldplate",    "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 1, "defBonus": 12,"spdBonus": 2, "hpBonus": 22, "description": "Bulwark forged from densely packed ion lattices.","shopPrice": 310, "dropFrom": [] },
  "volt-shell":        { "id": "volt-shell",        "name": "Volt Shell",        "kind": "armour",    "family": "shieldplate",    "wieldableBy": ["ionix"],   "tier": 3, "atkBonus": 1, "defBonus": 15,"spdBonus": 3, "hpBonus": 40, "description": "Shell of pure electrical resistance.",           "shopPrice": 760, "dropFrom": [] },

  "ignition-core":     { "id": "ignition-core",     "name": "Ignition Core",     "kind": "accessory", "family": "ignition-set",   "wieldableBy": ["pyron"],   "tier": 1, "atkBonus": 6, "defBonus": 0, "spdBonus": 0, "hpBonus": 0,  "description": "Core that ignites attack power on reaction.",    "shopPrice": 100, "dropFrom": [] },
  "combustion-ring":   { "id": "combustion-ring",   "name": "Combustion Ring",   "kind": "accessory", "family": "ignition-set",   "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 0, "defBonus": 0, "spdBonus": 5, "hpBonus": 0,  "description": "Ring accelerating combustion reaction speed.",   "shopPrice": 270, "dropFrom": [] },
  "forge-talisman":    { "id": "forge-talisman",    "name": "Forge Talisman",    "kind": "accessory", "family": "ignition-set",   "wieldableBy": ["pyron"],   "tier": 2, "atkBonus": 0, "defBonus": 6, "spdBonus": 0, "hpBonus": 20, "description": "Talisman granting forge-hardened durability.",   "shopPrice": 310, "dropFrom": [] },

  "buffer-flask":      { "id": "buffer-flask",      "name": "Buffer Flask",      "kind": "accessory", "family": "buffer-set",     "wieldableBy": ["aqualis"], "tier": 1, "atkBonus": 0, "defBonus": 5, "spdBonus": 0, "hpBonus": 0,  "description": "Flask maintaining defensive chemical balance.",   "shopPrice": 100, "dropFrom": [] },
  "flow-catalyst":     { "id": "flow-catalyst",     "name": "Flow Catalyst",     "kind": "accessory", "family": "buffer-set",     "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 0, "defBonus": 0, "spdBonus": 5, "hpBonus": 0,  "description": "Catalyst that accelerates solution flow rate.",  "shopPrice": 270, "dropFrom": [] },
  "aqualis-talisman":  { "id": "aqualis-talisman",  "name": "Aqualis Talisman",  "kind": "accessory", "family": "buffer-set",     "wieldableBy": ["aqualis"], "tier": 2, "atkBonus": 5, "defBonus": 0, "spdBonus": 0, "hpBonus": 15, "description": "Talisman of the deep solution chemists.",        "shopPrice": 310, "dropFrom": [] },

  "charge-capacitor":  { "id": "charge-capacitor",  "name": "Charge Capacitor",  "kind": "accessory", "family": "charge-set",     "wieldableBy": ["ionix"],   "tier": 1, "atkBonus": 6, "defBonus": 0, "spdBonus": 0, "hpBonus": 0,  "description": "Capacitor storing ionic attack charge.",         "shopPrice": 100, "dropFrom": [] },
  "discharge-ring":    { "id": "discharge-ring",    "name": "Discharge Ring",    "kind": "accessory", "family": "charge-set",     "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 0, "defBonus": 0, "spdBonus": 6, "hpBonus": 0,  "description": "Ring releasing static for sudden speed bursts.", "shopPrice": 270, "dropFrom": [] },
  "ionix-talisman":    { "id": "ionix-talisman",    "name": "Ionix Talisman",    "kind": "accessory", "family": "charge-set",     "wieldableBy": ["ionix"],   "tier": 2, "atkBonus": 0, "defBonus": 5, "spdBonus": 0, "hpBonus": 18, "description": "Talisman of the ionix lineage.",                 "shopPrice": 310, "dropFrom": [] },

  "lab-relic-alpha":   { "id": "lab-relic-alpha",   "name": "Lab Relic Alpha",   "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 2, "atkBonus": 8, "defBonus": 0, "spdBonus": 3, "hpBonus": 0,  "description": "Relic resonating with elemental frequencies.",   "shopPrice": null,"dropFrom": ["miniBoss"] },
  "lab-relic-beta":    { "id": "lab-relic-beta",    "name": "Lab Relic Beta",    "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 2, "atkBonus": 0, "defBonus": 8, "spdBonus": 0, "hpBonus": 15, "description": "Crystal formed in deep bonding reactions.",       "shopPrice": null,"dropFrom": ["miniBoss"] },
  "lab-relic-gamma":   { "id": "lab-relic-gamma",   "name": "Lab Relic Gamma",   "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 2, "atkBonus": 0, "defBonus": 0, "spdBonus": 7, "hpBonus": 12, "description": "Charm attuned to reaction energies.",            "shopPrice": null,"dropFrom": ["miniBoss"] },
  "lab-relic-delta":   { "id": "lab-relic-delta",   "name": "Lab Relic Delta",   "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 2, "atkBonus": 5, "defBonus": 5, "spdBonus": 0, "hpBonus": 0,  "description": "Pendant maintaining elemental balance.",         "shopPrice": null,"dropFrom": ["miniBoss"] },
  "lab-relic-epsilon": { "id": "lab-relic-epsilon", "name": "Lab Relic Epsilon", "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 3, "atkBonus": 14,"defBonus": 0, "spdBonus": 5, "hpBonus": 0,  "description": "Sovereign relic of the elemental masters.",      "shopPrice": null,"dropFrom": ["regionBoss", "finalBoss"] },
  "lab-relic-zeta":    { "id": "lab-relic-zeta",    "name": "Lab Relic Zeta",    "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 3, "atkBonus": 0, "defBonus": 14,"spdBonus": 0, "hpBonus": 32, "description": "Crystal of the ancient bonding masters.",        "shopPrice": null,"dropFrom": ["regionBoss", "finalBoss"] },
  "lab-relic-eta":     { "id": "lab-relic-eta",     "name": "Lab Relic Eta",     "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 3, "atkBonus": 0, "defBonus": 0, "spdBonus": 8, "hpBonus": 30, "description": "Relic harnessing pure reaction momentum.",       "shopPrice": null,"dropFrom": ["regionBoss", "finalBoss"] },
  "lab-relic-theta":   { "id": "lab-relic-theta",   "name": "Lab Relic Theta",   "kind": "accessory", "family": "universal",      "wieldableBy": [],          "tier": 3, "atkBonus": 8, "defBonus": 8, "spdBonus": 0, "hpBonus": 0,  "description": "Talisman of perfect elemental equilibrium.",     "shopPrice": null,"dropFrom": ["regionBoss", "finalBoss"] }
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green (47 items validated, no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/content/data/equipment.json
git commit -m "feat(content): add equipment.json — 47 items (15 weapons, 15 armours, 9 class accs, 8 universal)"
```

---

### Task A8: Create shops.json (8 shop defs)

**Files:**
- Modify: `src/content/data/shops.json`

- [ ] **Step 1: Write shops.json**

Replace `src/content/data/shops.json` with the following. Shop inventories:
- R1–R2: T1 items only
- R3–R4: T1 + T2 items
- R5–R6: T2 items only
- R7–R8: T2 + T3 armours (T3 weapons have `shopPrice: null`, not stocked)

```json
{
  "shop-elemental-reaches": {
    "id": "shop-elemental-reaches",
    "name": "Curie's Cache",
    "regionId": "elemental-reaches",
    "equipmentIds": [
      "ember-rod", "ignition-lance", "reagent-vial", "acid-flask", "volt-rod", "charge-lance",
      "cinder-vest", "forge-carapace", "flask-wrap", "membrane-coat", "static-wrap", "insulating-plate",
      "ignition-core", "buffer-flask", "charge-capacitor"
    ]
  },
  "shop-bonding-forge": {
    "id": "shop-bonding-forge",
    "name": "The Bonded Vault",
    "regionId": "bonding-forge",
    "equipmentIds": [
      "ember-rod", "ignition-lance", "reagent-vial", "acid-flask", "volt-rod", "charge-lance",
      "cinder-vest", "forge-carapace", "flask-wrap", "membrane-coat", "static-wrap", "insulating-plate",
      "ignition-core", "buffer-flask", "charge-capacitor"
    ]
  },
  "shop-reaction-hollow": {
    "id": "shop-reaction-hollow",
    "name": "Hollow Reagents",
    "regionId": "reaction-hollow",
    "equipmentIds": [
      "ember-rod", "ignition-lance", "reagent-vial", "acid-flask", "volt-rod", "charge-lance",
      "cinder-vest", "forge-carapace", "flask-wrap", "membrane-coat", "static-wrap", "insulating-plate",
      "ignition-core", "buffer-flask", "charge-capacitor",
      "catalyst-blade", "buffer-lance", "electrode-saber",
      "magma-plate", "buffer-plate", "conductive-shield",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  },
  "shop-balance-halls": {
    "id": "shop-balance-halls",
    "name": "The Balanced Scales",
    "regionId": "balance-halls",
    "equipmentIds": [
      "ember-rod", "ignition-lance", "reagent-vial", "acid-flask", "volt-rod", "charge-lance",
      "cinder-vest", "forge-carapace", "flask-wrap", "membrane-coat", "static-wrap", "insulating-plate",
      "ignition-core", "buffer-flask", "charge-capacitor",
      "catalyst-blade", "buffer-lance", "electrode-saber",
      "magma-plate", "buffer-plate", "conductive-shield",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  },
  "shop-catalyst-crags": {
    "id": "shop-catalyst-crags",
    "name": "Crag Merchants",
    "regionId": "catalyst-crags",
    "equipmentIds": [
      "catalyst-blade", "pyroclast-arm", "buffer-lance", "dissolution-staff", "electrode-saber", "ion-cannon",
      "magma-plate", "crucible-mantle", "buffer-plate", "solvent-shield", "conductive-shield", "ionic-bulwark",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  },
  "shop-acid-wastes": {
    "id": "shop-acid-wastes",
    "name": "The Neutralised Stock",
    "regionId": "acid-wastes",
    "equipmentIds": [
      "catalyst-blade", "pyroclast-arm", "buffer-lance", "dissolution-staff", "electrode-saber", "ion-cannon",
      "magma-plate", "crucible-mantle", "buffer-plate", "solvent-shield", "conductive-shield", "ionic-bulwark",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  },
  "shop-the-crucible": {
    "id": "shop-the-crucible",
    "name": "The Crucible Forge",
    "regionId": "the-crucible",
    "equipmentIds": [
      "pyroclast-arm", "dissolution-staff", "ion-cannon",
      "crucible-mantle", "solvent-shield", "ionic-bulwark",
      "inferno-aegis", "aqualis-mantle", "volt-shell",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  },
  "shop-equilibriums-heart": {
    "id": "shop-equilibriums-heart",
    "name": "Heart Market",
    "regionId": "equilibriums-heart",
    "equipmentIds": [
      "pyroclast-arm", "dissolution-staff", "ion-cannon",
      "crucible-mantle", "solvent-shield", "ionic-bulwark",
      "inferno-aegis", "aqualis-mantle", "volt-shell",
      "combustion-ring", "forge-talisman", "flow-catalyst", "aqualis-talisman", "discharge-ring", "ionix-talisman"
    ]
  }
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 3: Commit**

```bash
git add src/content/data/shops.json
git commit -m "feat(content): add shops.json — 8 shop defs, T1 in R1-R2, T1+T2 in R3-R4, T2 in R5-R6, T2+T3 in R7-R8"
```

---

### Task A9: Add dropEquipmentId to 16 bosses in enemies.json

**Files:**
- Modify: `src/content/data/enemies.json`

- [ ] **Step 1: Add dropEquipmentId to 16 boss entries**

Add `"dropEquipmentId"` field to the following 16 enemy entries. Use a JSON editor or direct edit.

**miniBoss drops (T2 universal accessories — 2 bosses share each item):**
- `"unstable-deuteride"`: add `"dropEquipmentId": "lab-relic-alpha"`
- `"unstable-halide"`: add `"dropEquipmentId": "lab-relic-beta"`
- `"volatile-mixture"`: add `"dropEquipmentId": "lab-relic-gamma"`
- `"the-unbalanced-flask"`: add `"dropEquipmentId": "lab-relic-delta"`
- `"the-rate-spike"`: add `"dropEquipmentId": "lab-relic-alpha"`
- `"the-neutraliser"`: add `"dropEquipmentId": "lab-relic-beta"`
- `"the-flashpoint"`: add `"dropEquipmentId": "lab-relic-gamma"`
- `"the-forward-drift"`: add `"dropEquipmentId": "lab-relic-delta"`

**regionBoss / finalBoss drops (T3 universal accessories — 2 bosses share each item):**
- `"the-unstable-isotope"`: add `"dropEquipmentId": "lab-relic-epsilon"`
- `"the-sundered-lattice"`: add `"dropEquipmentId": "lab-relic-zeta"`
- `"the-eternal-flame"`: add `"dropEquipmentId": "lab-relic-eta"`
- `"the-lopsided-equation"`: add `"dropEquipmentId": "lab-relic-theta"`
- `"the-runaway-reaction"`: add `"dropEquipmentId": "lab-relic-epsilon"`
- `"the-ph-tyrant"`: add `"dropEquipmentId": "lab-relic-zeta"`
- `"the-heat-sink"`: add `"dropEquipmentId": "lab-relic-eta"`
- `"the-great-imbalance"`: add `"dropEquipmentId": "lab-relic-theta"`

Example change for `unstable-deuteride` (add the dropEquipmentId field to the existing JSON object):
```json
"unstable-deuteride": { "id": "unstable-deuteride", "name": "Unstable Deuteride", "affinity": "Atomic", "baseStats": { "hp": 70, "atk": 12, "def": 9, "spd": 7 }, "level": 6, "attackPower": 26, "skillIds": ["shell-shatter", "spark-flare"], "xpYield": 80, "role": "miniBoss", "spriteKey": "enemy_unstable_deuteride", "splitIntoId": "shellfracture-half", "bossSoftScale": false, "dropEquipmentId": "lab-relic-alpha" }
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green (test still passes; tsc validates dropEquipmentId as optional string)

- [ ] **Step 3: Commit**

```bash
git add src/content/data/enemies.json
git commit -m "feat(content): add dropEquipmentId to 16 miniBoss/regionBoss/finalBoss entries"
```

---

## Phase B — UI Layer (Phaser scenes)

**REQUIRES:** Phase A committed to main before starting. All Phase A types must be importable.

Dispatch as a single Sonnet subagent. All gates must pass at every commit: `npx tsc --noEmit`, `npm test`, `npm run build`.

---

### Task B1: Wire launch:'shop' into DialogueScene

**Files:**
- Modify: `src/scenes/DialogueScene.ts`

- [ ] **Step 1: Edit handleEnd in DialogueScene**

In `src/scenes/DialogueScene.ts`, in the `handleEnd` method (around line 276), add the shop branch **before** the `closeScene()` fallthrough:

```ts
private handleEnd(node: DialogueNode): void {
  const launch = node.launch;
  const regionId = typeof this.returnData.regionId === 'string' ? this.returnData.regionId : '';

  if (launch === 'shrine' && regionId && this.scene.get('ChallengeShrineScene')) {
    this.scene.stop(this.returnTo);
    this.scene.start('ChallengeShrineScene', { regionId });
    return;
  }
  if (launch === 'shop' && regionId) {
    this.scene.stop(this.returnTo);
    this.scene.start('ShopScene', { regionId, returnTo: this.returnTo, returnData: this.returnData });
    return;
  }
  if (typeof launch === 'string' && launch.startsWith('battle:') && regionId && this.scene.get('BattleScene')) {
    const enemyId = launch.slice('battle:'.length);
    this.scene.stop(this.returnTo);
    this.scene.start('BattleScene', { enemyId, regionId, returnTo: this.returnTo, returnData: this.returnData });
    return;
  }
  this.closeScene();
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green (ShopScene not yet registered — tsc passes because `scene.start` takes a string key)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/DialogueScene.ts
git commit -m "feat(dialogue): add launch:'shop' branch in handleEnd → starts ShopScene"
```

---

### Task B2: Update battlePresenter.ts to use effectiveStats for player combatant

**Files:**
- Modify: `src/scenes/battlePresenter.ts`

- [ ] **Step 1: Update playerBattleInputFromSave**

In `src/scenes/battlePresenter.ts`, import `effectiveStats` and use it to derive the player's combat stats:

```ts
import type { GameContent, SaveData } from '../content/types';
import type { PlayerBattleInput, BattleContext } from '../systems/BattleEngine';
import { statsForLevel } from '../systems/Progression';
import { effectiveStats } from '../systems/equipment';
```

Replace `playerBattleInputFromSave` to use `effectiveStats` instead of raw `statsForLevel`:

```ts
export function playerBattleInputFromSave(save: SaveData, content: GameContent): PlayerBattleInput {
  const cls = content.classes.find(c => c.id === save.classId);
  if (!cls) throw new Error(`battlePresenter: unknown class "${save.classId}"`);
  const stats = effectiveStats(save, content.equipment ?? {});
  const reachable = [...cls.startingSkillIds, ...cls.skillUnlocks.map(u => u.skillId)];
  const catalystBurstSkillId = reachable.find(id => content.skills[id]?.isCatalystBurst);
  const attackPower = Math.max(14, Math.floor(stats.atk * 1.1));
  return {
    name: cls.name,
    classId: cls.id,
    signatureAffinity: cls.signatureAffinity,
    level: save.level,
    maxHp: stats.hp,
    hp: Math.min(save.currentHp, stats.hp),
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    maxEnergy: 100,
    energy: save.currentEnergy,
    equippedSkillIds: [...save.equippedSkillIds],
    attackPower,
    isBoss: false,
    catalystBurstSkillId,
    skillTiers: { ...save.skillTiers },
  };
}
```

Note: `hp: Math.min(save.currentHp, stats.hp)` clamps currentHp to effectiveStats.hp (in case currentHp was saved when equipment wasn't equipped).

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 3: Commit**

```bash
git add src/scenes/battlePresenter.ts
git commit -m "feat(battle): player combat stats now use effectiveStats (equipment bonuses applied)"
```

---

### Task B3: Update HealingSpringScene to use effectiveStats.hp for full heal

**Files:**
- Modify: `src/scenes/HealingSpringScene.ts`

- [ ] **Step 1: Update HealingSpringScene pass logic**

In `src/scenes/HealingSpringScene.ts`, import `effectiveStats`:

```ts
import { effectiveStats } from '../systems/equipment';
```

Replace the heal-on-pass block (currently `this.save.currentHp = this.save.stats.hp`):

```ts
if (passed) {
  const content = this.registry.get('content') as GameContent;
  const healed = effectiveStats(this.save, content?.equipment ?? {});
  this.save.currentHp = healed.hp;
  this.save.currentEnergy = 100;
  await this.banner('Refreshed — HP and Energy restored!', '#06d6a0');
} else {
  await this.banner('The spring runs murky — come back when you\'ve studied.', '#f9e2af');
}
```

The `content` reference is already available on the registry from `create()`. To avoid re-reading it, store it as a class field instead. In `create()`, the line `this.content = this.registry.get('content') as GameContent;` already stores content. Use `this.content` directly:

```ts
if (passed) {
  this.save.currentHp = effectiveStats(this.save, this.content.equipment ?? {}).hp;
  this.save.currentEnergy = 100;
  await this.banner('Refreshed — HP and Energy restored!', '#06d6a0');
} else {
  await this.banner('The spring runs murky — come back when you\'ve studied.', '#f9e2af');
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 3: Commit**

```bash
git add src/scenes/HealingSpringScene.ts
git commit -m "feat(healing): restore to effectiveStats.hp on spring pass (includes equipment HP bonus)"
```

---

### Task B4: Create ShopScene

**Files:**
- Create: `src/scenes/ShopScene.ts`

- [ ] **Step 1: Create ShopScene.ts**

Create `src/scenes/ShopScene.ts`:

```ts
import Phaser from 'phaser';
import type { GameContent, SaveData, EquipmentDef } from '../content/types';
import { canEquip } from '../systems/equipment';
import { persist as savePersist } from '../persist';

interface ShopSceneData {
  regionId: string;
  returnTo: string;
  returnData: Record<string, unknown>;
}

const W = 1920, H = 1080, FONT = 'monospace';

export class ShopScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private returnTo = '';
  private returnData: Record<string, unknown> = {};
  private shopEquipmentIds: string[] = [];

  private rowButtons: Phaser.GameObjects.Text[] = [];
  private rowIdx = 0;
  private headerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() { super('ShopScene'); }

  create(data: ShopSceneData): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('WorldMapScene'); return; }
    this.save = save;
    this.returnTo = data.returnTo;
    this.returnData = data.returnData ?? {};
    this.rowIdx = 0;

    const shop = Object.values(this.content.shops ?? {}).find(s => s.regionId === data.regionId);
    if (!shop) {
      console.warn(`[ShopScene] no shop for region "${data.regionId}"`);
      this.exitScene();
      return;
    }
    this.shopEquipmentIds = shop.equipmentIds;

    this.cameras.main.setBackgroundColor('#050810');
    this.add.rectangle(0, 0, W, H, 0x050810).setOrigin(0, 0);
    this.add.text(W / 2, 32, `${shop.name}`, { fontFamily: FONT, fontSize: '44px', color: '#f9e2af' }).setOrigin(0.5, 0);
    this.add.text(W / 2, H - 80, '↑/↓ select   Enter buy   ESC exit', { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setOrigin(0.5, 0);
    this.headerText = this.add.text(W / 2, 96, '', { fontFamily: FONT, fontSize: '32px', color: '#89dceb' }).setOrigin(0.5, 0);
    this.toastText = this.add.text(W / 2, H - 44, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af' }).setOrigin(0.5, 0);

    this.buildList();

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      kb.on('keydown-ENTER', this.onConfirm, this);
      kb.on('keydown-SPACE', this.onConfirm, this);
      kb.on('keydown-ESC', this.exitScene, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.exitScene, this);
      });
    }
  }

  override update(): void {
    if (!this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.rowIdx = (this.rowIdx + this.rowButtons.length - 1) % this.rowButtons.length;
      this.highlight();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.rowIdx = (this.rowIdx + 1) % this.rowButtons.length;
      this.highlight();
    }
  }

  private buildList(): void {
    for (const b of this.rowButtons) b.destroy();
    this.rowButtons = [];

    this.headerText.setText(`Balance: ${this.save.drachms} ⬡`);

    const classId = this.save.classId;
    const startY = 160;

    this.shopEquipmentIds.forEach((id, i) => {
      const eq = this.content.equipment?.[id];
      if (!eq) return;
      const owned = this.save.ownedEquipmentIds.includes(id);
      const equippable = canEquip(eq, classId);
      const label = this.buildLabel(eq, owned, equippable);
      const btn = this.add.text(160, startY + i * 48, label, {
        fontFamily: FONT, fontSize: '26px',
        color: equippable ? '#cdd6f4' : '#566074',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { this.rowIdx = i; this.highlight(); });
      btn.on('pointerdown', () => { this.rowIdx = i; this.tryBuy(); });
      this.rowButtons.push(btn);
    });

    this.highlight();
  }

  private buildLabel(eq: EquipmentDef, owned: boolean, equippable: boolean): string {
    const ownedTag = owned ? ' ✓' : '';
    const classTag = equippable ? '' : ' (wrong class)';
    const price = eq.shopPrice !== null ? `${eq.shopPrice} ⬡` : 'Boss drop';
    const stats = `ATK+${eq.atkBonus} DEF+${eq.defBonus} SPD+${eq.spdBonus} HP+${eq.hpBonus}`;
    return `${eq.name}  [T${eq.tier} ${eq.kind}]  ${stats}  — ${price}${ownedTag}${classTag}`;
  }

  private highlight(): void {
    this.rowButtons.forEach((b, i) => {
      b.setColor(i === this.rowIdx ? '#f9e2af' : (b.text.includes('wrong class') ? '#566074' : '#cdd6f4'));
    });
  }

  private onConfirm(): void { this.tryBuy(); }

  private tryBuy(): void {
    const id = this.shopEquipmentIds[this.rowIdx];
    if (!id) return;
    const eq = this.content.equipment?.[id];
    if (!eq) return;
    if (eq.shopPrice === null) { this.toast('Boss drop only — not for sale.'); return; }
    if (this.save.ownedEquipmentIds.includes(id)) { this.toast('Already owned.'); return; }
    if (!canEquip(eq, this.save.classId)) { this.toast("Your class can't wield that."); return; }
    if (this.save.drachms < eq.shopPrice) { this.toast(`Not enough ⬡ (need ${eq.shopPrice}).`); return; }
    this.save.drachms -= eq.shopPrice;
    this.save.ownedEquipmentIds.push(id);
    this.registry.set('save', this.save);
    savePersist();
    this.toast(`Bought: ${eq.name}!`);
    this.buildList();
  }

  private toast(msg: string): void {
    this.toastText.setText(msg);
    this.time.delayedCall(2200, () => { if (this.toastText.text === msg) this.toastText.setText(''); });
  }

  private exitScene = (): void => {
    this.scene.stop();
    this.scene.start(this.returnTo, this.returnData);
  };
}
```

- [ ] **Step 2: Register ShopScene in main.ts**

In `src/main.ts`, add the ShopScene import and registration:

```ts
import { ShopScene } from './scenes/ShopScene';
```

Add `ShopScene` to the `SCENES` array:
```ts
const SCENES: any[] = [
  BootScene, ErrorScene, TitleScene, ClassSelectScene, WorldMapScene,
  OverworldScene, DialogueScene, BattleScene, ChallengeShrineScene, HealingSpringScene, MenuScene, EndingScene, ShopScene,
];
```

- [ ] **Step 3: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ShopScene.ts src/main.ts
git commit -m "feat(shop): add ShopScene with buy logic; register in main.ts"
```

---

### Task B5: Add Equipment tab to MenuScene

**Files:**
- Modify: `src/scenes/MenuScene.ts`

- [ ] **Step 1: Update TABS constant and add buildEquipmentTab**

In `src/scenes/MenuScene.ts`:

1. Update the TABS constant (line 13):
```ts
const TABS = ['Skills', 'Refine', 'Equipment', 'Items', 'Status', 'Save', 'Settings', 'Quit'] as const;
type Tab = typeof TABS[number];
```

2. Add `effectiveStats` and `canEquip` imports at the top:
```ts
import { effectiveStats, canEquip } from '../systems/equipment';
```

3. In the `buildTab` switch, add the Equipment case:
```ts
switch (this.tab()) {
  case 'Skills': this.buildSkillsTab(); break;
  case 'Refine': this.buildRefineTab(); break;
  case 'Equipment': this.buildEquipmentTab(); break;
  case 'Items': this.buildItemsTab(); break;
  case 'Status': this.buildStatusTab(); break;
  case 'Save': this.buildButtonTab('Save now'); break;
  case 'Settings': this.buildSettingsTab(); break;
  case 'Quit': this.buildButtonTab('Quit to Title'); break;
}
```

4. In the `activateRow` switch, add the Equipment case:
```ts
case 'Equipment': {
  const allOwned = this.save.ownedEquipmentIds
    .map(id => this.content.equipment?.[id])
    .filter((e): e is import('../content/types').EquipmentDef => !!e && canEquip(e, this.save.classId));
  const item = allOwned[i];
  if (item) this.toggleEquip(item);
  break;
}
```

5. Add the `buildEquipmentTab` method (after `buildRefineTab`):
```ts
private buildEquipmentTab(): void {
  const equipped = this.save.equipped;
  const equipMap = this.content.equipment ?? {};
  const base = this.save.stats;
  const eff = effectiveStats(this.save, equipMap);
  this.addObj(this.add.text(160, 168,
    `Effective:  ATK ${eff.atk}  DEF ${eff.def}  SPD ${eff.spd}  HP ${eff.hp}  ·  Enter equips/unequips`,
    { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
  this.addObj(this.add.text(160, 204,
    `Base:       ATK ${base.atk}  DEF ${base.def}  SPD ${base.spd}  HP ${base.hp}`,
    { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setDepth(1));

  const allOwned = this.save.ownedEquipmentIds
    .map(id => equipMap[id])
    .filter((e): e is import('../content/types').EquipmentDef => !!e && canEquip(e, this.save.classId));

  let y = 256;
  for (const slotKey of ['weapon', 'armour', 'accessory'] as const) {
    this.addObj(this.add.text(160, y, `── ${slotKey.charAt(0).toUpperCase() + slotKey.slice(1)} ──`, { fontFamily: FONT, fontSize: '26px', color: '#89dceb' }).setDepth(1));
    y += 40;
    const slotItems = allOwned.filter(e => e.kind === slotKey);
    if (slotItems.length === 0) {
      this.addObj(this.add.text(180, y, '  (none owned)', { fontFamily: FONT, fontSize: '26px', color: '#566074' }).setDepth(1));
      y += 40;
    } else {
      slotItems.forEach(e => {
        const isEquipped = equipped[slotKey] === e.id;
        const row = this.addRow(y, () => this.toggleEquip(e));
        const bonus = `ATK+${e.atkBonus} DEF+${e.defBonus} SPD+${e.spdBonus} HP+${e.hpBonus}`;
        row.setData('label', `${isEquipped ? '◆' : '◇'} ${e.name}  [T${e.tier}]  ${bonus}`);
        y += 40;
      });
    }
  }
}

private toggleEquip(e: import('../content/types').EquipmentDef): void {
  const slot = e.kind as 'weapon' | 'armour' | 'accessory';
  if (this.save.equipped[slot] === e.id) {
    this.save.equipped[slot] = null;
    this.toast(`Unequipped ${e.name}.`);
  } else {
    this.save.equipped[slot] = e.id;
    this.toast(`Equipped ${e.name}.`);
  }
  this.persist();
  this.buildTab();
}
```

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MenuScene.ts
git commit -m "feat(menu): add Equipment tab at index 2 with equip/unequip and stat comparison"
```

---

### Task B6: Add 8 shopkeeper NPCs to npcs.json

**Files:**
- Modify: `src/content/data/npcs.json`

- [ ] **Step 1: Append 8 shopkeeper NPC entries to npcs.json**

Add the following 8 entries to the existing `npcs.json` object. Each has a 2-node dialogue ending in `"launch": "shop"` and `"end": true`.

```json
  "vendor-mara": {
    "id": "vendor-mara", "name": "Vendor Mara", "spriteKey": "npc_vendor_mara", "tile": { "x": 9, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "vm0", "speaker": "Vendor Mara", "text": "Atoms are everywhere — and so is quality gear. I stock reagent equipment for chemists heading into the Reaches. Browse what I have?", "choices": [ { "label": "Open the shop.", "next": "vm1" }, { "label": "Maybe later.", "next": "vm_skip" } ] },
      { "id": "vm1", "speaker": "Vendor Mara", "text": "Curie's Cache — only the finest forge-tested equipment. Choose carefully.", "end": true, "launch": "shop" },
      { "id": "vm_skip", "speaker": "Vendor Mara", "text": "I'll be here. The Reaches wait for no one, but I do.", "end": true }
    ]
  },
  "merchant-rho": {
    "id": "merchant-rho", "name": "Merchant Rho", "spriteKey": "npc_merchant_rho", "tile": { "x": 13, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "mr0", "speaker": "Merchant Rho", "text": "The Forge hammers day and night, and so do I. Good equipment makes the difference between a clean bond and a broken one. Care to browse?", "choices": [ { "label": "Show me the vault.", "next": "mr1" }, { "label": "Not now.", "next": "mr_skip" } ] },
      { "id": "mr1", "speaker": "Merchant Rho", "text": "The Bonded Vault — gear bound to last. Step inside.", "end": true, "launch": "shop" },
      { "id": "mr_skip", "speaker": "Merchant Rho", "text": "The vault is always unlocked. Come back when you're ready.", "end": true }
    ]
  },
  "trader-kira": {
    "id": "trader-kira", "name": "Trader Kira", "spriteKey": "npc_trader_kira", "tile": { "x": 15, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "tk0", "speaker": "Trader Kira", "text": "Every reaction leaves a residue — and the best ones leave behind fine equipment. I collect and sell them here in Reaction Hollow. Interested?", "choices": [ { "label": "Browse the stock.", "next": "tk1" }, { "label": "No thanks.", "next": "tk_skip" } ] },
      { "id": "tk1", "speaker": "Trader Kira", "text": "Hollow Reagents — good gear for hungry chemists. Have a look.", "end": true, "launch": "shop" },
      { "id": "tk_skip", "speaker": "Trader Kira", "text": "Suit yourself. I'll still be here after you fight.", "end": true }
    ]
  },
  "vendor-theron": {
    "id": "vendor-theron", "name": "Vendor Theron", "spriteKey": "npc_vendor_theron", "tile": { "x": 15, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "vt0", "speaker": "Vendor Theron", "text": "Every equation has two sides, and every chemist needs two things: knowledge and equipment. I supply the second. Want to take a look?", "choices": [ { "label": "Open the scales.", "next": "vt1" }, { "label": "Not yet.", "next": "vt_skip" } ] },
      { "id": "vt1", "speaker": "Vendor Theron", "text": "The Balanced Scales — precisely curated gear. Choose your side.", "end": true, "launch": "shop" },
      { "id": "vt_skip", "speaker": "Vendor Theron", "text": "The scales tip for no one. Come back when you've decided.", "end": true }
    ]
  },
  "merchant-vex": {
    "id": "merchant-vex", "name": "Merchant Vex", "spriteKey": "npc_merchant_vex", "tile": { "x": 16, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "mv0", "speaker": "Merchant Vex", "text": "Catalyst Crags run fast — so does my business. Everything I carry accelerates your edge. Want to see?", "choices": [ { "label": "Show me the stock.", "next": "mv1" }, { "label": "Maybe later.", "next": "mv_skip" } ] },
      { "id": "mv1", "speaker": "Merchant Vex", "text": "Crag Merchants — mid-tier gear for mid-tier threats. Don't wait.", "end": true, "launch": "shop" },
      { "id": "mv_skip", "speaker": "Merchant Vex", "text": "Speed is everything here. Don't wait too long.", "end": true }
    ]
  },
  "trader-osh": {
    "id": "trader-osh", "name": "Trader Osh", "spriteKey": "npc_trader_osh", "tile": { "x": 14, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "to0", "speaker": "Trader Osh", "text": "Acid eats through most things, but good equipment resists. I've seen what happens when chemists come through without proper gear. Don't let that be you. Want to browse?", "choices": [ { "label": "Browse the stock.", "next": "to1" }, { "label": "I'll be fine.", "next": "to_skip" } ] },
      { "id": "to1", "speaker": "Trader Osh", "text": "The Neutralised Stock — gear that balances the pH of danger. Choose well.", "end": true, "launch": "shop" },
      { "id": "to_skip", "speaker": "Trader Osh", "text": "Your confidence is admirable. Misplaced, perhaps. Come back if you change your mind.", "end": true }
    ]
  },
  "vendor-brix": {
    "id": "vendor-brix", "name": "Vendor Brix", "spriteKey": "npc_vendor_brix", "tile": { "x": 13, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "vb0", "speaker": "Vendor Brix", "text": "The Crucible tests everything — metal, bond, and chemist alike. My gear is forged right here in the heat. It holds. Want to see what we have?", "choices": [ { "label": "Open the forge.", "next": "vb1" }, { "label": "Not right now.", "next": "vb_skip" } ] },
      { "id": "vb1", "speaker": "Vendor Brix", "text": "The Crucible Forge — T2 and T3 equipment, tested in real heat. Make your choice.", "end": true, "launch": "shop" },
      { "id": "vb_skip", "speaker": "Vendor Brix", "text": "The forge stays hot. Come back when you need it.", "end": true }
    ]
  },
  "merchant-mira": {
    "id": "merchant-mira", "name": "Merchant Mira", "spriteKey": "npc_merchant_mira", "tile": { "x": 16, "y": 14 }, "facing": "left",
    "dialogue": [
      { "id": "mm0", "speaker": "Merchant Mira", "text": "Equilibrium's Heart holds the final balance of Æquor. You'll want every advantage you can get. Let me show you what the Heart Market has to offer.", "choices": [ { "label": "Browse the market.", "next": "mm1" }, { "label": "I'm ready as is.", "next": "mm_skip" } ] },
      { "id": "mm1", "speaker": "Merchant Mira", "text": "Heart Market — finest equipment in Æquor. Take what you need.", "end": true, "launch": "shop" },
      { "id": "mm_skip", "speaker": "Merchant Mira", "text": "Courage. I respect that. I'll be here when you need me.", "end": true }
    ]
  }
```

**Note:** Each shopkeeper's `spriteKey` is a new NPC sprite. These will resolve to placeholders via the fallback system. Add placeholder entries to `assetManifest.json` if the build complains — however, the BootScene handles missing keys with coloured-rect fallbacks, so this is not blocking.

- [ ] **Step 2: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green. The `realContent.test.ts` "every NPC dialogue tree is walkable" test will also validate the new NPCs.

- [ ] **Step 3: Check if any spriteKey warnings appear**

Run: `npm test 2>&1 | grep -i "warning\|sprite"` to see if new spriteKeys cause warnings.

If the `realContent.test.ts` asset test fails (new spriteKeys not in assetManifest), add placeholder entries to `src/content/data/assetManifest.json` for each new NPC spriteKey:
- Keys: `npc_vendor_mara`, `npc_merchant_rho`, `npc_trader_kira`, `npc_vendor_theron`, `npc_merchant_vex`, `npc_trader_osh`, `npc_vendor_brix`, `npc_merchant_mira`
- Add to `images`: `"npc_vendor_mara": "assets/images/npc_vendor_mara.png"` (×8)
- Add to `placeholders`: `{ "key": "npc_vendor_mara", "w": 48, "h": 64, "color": "#cba6f7", "label": "Vendor" }` (×8, using distinct colours)

- [ ] **Step 4: Commit**

```bash
git add src/content/data/npcs.json src/content/data/assetManifest.json
git commit -m "feat(content): add 8 shopkeeper NPCs to npcs.json (vendor-mara .. merchant-mira)"
```

---

### Task B7: Add shopkeeper NPC tiles to all 8 tilemaps

**Files:**
- Modify: `src/content/data/tilemaps/elemental-reaches.json`
- Modify: `src/content/data/tilemaps/bonding-forge.json`
- Modify: `src/content/data/tilemaps/reaction-hollow.json`
- Modify: `src/content/data/tilemaps/balance-halls.json`
- Modify: `src/content/data/tilemaps/catalyst-crags.json`
- Modify: `src/content/data/tilemaps/acid-wastes.json`
- Modify: `src/content/data/tilemaps/the-crucible.json`
- Modify: `src/content/data/tilemaps/equilibriums-heart.json`

Each tilemap needs one `npc` object added to its `objects` array for the corresponding shopkeeper NPC. The tile must:
- Be at a ground=0 position (passable floor, not ground=3 border or ground=1 wall)
- Not conflict with any existing object (NPC, healing_spring, shrine_entrance, minibossTrigger, bossGate, player_spawn, exit)
- Be BFS-reachable from `player_spawn` before the miniboss gate

**Coordinates verified against tilemap ground arrays (all ground=0, no object conflict, BFS-reachable):**

| Region | Shopkeeper NPC ID | x | y |
|---|---|---|---|
| elemental-reaches | vendor-mara | 9 | 14 |
| bonding-forge | merchant-rho | 13 | 14 |
| reaction-hollow | trader-kira | 15 | 14 |
| balance-halls | vendor-theron | 15 | 14 |
| catalyst-crags | merchant-vex | 16 | 14 |
| acid-wastes | trader-osh | 14 | 14 |
| the-crucible | vendor-brix | 13 | 14 |
| equilibriums-heart | merchant-mira | 16 | 14 |

- [ ] **Step 1: Add the npc entry to elemental-reaches.json objects array**

Add to the `objects` array:
```json
{ "type": "npc", "id": "vendor-mara", "x": 9, "y": 14 }
```

- [ ] **Step 2: Add npc to bonding-forge.json**

Add:
```json
{ "type": "npc", "id": "merchant-rho", "x": 13, "y": 14 }
```

- [ ] **Step 3: Add npc to reaction-hollow.json**

Add:
```json
{ "type": "npc", "id": "trader-kira", "x": 15, "y": 14 }
```

- [ ] **Step 4: Add npc to balance-halls.json**

Add:
```json
{ "type": "npc", "id": "vendor-theron", "x": 15, "y": 14 }
```

- [ ] **Step 5: Add npc to catalyst-crags.json**

Add:
```json
{ "type": "npc", "id": "merchant-vex", "x": 16, "y": 14 }
```

- [ ] **Step 6: Add npc to acid-wastes.json**

Add:
```json
{ "type": "npc", "id": "trader-osh", "x": 14, "y": 14 }
```

- [ ] **Step 7: Add npc to the-crucible.json**

Add:
```json
{ "type": "npc", "id": "vendor-brix", "x": 13, "y": 14 }
```

- [ ] **Step 8: Add npc to equilibriums-heart.json**

Add:
```json
{ "type": "npc", "id": "merchant-mira", "x": 16, "y": 14 }
```

- [ ] **Step 9: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green. Note: the existing BFS test checks `region.npcIds[0]` (the lesson NPC) — shopkeepers are NOT in region.npcIds so the existing test is unaffected.

- [ ] **Step 10: Commit**

```bash
git add src/content/data/tilemaps/elemental-reaches.json src/content/data/tilemaps/bonding-forge.json src/content/data/tilemaps/reaction-hollow.json src/content/data/tilemaps/balance-halls.json src/content/data/tilemaps/catalyst-crags.json src/content/data/tilemaps/acid-wastes.json src/content/data/tilemaps/the-crucible.json src/content/data/tilemaps/equilibriums-heart.json
git commit -m "feat(tilemaps): add shopkeeper NPC tile to all 8 region tilemaps"
```

---

### Task B8: Add realContent.test.ts validations for equipment, shops, and shopkeeper NPC reachability

**Files:**
- Modify: `tests/content/realContent.test.ts`

- [ ] **Step 1: Add imports for all 8 tilemap JSONs (already imported — skip)**

The 8 tilemap imports already exist in `realContent.test.ts`. No new imports needed.

- [ ] **Step 2: Append equipment, shop, and shopkeeper NPC tests**

Append the following `describe` blocks at the end of `tests/content/realContent.test.ts`:

```ts
describe('equipment content', () => {
  it('loads 47 equipment items with unique IDs', () => {
    const { content } = loadGameContent();
    const ids = Object.keys(content.equipment);
    expect(ids.length).toBe(47);
    expect(new Set(ids).size).toBe(47);
  });

  it('every equipment item has a valid kind (weapon|armour|accessory)', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      expect(['weapon', 'armour', 'accessory']).toContain(e.kind);
    }
  });

  it('every equipment item has a valid tier (1|2|3)', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      expect([1, 2, 3]).toContain(e.tier);
    }
  });

  it('universal-family items have empty wieldableBy', () => {
    const { content } = loadGameContent();
    for (const e of Object.values(content.equipment)) {
      if (e.family === 'universal') expect(e.wieldableBy).toHaveLength(0);
    }
  });

  it('all 8 universal accessories have shopPrice null', () => {
    const { content } = loadGameContent();
    const universals = Object.values(content.equipment).filter(e => e.family === 'universal');
    expect(universals.length).toBe(8);
    for (const e of universals) expect(e.shopPrice).toBeNull();
  });

  it('all dropEquipmentId values on enemies reference real equipment IDs', () => {
    const { content } = loadGameContent();
    for (const enemy of Object.values(content.enemies)) {
      if (enemy.dropEquipmentId) {
        expect(content.equipment[enemy.dropEquipmentId], `enemy ${enemy.id} dropEquipmentId "${enemy.dropEquipmentId}" not found`).toBeDefined();
      }
    }
  });

  it('exactly 16 enemies have a dropEquipmentId (8 miniBosses + 8 regionBoss/finalBoss)', () => {
    const { content } = loadGameContent();
    const withDrop = Object.values(content.enemies).filter(e => e.dropEquipmentId);
    expect(withDrop.length).toBe(16);
  });
});

describe('shop content', () => {
  it('loads 8 shop definitions', () => {
    const { content } = loadGameContent();
    expect(Object.keys(content.shops).length).toBe(8);
  });

  it('every shop regionId references a real region', () => {
    const { content } = loadGameContent();
    const regionIds = new Set(content.regions.map(r => r.id));
    for (const shop of Object.values(content.shops)) {
      expect(regionIds.has(shop.regionId), `shop ${shop.id} regionId "${shop.regionId}" not a real region`).toBe(true);
    }
  });

  it('every shop equipmentId references a real equipment item', () => {
    const { content } = loadGameContent();
    for (const shop of Object.values(content.shops)) {
      for (const id of shop.equipmentIds) {
        expect(content.equipment[id], `shop ${shop.id} references unknown equipment "${id}"`).toBeDefined();
      }
    }
  });

  it('no shop stocks boss-drop-only items (shopPrice null)', () => {
    const { content } = loadGameContent();
    for (const shop of Object.values(content.shops)) {
      for (const id of shop.equipmentIds) {
        const eq = content.equipment[id];
        if (eq) expect(eq.shopPrice, `shop ${shop.id} stocks boss-drop-only item "${id}"`).not.toBeNull();
      }
    }
  });

  it('each region has exactly one shop', () => {
    const { content } = loadGameContent();
    const byRegion = new Map<string, number>();
    for (const shop of Object.values(content.shops)) {
      byRegion.set(shop.regionId, (byRegion.get(shop.regionId) ?? 0) + 1);
    }
    for (const region of content.regions) {
      expect(byRegion.get(region.id), `region ${region.id} has no shop`).toBe(1);
    }
  });
});

describe('shopkeeper NPC reachability', () => {
  const maps: Record<string, AuditTilemap> = {
    'elemental-reaches': elementalReaches as AuditTilemap,
    'bonding-forge': bondingForge as AuditTilemap,
    'reaction-hollow': reactionHollow as AuditTilemap,
    'balance-halls': balanceHalls as AuditTilemap,
    'catalyst-crags': catalystCrags as AuditTilemap,
    'acid-wastes': acidWastes as AuditTilemap,
    'the-crucible': theCrucible as AuditTilemap,
    'equilibriums-heart': equilibriumsHeart as AuditTilemap,
  };

  const shopkeeperIdByRegion: Record<string, string> = {
    'elemental-reaches': 'vendor-mara',
    'bonding-forge': 'merchant-rho',
    'reaction-hollow': 'trader-kira',
    'balance-halls': 'vendor-theron',
    'catalyst-crags': 'merchant-vex',
    'acid-wastes': 'trader-osh',
    'the-crucible': 'vendor-brix',
    'equilibriums-heart': 'merchant-mira',
  };

  it('every shopkeeper NPC is in its region tilemap and BFS-reachable before the miniboss', () => {
    const { content } = loadGameContent();
    for (const region of content.regions) {
      const map = maps[region.id];
      expect(map, `${region.id} has no audit tilemap`).toBeDefined();
      if (!map) continue;
      const shopkeeperId = shopkeeperIdByRegion[region.id];
      expect(shopkeeperId, `${region.id} has no expected shopkeeper id`).toBeDefined();
      const npcObj = map.objects.find(o => o.type === 'npc' && o.id === shopkeeperId);
      expect(npcObj, `${region.id} tilemap missing shopkeeper NPC "${shopkeeperId}"`).toBeDefined();
      if (!npcObj) continue;
      const reachable = reachableTilesBeforeGuardian(map);
      expect(isAdjacentReachable(reachable, npcObj), `shopkeeper "${shopkeeperId}" is not BFS-reachable before the miniboss`).toBe(true);
    }
  });

  it('every shopkeeper NPC has a "shop" launch in its dialogue', () => {
    const { content } = loadGameContent();
    for (const npcId of Object.values(shopkeeperIdByRegion)) {
      const npc = content.npcs[npcId];
      expect(npc, `NPC "${npcId}" not found in content`).toBeDefined();
      if (!npc) continue;
      const hasShopLaunch = npc.dialogue.some(node => node.launch === 'shop');
      expect(hasShopLaunch, `NPC "${npcId}" has no dialogue node with launch:'shop'`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/content/realContent.test.ts`
Expected: All new tests PASS

- [ ] **Step 4: Run full gates**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green

- [ ] **Step 5: Commit**

```bash
git add tests/content/realContent.test.ts
git commit -m "test(content): add equipment/shop/shopkeeper NPC reachability validations to realContent.test.ts"
```

---

### Task B9: Tag and push v0.15.0

- [ ] **Step 1: Verify final gate state**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: All green. Count: ~280+ tests passing (254 baseline + new equipment, shop, realContent tests).

- [ ] **Step 2: Tag and push**

```bash
git tag v0.15.0-economy-equipment
git push origin main --tags
```

---

## Self-Review: Spec Coverage Checklist

- [x] **Drachms earned from battle** — Task A4 awards floor(level×3/8/15) in `applyVictory`
- [x] **No enemies.json changes for Drachms** — formula uses `enemyDef.level` (dynamic), no JSON changes
- [x] **47 equipment items** — Task A7 equipment.json: 15 weapons, 15 armours, 9 class accessories, 8 universal accessories
- [x] **EquipmentDef type** — Task A1 adds to types.ts
- [x] **3 class families (Pyron/Aqualis/Ionix) + universal** — Task A7 items
- [x] **Stat bonuses flat, layered via effectiveStats** — Task A2 equipment.ts
- [x] **effectiveStats never mutates save.stats** — pure function, returns new Stats object
- [x] **canEquip** — Task A2
- [x] **Save v4 migration (append-only STEPS)** — Task A3
- [x] **newGame seeds v4 fields** — Task A3
- [x] **ShopDef type** — Task A1
- [x] **8 shops** — Task A8 shops.json
- [x] **T1 in R1-R2, T1+T2 in R3-R4, T2 in R5-R6, T2+T3 in R7-R8** — Task A8
- [x] **ShopScene** — Task B4 with buy logic, balance display, canEquip gating
- [x] **DialogueScene launch:'shop'** — Task B1
- [x] **Equipment tab in MenuScene at index 2** — Task B5 (TABS updated to 8 tabs)
- [x] **BattleScene effectiveStats** — Task B2 (via battlePresenter.ts)
- [x] **HealingSpringScene effectiveStats.hp** — Task B3
- [x] **8 shopkeeper NPCs in npcs.json** — Task B6
- [x] **8 shopkeeper NPC tiles in tilemaps** — Task B7
- [x] **main.ts registers ShopScene** — Task B4
- [x] **realContent.test.ts: equipment validation** — Task B8
- [x] **realContent.test.ts: shop validation** — Task B8
- [x] **realContent.test.ts: shopkeeper BFS reachability** — Task B8
- [x] **16 bosses with dropEquipmentId** — Task A9
- [x] **equipment drop: first-clear only, no duplicates** — Task A4
- [x] **Schema validators** — Task A5
- [x] **ContentLoader wired** — Task A6
- [x] **saveManager.test.ts v4** — Task A3
- [x] **equipment.test.ts** — Task A2
- [x] **battleVictory.test.ts Drachm tests** — Task A4

**Out-of-scope confirmed absent:** equipment crafting, class-changing, skill-modify effects, sell-back, RNG drops, inventory limits ✓
