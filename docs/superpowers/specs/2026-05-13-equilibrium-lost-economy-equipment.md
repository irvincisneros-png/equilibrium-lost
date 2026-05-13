# Economy + Equipment Design Spec

**Milestone:** v0.15.0-economy-equipment  
**Date:** 2026-05-13  
**Scope:** Three integrated features — Drachms (currency), Equipment (gear with stat bonuses), Shops (per-region vendors). All three ship together because they are tightly coupled: Drachms with nowhere to spend them is confusing, and equipment acquisition requires shops or boss drops.

---

## 1. Currency — Drachms

**Rationale for name:** Drachm is an ancient unit of weight used in apothecary/alchemy; fits the chemistry-RPG theme and is distinct from "gold" clichés.

**Symbol:** `⬡` (hexagonal glyph — evokes the benzene ring and molecular structure).

### Earning Drachms

Computed in `applyVictory` using the enemy's level (no JSON edits to existing enemies.json required):

| Enemy role | Formula | Example yield |
|---|---|---|
| wild | `floor(level × 3)` | Lv2 = 6 ⬡, Lv20 = 60 ⬡ |
| miniBoss | `floor(level × 8)` | Lv6 = 48 ⬡, Lv31 = 248 ⬡ |
| regionBoss / finalBoss | `floor(level × 15)` | Lv8 = 120 ⬡, Lv34 = 510 ⬡ |

Shop Tier 1 items cost 80–150 ⬡ → affordable after ~15 R1 wild kills or 2–3 miniBoss runs.  
Shop Tier 3 items cost 600–900 ⬡ → affordable by mid-to-late game (regionBoss rewards + accumulation).

### Spending Drachms

Only in ShopScene (see §4). Drachms are never spent on skills (that uses Reagent Points).

---

## 2. Equipment

### 2.1 EquipmentDef type (new — `src/content/types.ts`)

```ts
export interface EquipmentDef {
  id: string;
  name: string;
  kind: 'weapon' | 'armour' | 'accessory';
  family: string;           // see §2.2; accessory families are class-specific
  wieldableBy: string[];    // classIds; empty = any class (not used in this set)
  tier: 1 | 2 | 3;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  hpBonus: number;
  description: string;      // ≤15 words, chem-flavoured
  shopPrice: number | null; // null = boss-drop only, not in any shop
  dropFrom: Array<'miniBoss' | 'regionBoss' | 'finalBoss'>; // for realContent validation
}
```

`GameContent` gains: `equipment: Record<string, EquipmentDef>`.

### 2.2 Class families

| Class | Weapon family | Armour family | Accessory family |
|---|---|---|---|
| Pyron | `forge-arms` | `crucible-plate` | `ignition-set` |
| Aqualis | `vialwork` | `glassweave` | `buffer-set` |
| Ionix | `voltaic` | `shieldplate` | `charge-set` |
| Any class | — | — | `universal` (boss drops only) |

Each class can only equip items from its own families. `wieldableBy: []` means any class (used only for `universal` accessories).

### 2.3 Stat bonus guidelines (flat; added on top of statsForLevel output)

| Tier | ATK/DEF bonus | SPD bonus | HP bonus |
|---|---|---|---|
| 1 | +3–6 | +1–3 | +5–10 |
| 2 | +7–12 | +3–5 | +15–25 |
| 3 | +13–18 | +5–8 | +30–50 |

Weapons emphasise ATK; armour emphasises DEF + HP; accessories focus on one stat each.

### 2.4 Content inventory (`src/content/data/equipment.json` — 39 items)

- **5 weapons per class** (15 total): tiers 1, 1, 2, 2, 3 per class
- **5 armours per class** (15 total): tiers 1, 1, 2, 2, 3 per class
- **3 accessories per class** (9 total): each targets a different stat emphasis
- **8 universal accessories** (boss-exclusive, `wieldableBy: []`): T2 for miniBosses (R1-R8), T3 for regionBosses/finalBoss. These are the only `universal`-family items.

Total: **47 items** (15 weapons + 15 armours + 9 class accessories + 8 universal boss accessories).

Boss-exclusive items (shopPrice null): the 8 universal accessories + 1 T3 weapon per class (stocked in no shop, earned only via R7/R8 boss drops or finalBoss).

### 2.5 Stat integration (`src/systems/equipment.ts` — new pure module)

```ts
export function equippedStatBonus(
  equipped: SaveData['equipped'],
  equipmentMap: Record<string, EquipmentDef>
): Stats;  // sums weapon + armour + accessory bonuses; 0 for missing/null slots

export function effectiveStats(
  save: SaveData,
  equipmentMap: Record<string, EquipmentDef>
): Stats;  // save.stats + equippedStatBonus — never mutates save

export function canEquip(equipDef: EquipmentDef, classId: string): boolean;
```

