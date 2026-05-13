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
