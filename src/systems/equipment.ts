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