`save.stats` is **never** updated with equipment bonuses — it always reflects `statsForLevel` output only. Equipment is layered on at display/battle time via `effectiveStats()`.

**Callers of `effectiveStats`:**
- `BattleScene.create()`: player combatant hp/atk/def/spd, and `currentHp` clamp: `Math.min(save.currentHp, effectiveStats.hp)`
- `MenuScene.buildStatusTab()` and `buildEquipmentTab()`: stat display
- `HealingSpringScene` on pass: restore to `effectiveStats(save, content.equipment).hp` (not `save.stats.hp`)

### 2.6 Equipment drops (boss first-clear rewards)

Added optional `dropEquipmentId?: string` to `EnemyDef` in types.ts and enemies.json.

In `applyVictory`, before `rp.bossDefeated` is set to true:
```ts
if (!rp.bossDefeated && enemyDef.dropEquipmentId) {
  if (!s.ownedEquipmentIds.includes(enemyDef.dropEquipmentId)) {
    s.ownedEquipmentIds.push(enemyDef.dropEquipmentId);
    banners.push(`Found: ${content.equipment[enemyDef.dropEquipmentId]?.name}!`);
  }
}
```

Each miniBoss and regionBoss gets a `dropEquipmentId` pointing to a T2 or T3 equipment piece from the `universal` family (`wieldableBy: []`) — **class-neutral accessories** so every player benefits regardless of class choice. These 16 "lab relics" are boss-exclusive (shopPrice null) and represent the primary power-spike reward for clearing bosses.

---

## 3. Save Schema v4

`CURRENT_SAVE_VERSION` bumped to `4`. New fields on `SaveData`:

```ts
drachms: number;                            // default 0
ownedEquipmentIds: string[];                // ids of equipment the player possesses
equipped: {
  weapon: string | null;
  armour: string | null;
  accessory: string | null;
};
```

Migration step v3→v4 in `SaveManager.ts STEPS`:
```ts
(o) => {
  o.drachms = 0;
  o.ownedEquipmentIds = [];
  o.equipped = { weapon: null, armour: null, accessory: null };
  o.version = 4;
}
```

Post-step shape check: `typeof o.drachms === 'number'`, `Array.isArray(o.ownedEquipmentIds)`, `o.equipped !== null`.

---

## 4. Shops

### 4.1 ShopDef type (new — `src/content/types.ts`)

```ts
export interface ShopDef {
  id: string;
  name: string;             // display name e.g. "Curie's Forge"
  regionId: string;         // region this shop serves; used for lookup
  equipmentIds: string[];   // ordered list of what's for sale
}
```

`GameContent` gains: `shops: Record<string, ShopDef>`.

### 4.2 One shop per region

Each region gets one shopkeeper NPC and one corresponding ShopDef. Shop tier mix:

| Regions | Tiers stocked |
|---|---|
| R1–R2 | T1 only |
| R3–R4 | T1 + T2 |
| R5–R6 | T2 only |
| R7–R8 | T2 + T3 |

Each shop stocks items from all three class families (players of any class can browse and buy; `canEquip` check prevents wrong-class equipping in MenuScene).

Shopkeeper NPCs are placed on a tile adjacent to spawn and accessible before the mini-boss (same reachability rule as healing springs and lesson NPCs). Each gets a unique name and brief flavour line before `"launch": "shop"`.

### 4.3 ShopScene (`src/scenes/ShopScene.ts`)

- Phaser scene key: `'ShopScene'`
- Launch data: `{ regionId: string, returnTo: string, returnData: Record<string, unknown> }`
- `create()`: reads `content`, `save` from registry; looks up shop by `regionId` via `Object.values(content.shops).find(s => s.regionId === regionId)`; bails to WorldMapScene if not found
- Layout: header "Shop — N ⬡" (Drachm balance); list of equipment items (name / stats / price); currently owned items marked `✓`; items class can't equip shown greyed
- Navigation: ↑/↓ move selection, Enter = confirm buy, ESC = exit
- Buy logic: `save.drachms >= item.shopPrice` → deduct, push to `ownedEquipmentIds`, persist, toast `"Bought: <name>"`; else toast `"Not enough ⬡"`
- Exit: `this.scene.stop(); this.scene.start(returnTo, returnData)`

### 4.4 Dialogue trigger

`DialogueNode.launch` in `types.ts` extended: `launch?: 'shrine' | 'shop' | string`.

`DialogueScene.handleEnd()` new branch (before the `closeScene()` fallthrough):
```ts
if (launch === 'shop' && regionId) {
  this.scene.stop(this.returnTo);
  this.scene.start('ShopScene', { regionId, returnTo: this.returnTo, returnData: this.returnData });
  return;
}
```

Shopkeeper dialogue is short (2 nodes max): flavour greeting → shop offer with `"launch": "shop"` and `"end": true`.

---

