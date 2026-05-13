import Phaser from 'phaser';
import type { GameContent, SaveData, SkillDef } from '../content/types';
import { setLoadout } from './loadout';
import { previewRefine, applyRefine } from './skillRefine';
import { MAX_TIER } from '../systems/skillTiers';
import { persist as savePersist } from '../persist';
import { totalXpForLevel, xpToNextLevel } from '../systems/Progression';
import { MusicManager } from '../systems/MusicManager';
import { effectiveStats, canEquip } from '../systems/equipment';

interface MenuSceneData { returnTo?: string; returnData?: Record<string, unknown> }

const W = 1920, H = 1080, FONT = 'monospace';
const TABS = ['Skills', 'Refine', 'Equipment', 'Items', 'Status', 'Save', 'Settings', 'Quit'] as const;
type Tab = typeof TABS[number];

// Layout constants — FF-style two-pane layout
const TAB_COL_W = 200;          // width of the left tab column
const FRAME_X = 60;             // outer frame left edge
const FRAME_Y = 60;             // outer frame top edge
const FRAME_W = W - 120;        // outer frame width
const FRAME_H = H - 120;        // outer frame height
const DIVIDER_X = FRAME_X + TAB_COL_W;   // x of vertical gold divider
const CONTENT_X = DIVIDER_X + 24;        // content pane left margin
const CONTENT_Y = FRAME_Y + 100;         // content pane top (below header)
const CONTENT_W = FRAME_W - TAB_COL_W - 32;
const TAB_START_Y = FRAME_Y + 108;       // first tab label y
const TAB_ROW_H = 56;                    // height per tab row
const GOLD = '#d4af37';
const GOLD_N = 0xd4af37;
const CREAM = '#c9b88b';
const BRIGHT_GOLD = '#ffd166';

/**
 * The in-game menu overlay: Skills loadout, Items (out-of-battle use), Status (stats + XP-to-next
 * + per-topic quiz accuracy), Save, Settings (Study Mode / Answer Timer), Quit to Title.
 * Launched on top of a paused caller; ↑/↓ switch tabs or move within a tab, Enter activates,
 * Esc closes. The only pure logic — loadout validation — lives in `setLoadout`.
 */
