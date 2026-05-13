import Phaser from 'phaser';
import type { GameContent, SaveData, SkillDef } from '../content/types';
import { setLoadout } from './loadout';
import { previewRefine, applyRefine } from './skillRefine';
import { MAX_TIER } from '../systems/skillTiers';
import { persist as savePersist } from '../persist';
import { totalXpForLevel, xpToNextLevel } from '../systems/Progression';

interface MenuSceneData { returnTo?: string; returnData?: Record<string, unknown> }

const W = 1920, H = 1080, FONT = 'monospace';
const TABS = ['Skills', 'Refine', 'Items', 'Status', 'Save', 'Settings', 'Quit'] as const;
type Tab = typeof TABS[number];

/**
 * The in-game menu overlay: Skills loadout, Items (out-of-battle use), Status (stats + XP-to-next
 * + per-topic quiz accuracy), Save, Settings (Study Mode / Answer Timer), Quit to Title.
 * Launched on top of a paused caller; ←/→ switch tabs, ↑/↓ move within a tab, Enter activates,
 * Esc closes. The only pure logic — loadout validation — lives in `setLoadout`.
 */
export class MenuScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private returnTo = '';
  private returnData: Record<string, unknown> = {};

  private tabHeaders: Phaser.GameObjects.Text[] = [];
  private tabIndex = 0;
  private rowIdx = 0;
  private tabObjs: Phaser.GameObjects.GameObject[] = [];
  private rowButtons: Phaser.GameObjects.Text[] = [];
  private toastText!: Phaser.GameObjects.Text;

  constructor() { super('MenuScene'); }

  init(data: MenuSceneData): void {
    this.returnTo = data?.returnTo ?? 'WorldMapScene';
    this.returnData = data?.returnData ?? {};
  }

  create(): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.closeMenu(); return; }
    this.save = save;
    this.tabIndex = 0; this.rowIdx = 0; this.tabObjs = []; this.rowButtons = [];

    this.add.rectangle(0, 0, W, H, 0x05080d, 0.94).setOrigin(0, 0).setDepth(0);
    this.add.text(W / 2, 24, '— Menu —', { fontFamily: FONT, fontSize: '40px', color: '#cdd6f4' }).setOrigin(0.5, 0).setDepth(1);
    this.add.text(W / 2, H - 80, '←/→ tab   ↑/↓ select   Enter use   Esc close', { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setOrigin(0.5, 0).setDepth(1);
    this.toastText = this.add.text(W / 2, H - 44, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af' }).setOrigin(0.5, 0).setDepth(1);

    // tab headers
    const startX = 96, gap = (W - 192) / TABS.length;
    this.tabHeaders = TABS.map((t, i) => {
      const txt = this.add.text(startX + i * gap + gap / 2, 96, t, { fontFamily: FONT, fontSize: '32px', color: '#8fa3c0' }).setOrigin(0.5, 0).setDepth(1).setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => { this.tabIndex = i; this.rowIdx = 0; this.buildTab(); });
      return txt;
    });

    // input
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-LEFT', this.onLeft, this);
      kb.on('keydown-RIGHT', this.onRight, this);
      kb.on('keydown-UP', this.onUp, this);
      kb.on('keydown-DOWN', this.onDown, this);
      kb.on('keydown-ENTER', this.onConfirm, this);
      kb.on('keydown-SPACE', this.onConfirm, this);
      kb.on('keydown-ESC', this.onClose, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-LEFT', this.onLeft, this);
        kb.off('keydown-RIGHT', this.onRight, this);
        kb.off('keydown-UP', this.onUp, this);
        kb.off('keydown-DOWN', this.onDown, this);
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.onClose, this);
      });
    }

    this.buildTab();
  }

  // --- input ---------------------------------------------------------------

  private onLeft(): void { this.tabIndex = (this.tabIndex + TABS.length - 1) % TABS.length; this.rowIdx = 0; this.buildTab(); }
  private onRight(): void { this.tabIndex = (this.tabIndex + 1) % TABS.length; this.rowIdx = 0; this.buildTab(); }
  private onUp(): void { const n = this.rowCount(); if (n > 1) { this.rowIdx = (this.rowIdx + n - 1) % n; this.highlightRows(); } }
  private onDown(): void { const n = this.rowCount(); if (n > 1) { this.rowIdx = (this.rowIdx + 1) % n; this.highlightRows(); } }
  private onConfirm(): void { this.activateRow(this.rowIdx); }
  private onClose(): void { this.closeMenu(); }

  // --- tab building --------------------------------------------------------

  private tab(): Tab { return TABS[this.tabIndex]!; }

  private buildTab(): void {
    this.tabObjs.forEach(o => o.destroy());
    this.tabObjs = []; this.rowButtons = [];
    this.tabHeaders.forEach((h, i) => h.setColor(i === this.tabIndex ? '#f9e2af' : '#8fa3c0'));
    switch (this.tab()) {
      case 'Skills': this.buildSkillsTab(); break;
      case 'Refine': this.buildRefineTab(); break;
      case 'Items': this.buildItemsTab(); break;
      case 'Status': this.buildStatusTab(); break;
      case 'Save': this.buildButtonTab('Save now'); break;
      case 'Settings': this.buildSettingsTab(); break;
      case 'Quit': this.buildButtonTab('Quit to Title'); break;
    }
    this.highlightRows();
  }

  private addObj<T extends Phaser.GameObjects.GameObject>(o: T): T { this.tabObjs.push(o); return o; }

  private addRow(y: number, onClick: () => void): Phaser.GameObjects.Text {
    const idx = this.rowButtons.length;
    const txt = this.add.text(160, y, '', { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(1).setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => { this.rowIdx = idx; this.highlightRows(); });
    txt.on('pointerdown', () => { this.rowIdx = idx; onClick(); });
    this.addObj(txt);
    this.rowButtons.push(txt);
    return txt;
  }

  private buildSkillsTab(): void {
    this.addObj(this.add.text(160, 168, `Equipped ${this.save.equippedSkillIds.length}/5  ·  Enter toggles`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
    const skills = this.save.unlockedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const equipped = this.save.equippedSkillIds.includes(s.id);
      const row = this.addRow(224 + i * 48, () => this.toggleSkill(s.id));
      row.setData('label', `${equipped ? '◆' : '◇'} ${s.name}  [${s.affinity}] P${s.power} E${s.energyCost}${s.topic === null ? ' ·basic' : ''}`);
    });
  }

  private buildRefineTab(): void {
    this.addObj(this.add.text(160, 168, `Reagent Points: ${this.save.reagentPoints}  ·  Enter to refine`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
    const skills = this.save.unlockedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const p = previewRefine(this.save, s.id, this.content);
      const row = this.addRow(224 + i * 48, () => this.refine(s.id));
      const tierTag = `T${p.tier}/${MAX_TIER}`;
      const label = p.atMax
        ? `${s.name}  [${s.affinity}]  ${tierTag}  — MAX`
        : `${s.name}  [${s.affinity}]  ${tierTag}  →  +${p.delta.power} Pwr / +${p.delta.statusChance}% / −${p.delta.energyCost} EN   (${p.cost} RP)${p.canAfford ? '' : '  ✗'}`;
      row.setData('label', label);
    });
  }

  private refine(skillId: string): void {
    const r = applyRefine(this.save, skillId, this.content);
    if (r.ok) { this.persist(); this.toast(`Refined ${this.content.skills[skillId]?.name ?? skillId} → T${r.tier}.  ${r.reagentPoints} RP left.`); this.buildTab(); }
    else this.toast(r.reason);
  }

  private toggleSkill(id: string): void {
    const cur = [...this.save.equippedSkillIds];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    const r = setLoadout(this.save, next, this.content);
    if (r.ok) { this.save.equippedSkillIds = r.equipped; this.persist(); this.buildTab(); }
    else this.toast(r.reason);
  }

  private buildItemsTab(): void {
    this.addObj(this.add.text(160, 168, 'Items  ·  Enter to use (out of battle)', { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
    if (this.save.items.length === 0) { this.addObj(this.add.text(160, 224, '(empty)', { fontFamily: FONT, fontSize: '28px', color: '#566074' }).setDepth(1)); return; }
    this.save.items.forEach((entry, i) => {
      const def = this.content.items[entry.itemId];
      const row = this.addRow(224 + i * 48, () => this.useItem(entry.itemId));
      row.setData('label', `${def?.name ?? entry.itemId}  ×${entry.qty}  — ${def?.description ?? ''}`);
    });
  }

  private useItem(itemId: string): void {
    const def = this.content.items[itemId];
    const e = def?.effect;
    if (!def || !e || (!e.healHp && !e.healHpPercent && !e.restoreEnergy)) { this.toast("Can't use that here."); return; }
    let healed = 0;
    if (e.healHp) healed += e.healHp;
    if (e.healHpPercent) healed += Math.floor(this.save.stats.hp * e.healHpPercent / 100);
    if (healed) this.save.currentHp = Math.min(this.save.stats.hp, this.save.currentHp + healed);
    if (e.restoreEnergy) this.save.currentEnergy = Math.min(100, this.save.currentEnergy + e.restoreEnergy);
    const entry = this.save.items.find(it => it.itemId === itemId);
    if (entry) { entry.qty -= 1; if (entry.qty <= 0) this.save.items = this.save.items.filter(it => it.itemId !== itemId); }
    this.persist();
    this.toast(`Used ${def.name}.${healed ? `  +${healed} HP` : ''}`);
    this.rowIdx = 0;
    this.buildTab();
  }

  private buildStatusTab(): void {
    const s = this.save;
    const cls = this.content.classes.find(c => c.id === s.classId);
    const stageName = s.evolutionStage === 0 ? (cls?.name ?? s.classId) : (cls?.evolutions.find(e => e.stage === s.evolutionStage)?.name ?? cls?.name ?? s.classId);
    const intoLevel = xpToNextLevel(s.level) - (s.xp - totalXpForLevel(s.level));
    const equipped = s.equippedSkillIds.map(id => this.content.skills[id]?.name ?? id).join(', ');
    const lines = [
      `${stageName}   Lv. ${s.level}`,
      `XP ${s.xp}   (to next level: ${Math.max(0, intoLevel)})`,
      `HP ${s.currentHp}/${s.stats.hp}    EN ${s.currentEnergy}/100`,
      `ATK ${s.stats.atk}   DEF ${s.stats.def}   SPD ${s.stats.spd}`,
      `Skills: ${equipped}`,
      '',
      'Topic accuracy:',
    ];
    const stats = Object.values(s.quizStats);
    if (stats.length === 0) lines.push('  (no questions answered yet)');
    else for (const q of stats) lines.push(`  ${q.topic}: ${q.correct}/${q.asked}${q.recentMisses ? `  (misses: ${q.recentMisses})` : ''}`);
    this.addObj(this.add.text(160, 176, lines.join('\n'), { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4', lineSpacing: 12 }).setDepth(1));
  }

  private buildSettingsTab(): void {
    this.addObj(this.add.text(160, 168, 'Settings  ·  Enter / ←→ toggles', { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(1));
    const r0 = this.addRow(224, () => this.toggleSetting('studyMode'));
    r0.setData('label', `Study Mode: ${this.save.settings.studyMode ? 'ON' : 'off'}   — hints on, chain pressure off`);
    const r1 = this.addRow(272, () => this.toggleSetting('answerTimer'));
    r1.setData('label', `Answer Timer: ${this.save.settings.answerTimer ? 'ON' : 'off'}   — fast answers can crit`);
  }

  private toggleSetting(key: 'studyMode' | 'answerTimer'): void {
    this.save.settings[key] = !this.save.settings[key];
    this.persist();
    this.toast(`${key === 'studyMode' ? 'Study Mode' : 'Answer Timer'} ${this.save.settings[key] ? 'ON' : 'off'}`);
    this.buildTab();
  }

  private buildButtonTab(label: string): void {
    const row = this.addRow(224, () => this.activateRow(0));
    row.setData('label', `▶ ${label}`);
  }

  // --- row helpers ---------------------------------------------------------

  private rowCount(): number { return this.rowButtons.length; }

  private highlightRows(): void {
    this.rowButtons.forEach((b, i) => {
      const label = (b.getData('label') as string) ?? '';
      b.setText((i === this.rowIdx ? '▷ ' : '  ') + label).setColor(i === this.rowIdx ? '#f9e2af' : '#cdd6f4');
    });
  }

  private activateRow(i: number): void {
    switch (this.tab()) {
      case 'Skills': { const ids = this.save.unlockedSkillIds.filter(id => this.content.skills[id]); const id = ids[i]; if (id) this.toggleSkill(id); break; }
      case 'Refine': { const ids = this.save.unlockedSkillIds.filter(id => this.content.skills[id]); const id = ids[i]; if (id) this.refine(id); break; }
      case 'Items': { const entry = this.save.items[i]; if (entry) this.useItem(entry.itemId); break; }
      case 'Settings': this.toggleSetting(i === 0 ? 'studyMode' : 'answerTimer'); break;
      case 'Save': this.persist(); this.toast('Saved.'); break;
      case 'Quit': this.quitToTitle(); break;
      case 'Status': break;
    }
  }

  // --- exits ---------------------------------------------------------------

  private persist(): void {
    this.registry.set('save', this.save);
    savePersist();
  }

  private toast(msg: string): void {
    this.toastText.setText(msg);
    this.time.delayedCall(2200, () => { if (this.toastText.text === msg) this.toastText.setText(''); });
  }

  private closeMenu(): void {
    this.scene.stop();
    if (this.scene.isPaused(this.returnTo)) this.scene.resume(this.returnTo, this.returnData);
    else if (!this.scene.isActive(this.returnTo)) this.scene.start(this.returnTo, this.returnData);
  }

  private quitToTitle(): void {
    this.persist();
    if (this.returnTo) this.scene.stop(this.returnTo);
    this.scene.start('TitleScene');
  }
}