## 5. MenuScene — Equipment Tab

New tab `'Equipment'` inserted at index 2: `Skills | Refine | Equipment | Items | Status | Save | Settings | Quit`.

`buildEquipmentTab()` layout:

```
Equipped Stats: ATK 19  DEF 12  SPD 11  HP 85
(compared to base: ATK 14+5  DEF 9+3  SPD 10+1  HP 65+20)

── Weapon ──────────────────────────────────
◆ Ember Rod  [forge-arms T2]  ATK+8 SPD+1
  Ignis Torch  [forge-arms T1]  ATK+4        (owned, not equipped)
  (empty)                                   (slot header if nothing equipped)

── Armour ───────────────────────────────────
◇ (no armour equipped)

── Accessory ────────────────────────────────
◇ (no accessory equipped)
```

Enter on an owned (non-equipped) item: equip it in that slot; replace old equipped if any (old goes back to ownedEquipmentIds). Enter on the equipped item: unequip it. Save persisted on equip/unequip. Toast shows stat delta.

Items the player's class can't wield are not shown (filtered by `canEquip`).

---

## 6. Content additions to existing files

### `src/content/data/npcs.json`
Add 8 shopkeeper NPCs (one per region). Each has a 2-node dialogue ending in `"launch": "shop"`.

### `src/content/data/tilemaps/<region>.json`
Add one `npc` object entry for the shopkeeper in each of the 8 tilemaps. Coordinate constraints: same side of the mini-boss chokepoint as player_spawn, distinct from all existing NPC/object tiles. `realContent.test.ts` BFS regression already covers NPC reachability.

### `src/content/data/enemies.json`
Add `dropEquipmentId` to 16 entries (8 miniBosses + 8 regionBosses/finalBoss). Values reference equipment IDs from equipment.json; accessories preferred so any class can use them.

### `src/content/data/regions.json`
No changes required.

---

## 7. Content loading (`src/content/loadGameContent.ts`)

```ts
import equipment from './data/equipment.json';
import shops from './data/shops.json';
// add to ContentLoader.fromRaw(...)
```

`ContentLoader.fromRaw` and `GameContent` type extended to include `equipment` and `shops`.  
`content/schema.ts` gets `EquipmentDefSchema` and `ShopDefSchema` zod shapes (mirror existing patterns).

---

## 8. Testing plan

**`tests/systems/saveManager.test.ts`**
- `newGame` seeds `drachms=0`, `ownedEquipmentIds=[]`, `equipped={weapon:null, armour:null, accessory:null}` at version 4
- v3 save migrates cleanly to v4

**`tests/systems/equipment.test.ts`** (new)
- `equippedStatBonus` with no equipment → zero Stats
- `equippedStatBonus` with weapon + armour → sums correctly
- `effectiveStats` = statsForLevel output + equipment bonus
- `canEquip` returns true for matching class, false otherwise

**`tests/scenes/battleVictory.test.ts`**
- Wild kill awards `floor(level × 3)` Drachms
- MiniBoss kill awards `floor(level × 8)` Drachms + first-clear equipment drop banner
- Second miniBoss kill: no duplicate equipment drop
- RegionBoss kill awards `floor(level × 15)` Drachms

**`tests/content/realContent.test.ts`**
- All 39 equipment IDs are unique; each has valid kind/family/tier/wieldableBy
- All 8 shopDefs reference valid equipment IDs and valid regionIds
- `dropEquipmentId` on enemies references valid equipment IDs
- All 8 shopkeeper NPCs are BFS-reachable from their region's `player_spawn` (reuses existing BFS helper)

---

## 9. Implementation decomposition

Two parallel sonnet subagents after the data types are locked:

**Subagent A — Data layer (independent of Phaser)**
Content: types.ts, equipment.ts, SaveManager.ts, battleVictory.ts, loadGameContent.ts, schema.ts, equipment.json, shops.json, enemies.json (dropEquipmentId), tests (saveManager, equipment, battleVictory)

**Subagent B — UI layer (Phaser scenes)**
Content: ShopScene.ts, MenuScene.ts (Equipment tab), BattleScene.ts (effectiveStats), HealingSpringScene.ts (effectiveStats.hp), DialogueScene.ts (launch:'shop'), OverworldScene.ts (no changes needed — DialogueScene handles shop launch), main.ts (register ShopScene), npcs.json (shopkeeper NPCs), 8 tilemap files (shopkeeper NPC tiles), realContent.test.ts additions

B depends on A's types being committed before it starts.

---

## 10. Out of scope (do not implement)

- Equipment crafting / upgrading
- Class-changing equipment (class is fixed at game start)
- Equipment with skill-modify effects (skills are a separate system)
- Selling equipment back to shops
- Random/RNG loot drops (all drops are deterministic fixed items)
- Inventory management / item limits (ownedEquipmentIds is unbounded)