export class MenuScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private returnTo = '';
  private returnData: Record<string, unknown> = {};

  private tabLabels: Phaser.GameObjects.Text[] = [];
  private tabGlowStrips: Phaser.GameObjects.Rectangle[] = [];
  private tabIndex = 0;
  private rowIdx = 0;
  private tabObjs: Phaser.GameObjects.GameObject[] = [];
  private rowButtons: Phaser.GameObjects.Text[] = [];
  private toastText!: Phaser.GameObjects.Text;

  // cursor caret
  private caret!: Phaser.GameObjects.Text;
  private caretTween!: Phaser.Tweens.Tween;

  // frame group (persists across tab switches)
  private frameGroup: Phaser.GameObjects.GameObject[] = [];

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
    this.frameGroup = [];

    this.buildFrame();
    this.buildTabColumn();

    this.toastText = this.add.text(CONTENT_X + CONTENT_W / 2, FRAME_Y + FRAME_H - 36, '', {
      fontFamily: FONT, fontSize: '28px', color: '#f9e2af',
    }).setOrigin(0.5, 0).setDepth(3);

    // input
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', this.onUp, this);
      kb.on('keydown-DOWN', this.onDown, this);
      kb.on('keydown-ENTER', this.onConfirm, this);
      kb.on('keydown-SPACE', this.onConfirm, this);
      kb.on('keydown-ESC', this.onClose, this);
      // Legacy tab-switch keys (LEFT/RIGHT previously switched tabs — repurposed to tab nav)
      kb.on('keydown-LEFT', this.onTabUp, this);
      kb.on('keydown-RIGHT', this.onTabDown, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-UP', this.onUp, this);
        kb.off('keydown-DOWN', this.onDown, this);
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.onClose, this);
        kb.off('keydown-LEFT', this.onTabUp, this);
        kb.off('keydown-RIGHT', this.onTabDown, this);
      });
    }

    // Entrance animation — frame fades in, tab column slides in from left
    const allFrame = [...this.frameGroup, ...this.tabLabels, ...this.tabGlowStrips, this.caret] as Phaser.GameObjects.GameObject[];
    allFrame.forEach(o => { if ('setAlpha' in o) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0); });
    this.tabLabels.forEach(t => t.setX(t.x - 20));

    this.tweens.add({
      targets: allFrame,
      alpha: 1,
      duration: 250,
      ease: 'Power2',
    });
    this.tweens.add({
      targets: this.tabLabels,
      x: `+=${20}`,
      duration: 250,
      ease: 'Power2',
    });

    this.buildTab();
  }

  // --- frame / chrome -------------------------------------------------------

  private buildFrame(): void {
    const gfx = this.add.graphics().setDepth(1);

    // Background gradient approximation — two overlapping rects
    gfx.fillStyle(0x0d1b2a, 1);
    gfx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
    // Vignette — dark edges, lighter centre
    gfx.fillStyle(0x000000, 0.32);
    gfx.fillRect(FRAME_X, FRAME_Y, FRAME_W, 80);         // top shadow
    gfx.fillRect(FRAME_X, FRAME_Y + FRAME_H - 80, FRAME_W, 80); // bottom shadow
    gfx.fillRect(FRAME_X, FRAME_Y, 80, FRAME_H);         // left shadow
    gfx.fillRect(FRAME_X + FRAME_W - 80, FRAME_Y, 80, FRAME_H); // right shadow
    // Inner lighter band (centre glow)
    gfx.fillStyle(0x1b263b, 0.5);
    gfx.fillRect(FRAME_X + 80, FRAME_Y + 80, FRAME_W - 160, FRAME_H - 160);

    // Gold outer border (2px)
    gfx.lineStyle(2, GOLD_N, 1);
    gfx.strokeRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);

    // Corner braces — L-shaped gold strokes, 16px each side
    const BRACE = 16;
    const corners = [
      [FRAME_X, FRAME_Y],
      [FRAME_X + FRAME_W, FRAME_Y],
      [FRAME_X, FRAME_Y + FRAME_H],
      [FRAME_X + FRAME_W, FRAME_Y + FRAME_H],
    ] as const;
    gfx.lineStyle(3, GOLD_N, 1);
    // top-left
    gfx.beginPath(); gfx.moveTo(FRAME_X, FRAME_Y + BRACE); gfx.lineTo(FRAME_X, FRAME_Y); gfx.lineTo(FRAME_X + BRACE, FRAME_Y); gfx.strokePath();
    // top-right
    gfx.beginPath(); gfx.moveTo(FRAME_X + FRAME_W - BRACE, FRAME_Y); gfx.lineTo(FRAME_X + FRAME_W, FRAME_Y); gfx.lineTo(FRAME_X + FRAME_W, FRAME_Y + BRACE); gfx.strokePath();
    // bottom-left
    gfx.beginPath(); gfx.moveTo(FRAME_X, FRAME_Y + FRAME_H - BRACE); gfx.lineTo(FRAME_X, FRAME_Y + FRAME_H); gfx.lineTo(FRAME_X + BRACE, FRAME_Y + FRAME_H); gfx.strokePath();
    // bottom-right
    gfx.beginPath(); gfx.moveTo(FRAME_X + FRAME_W - BRACE, FRAME_Y + FRAME_H); gfx.lineTo(FRAME_X + FRAME_W, FRAME_Y + FRAME_H); gfx.lineTo(FRAME_X + FRAME_W, FRAME_Y + FRAME_H - BRACE); gfx.strokePath();

    // Vertical gold divider between tab column and content pane
    gfx.lineStyle(1, GOLD_N, 0.7);
    gfx.beginPath(); gfx.moveTo(DIVIDER_X, FRAME_Y + 8); gfx.lineTo(DIVIDER_X, FRAME_Y + FRAME_H - 8); gfx.strokePath();

    // Header area — "MENU" title in right pane
    const headerCx = CONTENT_X + CONTENT_W / 2;
    const headerY = FRAME_Y + 28;
    this.add.text(headerCx, headerY, 'MENU', {
      fontFamily: FONT, fontSize: '36px', color: GOLD, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(2);

    // Thin gold accent line under the header title
    gfx.lineStyle(1, GOLD_N, 0.8);
    gfx.beginPath(); gfx.moveTo(CONTENT_X, FRAME_Y + 88); gfx.lineTo(CONTENT_X + CONTENT_W, FRAME_Y + 88); gfx.strokePath();

    // Footer hint strip
    this.add.text(FRAME_X + FRAME_W / 2, FRAME_Y + FRAME_H - 32,
      '↑↓ Navigate    ↵ Select    Esc Back',
      { fontFamily: FONT, fontSize: '22px', color: '#566074' },
    ).setOrigin(0.5, 1).setDepth(2);

    this.frameGroup.push(gfx);
  }

  private buildTabColumn(): void {
    this.tabLabels = [];
    this.tabGlowStrips = [];

    TABS.forEach((t, i) => {
      const y = TAB_START_Y + i * TAB_ROW_H;

      // Glow strip behind active tab (initially hidden)
      const strip = this.add.rectangle(FRAME_X + 6, y + TAB_ROW_H / 2, TAB_COL_W - 12, 34, GOLD_N, 0)
        .setOrigin(0, 0.5).setDepth(1);
      this.tabGlowStrips.push(strip);

      // Tab label
      const label = this.add.text(FRAME_X + 28, y + TAB_ROW_H / 2, t, {
        fontFamily: FONT, fontSize: '28px', color: CREAM,
      }).setOrigin(0, 0.5).setDepth(2).setInteractive({ useHandCursor: true });

      label.on('pointerdown', () => { this.tabIndex = i; this.rowIdx = 0; this.buildTab(); });
      this.tabLabels.push(label);
    });

    // Blinking caret — placed left of active tab label
    this.caret = this.add.text(FRAME_X + 10, TAB_START_Y + TAB_ROW_H / 2, '▶', {
      fontFamily: FONT, fontSize: '22px', color: GOLD,
    }).setOrigin(0, 0.5).setDepth(3);

    // Caret blink tween
    this.caretTween = this.tweens.add({
      targets: this.caret,
      alpha: { from: 1, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateTabHighlights(): void {
    TABS.forEach((_, i) => {
      const isActive = i === this.tabIndex;
      this.tabLabels[i]?.setColor(isActive ? BRIGHT_GOLD : CREAM);
      this.tabGlowStrips[i]?.setFillStyle(GOLD_N, isActive ? 0.15 : 0);
    });

    // Move caret to active tab row
    const activeY = TAB_START_Y + this.tabIndex * TAB_ROW_H + TAB_ROW_H / 2;
    this.caret.setY(activeY);
  }

  // --- input ---------------------------------------------------------------

  /** Move to previous tab (UP or LEFT arrow) */
  private onTabUp(): void {
    this.tabIndex = (this.tabIndex + TABS.length - 1) % TABS.length;
    this.rowIdx = 0;
    this.pulseCaret();
    this.buildTab();
  }

  /** Move to next tab (DOWN or RIGHT arrow when rowCount === 0 context, handled at onUp/onDown) */
  private onTabDown(): void {
    this.tabIndex = (this.tabIndex + 1) % TABS.length;
    this.rowIdx = 0;
    this.pulseCaret();
    this.buildTab();
  }

  private onUp(): void {
    const n = this.rowCount();
    if (n > 1) {
      this.rowIdx = (this.rowIdx + n - 1) % n;
      this.highlightRows();
    } else {
      // No rows in content pane — navigate tabs
      this.onTabUp();
    }
  }

  private onDown(): void {
    const n = this.rowCount();
    if (n > 1) {
      this.rowIdx = (this.rowIdx + 1) % n;
      this.highlightRows();
    } else {
      this.onTabDown();
    }
  }

  private onConfirm(): void { this.activateRow(this.rowIdx); }
  private onClose(): void { this.closeMenu(); }

  private pulseCaret(): void {
    // Briefly pause the blink and scale up then back
    if (this.caretTween) this.caretTween.pause();
    this.caret.setAlpha(1);
    this.tweens.add({
      targets: this.caret,
      scaleX: 1.2, scaleY: 1.2,
      duration: 60,
      yoyo: true,
      ease: 'Power1',
      onComplete: () => {
        this.caret.setScale(1, 1);
        if (this.caretTween) this.caretTween.resume();
      },
    });
  }

  // --- tab building --------------------------------------------------------

  private tab(): Tab { return TABS[this.tabIndex]!; }

  private buildTab(): void {
    this.tabObjs.forEach(o => o.destroy());
    this.tabObjs = []; this.rowButtons = [];
    this.updateTabHighlights();
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
    this.highlightRows();
  }

  private addObj<T extends Phaser.GameObjects.GameObject>(o: T): T { this.tabObjs.push(o); return o; }

  private addRow(y: number, onClick: () => void): Phaser.GameObjects.Text {
    const idx = this.rowButtons.length;
    const txt = this.add.text(CONTENT_X, y, '', { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => { this.rowIdx = idx; this.highlightRows(); });
    txt.on('pointerdown', () => { this.rowIdx = idx; onClick(); });
    this.addObj(txt);
    this.rowButtons.push(txt);
    return txt;
  }

  private buildSkillsTab(): void {
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y, `Equipped ${this.save.equippedSkillIds.length}/5  ·  Enter toggles`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(2));
    const skills = this.save.unlockedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const equipped = this.save.equippedSkillIds.includes(s.id);
      const row = this.addRow(CONTENT_Y + 56 + i * 48, () => this.toggleSkill(s.id));
      row.setData('label', `${equipped ? '◆' : '◇'} ${s.name}  [${s.affinity}] P${s.power} E${s.energyCost}${s.topic === null ? ' ·basic' : ''}`);
    });
  }

  private buildRefineTab(): void {
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y, `Reagent Points: ${this.save.reagentPoints}  ·  Enter to refine`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(2));
    const skills = this.save.unlockedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const p = previewRefine(this.save, s.id, this.content);
      const row = this.addRow(CONTENT_Y + 56 + i * 48, () => this.refine(s.id));
      const tierTag = `T${p.tier}/${MAX_TIER}`;
      const label = p.atMax
        ? `${s.name}  [${s.affinity}]  ${tierTag}  — MAX`
        : `${s.name}  [${s.affinity}]  ${tierTag}  →  +${p.delta.power} Pwr / +${p.delta.statusChance}% / −${p.delta.energyCost} EN   (${p.cost} RP)${p.canAfford ? '' : '  ✗'}`;
      row.setData('label', label);
    });
  }

  private buildEquipmentTab(): void {
    const equipped = this.save.equipped;
    const equipMap = this.content.equipment ?? {};
    const base = this.save.stats;
    const eff = effectiveStats(this.save, equipMap);
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y,
      `Effective:  ATK ${eff.atk}  DEF ${eff.def}  SPD ${eff.spd}  HP ${eff.hp}  ·  Enter equips/unequips`,
      { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(2));
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y + 36,
      `Base:       ATK ${base.atk}  DEF ${base.def}  SPD ${base.spd}  HP ${base.hp}`,
      { fontFamily: FONT, fontSize: '24px', color: '#566074' }).setDepth(2));

    const allOwned = this.save.ownedEquipmentIds
      .map(id => equipMap[id])
      .filter((e): e is import('../content/types').EquipmentDef => !!e && canEquip(e, this.save.classId));

    let y = CONTENT_Y + 88;
    for (const slotKey of ['weapon', 'armour', 'accessory'] as const) {
      this.addObj(this.add.text(CONTENT_X, y, `── ${slotKey.charAt(0).toUpperCase() + slotKey.slice(1)} ──`, { fontFamily: FONT, fontSize: '26px', color: '#89dceb' }).setDepth(2));
      y += 40;
      const slotItems = allOwned.filter(e => e.kind === slotKey);
      if (slotItems.length === 0) {
        this.addObj(this.add.text(CONTENT_X + 20, y, '  (none owned)', { fontFamily: FONT, fontSize: '26px', color: '#566074' }).setDepth(2));
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
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y, 'Items  ·  Enter to use (out of battle)', { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(2));
    if (this.save.items.length === 0) { this.addObj(this.add.text(CONTENT_X, CONTENT_Y + 56, '(empty)', { fontFamily: FONT, fontSize: '28px', color: '#566074' }).setDepth(2)); return; }
    this.save.items.forEach((entry, i) => {
      const def = this.content.items[entry.itemId];
      const row = this.addRow(CONTENT_Y + 56 + i * 48, () => this.useItem(entry.itemId));
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
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y, lines.join('\n'), { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4', lineSpacing: 12 }).setDepth(2));
  }

  private buildSettingsTab(): void {
    this.addObj(this.add.text(CONTENT_X, CONTENT_Y, 'Settings  ·  Enter / ←→ toggles', { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setDepth(2));
    const r0 = this.addRow(CONTENT_Y + 56, () => this.toggleSetting('studyMode'));
    r0.setData('label', `Study Mode: ${this.save.settings.studyMode ? 'ON' : 'off'}   — hints on, chain pressure off`);
    const r1 = this.addRow(CONTENT_Y + 104, () => this.toggleSetting('answerTimer'));
    r1.setData('label', `Answer Timer: ${this.save.settings.answerTimer ? 'ON' : 'off'}   — fast answers can crit`);
    const volPct = Math.round((this.save.settings.musicVolume ?? 0.6) * 100);
    const r2 = this.addRow(CONTENT_Y + 152, () => this.cycleVolume());
    r2.setData('label', `Music Volume: ${volPct}%   — ←/→ to adjust`);
  }

  private toggleSetting(key: 'studyMode' | 'answerTimer'): void {
    this.save.settings[key] = !this.save.settings[key];
    this.persist();
    this.toast(`${key === 'studyMode' ? 'Study Mode' : 'Answer Timer'} ${this.save.settings[key] ? 'ON' : 'off'}`);
    this.buildTab();
  }

  private cycleVolume(): void {
    const LEVELS = [0, 0.25, 0.5, 0.75, 1.0];
    const cur = this.save.settings.musicVolume ?? 0.6;
    // Find the nearest level index, then advance to the next
    let idx = LEVELS.findIndex(l => Math.abs(l - cur) < 0.01);
    if (idx === -1) idx = LEVELS.findIndex(l => l >= cur);
    if (idx === -1) idx = LEVELS.length - 1;
    const nextIdx = (idx + 1) % LEVELS.length;
    const newVal = LEVELS[nextIdx]!;
    this.save.settings.musicVolume = newVal;
    MusicManager.setVolume(newVal);
    this.persist();
    this.toast(`Music ${Math.round(newVal * 100)}%`);
    this.buildTab();
  }

  private buildButtonTab(label: string): void {
    const row = this.addRow(CONTENT_Y + 56, () => this.activateRow(0));
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
      case 'Equipment': {
        const allOwned = this.save.ownedEquipmentIds
          .map(id => this.content.equipment?.[id])
          .filter((e): e is import('../content/types').EquipmentDef => !!e && canEquip(e, this.save.classId));
        const item = allOwned[i];
        if (item) this.toggleEquip(item);
        break;
      }
      case 'Items': { const entry = this.save.items[i]; if (entry) this.useItem(entry.itemId); break; }
      case 'Settings':
        if (i === 0) this.toggleSetting('studyMode');
        else if (i === 1) this.toggleSetting('answerTimer');
        else this.cycleVolume();
        break;
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
