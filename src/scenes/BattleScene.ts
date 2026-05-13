import Phaser from 'phaser';
import type { Affinity, GameContent, SaveData, SkillDef, StatusEffectInstance, TypeChart } from '../content/types';
import { playSkillFx } from './battleFx';
import type { BattleState, BattleEvent, BattleAction, BattleContext } from '../systems/BattleEngine';
import { effectiveSkill, scaleSkillPower, MAX_TIER } from '../systems/skillTiers';
import { effectiveness } from '../systems/battle/typeChart';
import typeChartData from '../content/data/typeChart.json';
import { createBattle, resolveTurn } from '../systems/BattleEngine';
import { playerBattleInputFromSave, battleContextFromContent, REFRESHER_TOAST_KEY } from './battlePresenter';
import { applyVictory } from './battleVictory';
import { HealthBar } from '../ui/HealthBar';
import { EnergyBar } from '../ui/EnergyBar';
import { ChainMeter } from '../ui/ChainMeter';
import { QuizPanel } from '../ui/QuizPanel';
import { addPlaceholderLabel } from '../ui/placeholderTextures';
import { SaveManager } from '../systems/SaveManager';
import { persist as savePersist } from '../persist';
import type { QuizEngine } from '../systems/QuizEngine';

export interface BattleSceneData {
  enemyId: string;
  level?: number;
  isBoss?: boolean;
  isMiniBoss?: boolean;
  regionId: string;
  returnTo?: string;
  returnData?: Record<string, unknown>;
}

const W = 1920, H = 1080;
const FONT = 'monospace';
const ENEMY_X = 1440, ENEMY_GROUND_Y = 600;
const PLAYER_X = 440, PLAYER_GROUND_Y = 800;
const MENU_LABELS = ['Attack', 'Skills', 'Items', 'Run'] as const;

type Fsm = 'menu' | 'skillMenu' | 'itemMenu' | 'animating' | 'ended';

/**
 * The turn-based battle. Pure logic lives in `BattleEngine`; this scene only renders state
 * and replays the `BattleEvent[]` that `resolveTurn` returns. Task 45 covers Attack/Run, the
 * enemy turn, the animation walker, and win/lose/flee; Tasks 46–48 add Skills/quiz, Items,
 * Catalyst Burst, status icons and the victory sequence.
 */
export class BattleScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private params!: BattleSceneData;
  private ctx!: BattleContext;
  private state!: BattleState;

  // visuals
  private playerSprite!: Phaser.GameObjects.Image;
  private playerLabel: Phaser.GameObjects.Text | null = null;
  private enemySprite!: Phaser.GameObjects.Image;
  private enemyLabel: Phaser.GameObjects.Text | null = null;
  private enemyNameText!: Phaser.GameObjects.Text;
  private playerHpBar!: HealthBar;
  private playerEnergyBar!: EnergyBar;
  private enemyHpBar!: HealthBar;
  private chainMeter!: ChainMeter;
  private logLine!: Phaser.GameObjects.Text;
  private menuButtons: Phaser.GameObjects.Text[] = [];
  private studyMode = false;
  private quiz!: QuizEngine;
  private quizPanel!: QuizPanel;

  // skill submenu
  private skillMenuObjs: Phaser.GameObjects.GameObject[] = [];
  private skillRowButtons: Phaser.GameObjects.Text[] = [];
  private skillIdx = 0;
  private skillRowCount = 0;

  // item submenu
  private itemMenuObjs: Phaser.GameObjects.GameObject[] = [];
  private itemRowButtons: Phaser.GameObjects.Text[] = [];
  private itemRowIds: string[] = [];
  private itemIdx = 0;
  private itemRowCount = 0;

  // catalyst burst + status icons
  private burstButton: Phaser.GameObjects.Text | null = null;
  private burstTween: Phaser.Tweens.Tween | null = null;
  private playerStatusObjs: Phaser.GameObjects.GameObject[] = [];
  private enemyStatusObjs: Phaser.GameObjects.GameObject[] = [];

  // accumulated per-correct-answer XP, banked at victory (Task 48)
  private bonusXp = 0;

  // animation bookkeeping (displayed HP, corrected by snapBars() afterwards)
  private dispPlayerHp = 0;
  private dispEnemyHp = 0;
  private dispEnemyMaxHp = 1;

  private fsm: Fsm = 'menu';
  private menuIdx = 0;

  constructor() { super('BattleScene'); }

  init(data: BattleSceneData): void { this.params = data; }

  create(): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('TitleScene'); return; }
    this.save = save;
    this.studyMode = !!save.settings.studyMode;

    const enemyDef = this.content.enemies[this.params.enemyId];
    if (!enemyDef) { console.error(`[battle] unknown enemy "${this.params.enemyId}"`); this.returnHome(); return; }

    const region = this.content.regions.find(r => r.id === this.params.regionId) ?? this.content.regions[0];
    const bgKey = region?.battleBackgroundKey ?? 'bg_battle_elemental_reaches';

    this.quiz = this.registry.get('quiz') as QuizEngine;
    this.bonusXp = 0;
    this.skillMenuObjs = []; this.skillRowButtons = [];
    this.itemMenuObjs = []; this.itemRowButtons = []; this.itemRowIds = [];
    this.burstButton = null; this.burstTween = null;
    this.playerStatusObjs = []; this.enemyStatusObjs = [];

    // --- engine state ---
    this.ctx = battleContextFromContent(this.content, save.settings);
    this.state = createBattle(
      playerBattleInputFromSave(save, this.content),
      { def: enemyDef, level: this.params.level ?? enemyDef.level },
      { rng: Math.random },
    );

    // --- background ---
    this.cameras.main.setBackgroundColor('#0b0f17');
    this.add.image(W / 2, 410, bgKey).setDisplaySize(W, 820).setDepth(-100);
    this.add.rectangle(0, 820, W, H - 820, 0x0b1320).setOrigin(0, 0).setStrokeStyle(4, 0x415a77).setDepth(-50);

    // --- sprites ---
    this.playerSprite = this.add.image(PLAYER_X, PLAYER_GROUND_Y, this.heroBattleKey()).setOrigin(0.5, 1).setDepth(10);
    this.playerLabel = addPlaceholderLabel(this, PLAYER_X, PLAYER_GROUND_Y - this.playerSprite.displayHeight / 2, this.heroBattleKey(), this.content.assets);
    this.playerLabel?.setDepth(11);
    this.setEnemyVisuals(enemyDef.id);

    // --- enemy panel (top) ---
    this.enemyNameText = this.add.text(32, 32, '', { fontFamily: FONT, fontSize: '32px', color: '#cdd6f4' }).setOrigin(0, 0);
    this.enemyHpBar = new HealthBar(this, 32, 88, 720, 'HP');
    this.refreshEnemyName();
    this.enemyHpBar.setValue(this.state.enemy.hp, this.state.enemy.maxHp, false);

    // --- player panel (bottom-left) ---
    this.add.text(32, 830, `${this.state.player.name}  Lv.${this.state.player.level}`, { fontFamily: FONT, fontSize: '32px', color: '#cdd6f4' });
    this.playerHpBar = new HealthBar(this, 32, 880, 720, 'HP');
    this.playerEnergyBar = new EnergyBar(this, 32, 924, 720, 'EN');
    this.playerHpBar.setValue(this.state.player.hp, this.state.player.maxHp, false);
    this.playerEnergyBar.setValue(this.state.player.energy, this.state.player.maxEnergy, false);
    this.chainMeter = new ChainMeter(this, 32, 1000);
    this.chainMeter.setVisible(!this.studyMode);
    if (this.studyMode) this.add.text(32, 988, '(Study Mode — chain off)', { fontFamily: FONT, fontSize: '24px', color: '#89dceb' });

    // --- battle log line ---
    this.logLine = this.add.text(32, 1036, '', { fontFamily: FONT, fontSize: '28px', color: '#f9e2af', wordWrap: { width: W - 800 } }).setOrigin(0, 0);

    // --- quiz panel (hidden until a quizzed skill fires) ---
    this.quizPanel = new QuizPanel(this, 80, 136, W - 160, 660);
    this.quizPanel.setDepth(1000);

    // --- action menu (bottom-right) ---
    this.menuButtons = MENU_LABELS.map((label, i) => {
      const t = this.add.text(W - 440, 826 + i * 54, label, { fontFamily: FONT, fontSize: '36px', color: '#cdd6f4', padding: { x: 14, y: 4 } }).setOrigin(0, 0);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { if (this.fsm === 'menu') { this.menuIdx = i; this.refreshMenu(); } });
      t.on('pointerdown', () => { if (this.fsm === 'menu') { this.menuIdx = i; this.confirmMenu(); } });
      return t;
    });

    // --- input ---
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', this.onUp, this);
      kb.on('keydown-DOWN', this.onDown, this);
      kb.on('keydown-ENTER', this.onConfirm, this);
      kb.on('keydown-SPACE', this.onConfirm, this);
      kb.on('keydown-ESC', this.onCancel, this);
      kb.on('keydown-B', this.onBurstKey, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-UP', this.onUp, this);
        kb.off('keydown-DOWN', this.onDown, this);
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.onCancel, this);
        kb.off('keydown-B', this.onBurstKey, this);
      });
    }

    this.refreshStatusIcons();
    this.log(`A wild ${this.state.enemy.name} appears!`);
    this.fsm = 'menu';
    this.menuIdx = 0;
    this.refreshMenu();
    this.refreshBurstButton();
  }

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------

  private onUp(): void {
    if (this.fsm === 'menu') { this.menuIdx = (this.menuIdx + MENU_LABELS.length - 1) % MENU_LABELS.length; this.refreshMenu(); }
    else if (this.fsm === 'skillMenu') { this.skillIdx = (this.skillIdx + this.skillRowCount - 1) % this.skillRowCount; this.refreshSkillMenu(); }
    else if (this.fsm === 'itemMenu') { this.itemIdx = (this.itemIdx + this.itemRowCount - 1) % this.itemRowCount; this.refreshItemMenu(); }
  }
  private onDown(): void {
    if (this.fsm === 'menu') { this.menuIdx = (this.menuIdx + 1) % MENU_LABELS.length; this.refreshMenu(); }
    else if (this.fsm === 'skillMenu') { this.skillIdx = (this.skillIdx + 1) % this.skillRowCount; this.refreshSkillMenu(); }
    else if (this.fsm === 'itemMenu') { this.itemIdx = (this.itemIdx + 1) % this.itemRowCount; this.refreshItemMenu(); }
  }
  private onConfirm(): void {
    if (this.fsm === 'menu') this.confirmMenu();
    else if (this.fsm === 'skillMenu') this.confirmSkillMenu();
    else if (this.fsm === 'itemMenu') this.confirmItemMenu();
  }
  private onCancel(): void {
    if (this.fsm === 'skillMenu') this.closeSkillMenu(true);
    else if (this.fsm === 'itemMenu') this.closeItemMenu(true);
  }
  private onBurstKey(): void { if (this.fsm === 'menu' && this.state.catalystBurstReady) void this.doBurst(); }

  private refreshMenu(): void {
    const runDisabled = this.state.enemy.isBoss;
    this.menuButtons.forEach((b, i) => {
      const disabled = i === 3 && runDisabled;
      const sel = i === this.menuIdx;
      b.setText((sel ? '▶ ' : '   ') + MENU_LABELS[i]);
      b.setColor(disabled ? '#566074' : sel ? '#ffd76a' : '#cdd6f4');
      b.setBackgroundColor(sel ? '#3a2f12' : '');
    });
  }

  private showMenu(visible: boolean): void { this.menuButtons.forEach(b => b.setVisible(visible)); }

  private confirmMenu(): void {
    if (this.fsm !== 'menu') return;
    switch (this.menuIdx) {
      case 0: void this.doAction({ kind: 'attack' }); break;
      case 1: this.openSkillMenu(); break;
      case 2: this.openItemMenu(); break;
      case 3:
        if (this.state.enemy.isBoss) { this.log("There's no escaping this battle!"); break; }
        void this.doAction({ kind: 'run' });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Skills submenu + quiz flow
  // ---------------------------------------------------------------------------

  private effectiveSkillFor(s: SkillDef): SkillDef {
    return effectiveSkill(s, this.save.skillTiers[s.id] ?? 0);
  }

  private skillRowLabel(s: SkillDef, selected: boolean): string {
    const eff = this.effectiveSkillFor(s);
    const tier = this.save.skillTiers[s.id] ?? 0;
    const pwr = scaleSkillPower(eff.power, this.state.player.level);
    const mult = effectiveness(typeChartData as TypeChart, s.affinity, this.state.enemy.affinity);
    const effTag = mult >= 2 ? '  ⚡super-effective!' : mult <= 0.5 && mult > 0 ? '  ½ resisted' : mult === 0 ? '  ✗ no effect' : '';
    const tierTag = tier > 0 ? ` ·T${tier}/${MAX_TIER}` : '';
    const noQuiz = s.topic === null ? '  (no quiz)' : '';
    return `${selected ? '▶' : '  '} ${s.name}  —  ${s.affinity}${effTag} · Pwr ${pwr} · EN ${eff.energyCost}${tierTag}${noQuiz}`;
  }

  private openSkillMenu(): void {
    if (this.fsm !== 'menu') return;
    this.fsm = 'skillMenu';
    this.showMenu(false);
    this.hideBurstButton();
    const skills = this.save.equippedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    this.skillRowCount = skills.length + 1; // + a "Back" row
    this.skillIdx = 0;
    const x = 700, y = 290, rowH = 48, w = W - x - 32, h = (this.skillRowCount + 2) * rowH + 24;
    const bg = this.add.rectangle(x, y - 60, w, h, 0x0d1b2a, 0.97).setOrigin(0, 0).setStrokeStyle(4, 0x415a77).setDepth(50);
    const legend = this.add.text(x + 24, y - 50, 'Pick a skill — Pwr/EN are after refines · ⚡ = ×2 vs this foe · ½ = resisted', { fontFamily: FONT, fontSize: '20px', color: '#8fa3c0' }).setOrigin(0, 0).setDepth(51);
    this.skillMenuObjs = [bg, legend];
    this.skillRowButtons = skills.map((s, i) => {
      const affordable = this.effectiveSkillFor(s).energyCost <= this.state.player.energy;
      const txt = this.add.text(x + 24, y + i * rowH, this.skillRowLabel(s, false), { fontFamily: FONT, fontSize: '28px', color: affordable ? '#cdd6f4' : '#566074' }).setOrigin(0, 0).setDepth(51);
      if (affordable) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerover', () => { this.skillIdx = i; this.refreshSkillMenu(); });
        txt.on('pointerdown', () => { this.skillIdx = i; this.confirmSkillMenu(); });
      }
      this.skillMenuObjs.push(txt);
      return txt;
    });
    const back = this.add.text(x + 24, y + skills.length * rowH, '', { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(51)
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', () => { this.skillIdx = skills.length; this.refreshSkillMenu(); });
    back.on('pointerdown', () => { this.skillIdx = skills.length; this.confirmSkillMenu(); });
    this.skillRowButtons.push(back);
    this.skillMenuObjs.push(back);
    this.refreshSkillMenu();
  }

  private refreshSkillMenu(): void {
    const skills = this.save.equippedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    skills.forEach((s, i) => {
      const affordable = this.effectiveSkillFor(s).energyCost <= this.state.player.energy;
      const sel = i === this.skillIdx;
      this.skillRowButtons[i]?.setText(this.skillRowLabel(s, sel)).setColor(!affordable ? '#566074' : sel ? '#ffd76a' : '#cdd6f4');
    });
    const backIdx = skills.length;
    this.skillRowButtons[backIdx]?.setText(`${this.skillIdx === backIdx ? '▶' : '  '} ← Back`).setColor(this.skillIdx === backIdx ? '#ffd76a' : '#cdd6f4');
  }

  private closeSkillMenu(returnToActionMenu: boolean): void {
    this.skillMenuObjs.forEach(o => o.destroy());
    this.skillMenuObjs = [];
    this.skillRowButtons = [];
    if (returnToActionMenu) { this.fsm = 'menu'; this.menuIdx = 1; this.showMenu(true); this.refreshMenu(); this.refreshBurstButton(); }
  }

  private confirmSkillMenu(): void {
    if (this.fsm !== 'skillMenu') return;
    const skills = this.save.equippedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    if (this.skillIdx >= skills.length) { this.closeSkillMenu(true); return; }
    const skill = skills[this.skillIdx]!;
    if (this.effectiveSkillFor(skill).energyCost > this.state.player.energy) { this.log('Not enough energy for that.'); return; }
    this.closeSkillMenu(false);
    void this.doSkill(skill);
  }

  private async doSkill(skill: SkillDef): Promise<void> {
    this.fsm = 'animating';
    let action: BattleAction;
    if (skill.topic === null) {
      action = { kind: 'skill', skillId: skill.id, quizCorrect: null };
    } else {
      const q = this.quiz.pickQuestion(skill.topic, skill.questionDifficulty, this.save.quizStats[skill.topic]);
      const ans = await this.quizPanel.ask(q, { studyMode: this.studyMode, answerTimer: !!this.save.settings.answerTimer });
      const correct = this.quiz.checkAnswer(q, ans);
      this.save = SaveManager.recordQuizResult(this.save, skill.topic, correct);
      this.persist();
      if (correct) {
        const bonus = 2 * skill.questionDifficulty;
        this.bonusXp += bonus;
        this.floatText(this.playerSprite.x, this.playerSprite.y - this.playerSprite.displayHeight - 24, `+${bonus} XP`, '#a6e3a1', '28px');
      }
      await this.quizPanel.showCorrection(q, correct); // brief "✓ Correct! …" / longer "✗ The answer was …"
      this.quizPanel.hide();
      this.maybeQueueRefresher(skill.topic);
      action = { kind: 'skill', skillId: skill.id, quizCorrect: correct, fastAnswer: ans.fastAnswer };
    }
    await this.resolveAndAnimate(action);
  }

  private maybeQueueRefresher(topic: string): void {
    const stat = this.save.quizStats[topic];
    if (stat && stat.recentMisses === 3) {
      this.registry.set(REFRESHER_TOAST_KEY, 'Prof. Bohrlin: remember — the atomic number is the number of protons. Try that reaction again.');
    }
  }

  // ---------------------------------------------------------------------------
  // Items submenu
  // ---------------------------------------------------------------------------

  private usableItems(): { itemId: string; qty: number }[] {
    return this.save.items.filter(e => e.qty > 0 && this.content.items[e.itemId]?.usableInBattle);
  }

  private openItemMenu(): void {
    if (this.fsm !== 'menu') return;
    const items = this.usableItems();
    this.fsm = 'itemMenu';
    this.showMenu(false);
    this.hideBurstButton();
    this.itemRowIds = items.map(i => i.itemId);
    this.itemRowCount = items.length + 1; // + a "Back" row
    this.itemIdx = 0;
    const x = 700, y = 280, rowH = 48, w = W - x - 32, h = (this.itemRowCount + 1) * rowH + 24;
    const bg = this.add.rectangle(x, y - 16, w, h, 0x0d1b2a, 0.97).setOrigin(0, 0).setStrokeStyle(4, 0x415a77).setDepth(50);
    this.itemMenuObjs = [bg];
    this.itemRowButtons = items.map((_entry, i) => {
      const txt = this.add.text(x + 24, y + i * rowH, '', { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(51).setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => { this.itemIdx = i; this.refreshItemMenu(); });
      txt.on('pointerdown', () => { this.itemIdx = i; this.confirmItemMenu(); });
      this.itemMenuObjs.push(txt);
      return txt;
    });
    const back = this.add.text(x + 24, y + items.length * rowH, '', { fontFamily: FONT, fontSize: '28px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(51).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => { this.itemIdx = items.length; this.refreshItemMenu(); });
    back.on('pointerdown', () => { this.itemIdx = items.length; this.confirmItemMenu(); });
    this.itemRowButtons.push(back);
    this.itemMenuObjs.push(back);
    if (items.length === 0) this.log('No usable items in your bag.');
    this.refreshItemMenu();
  }

  private refreshItemMenu(): void {
    const items = this.usableItems();
    items.forEach((entry, i) => {
      const def = this.content.items[entry.itemId];
      const sel = i === this.itemIdx;
      this.itemRowButtons[i]?.setText(`${sel ? '▷' : ' '} ${def?.name ?? entry.itemId}  ×${entry.qty}`).setColor(sel ? '#f9e2af' : '#cdd6f4');
    });
    const backIdx = items.length;
    this.itemRowButtons[backIdx]?.setText(`${this.itemIdx === backIdx ? '▷' : ' '} ← Back`).setColor(this.itemIdx === backIdx ? '#f9e2af' : '#cdd6f4');
  }

  private closeItemMenu(returnToActionMenu: boolean): void {
    this.itemMenuObjs.forEach(o => o.destroy());
    this.itemMenuObjs = []; this.itemRowButtons = []; this.itemRowIds = [];
    if (returnToActionMenu) { this.fsm = 'menu'; this.menuIdx = 2; this.showMenu(true); this.refreshMenu(); this.refreshBurstButton(); }
  }

  private confirmItemMenu(): void {
    if (this.fsm !== 'itemMenu') return;
    const itemId = this.itemRowIds[this.itemIdx];
    if (!itemId) { this.closeItemMenu(true); return; }
    this.closeItemMenu(false);
    void this.doItem(itemId);
  }

  private async doItem(itemId: string): Promise<void> {
    this.fsm = 'animating';
    // consume one from the bag (the engine uses it this turn)
    const entry = this.save.items.find(e => e.itemId === itemId);
    if (entry) { entry.qty -= 1; if (entry.qty <= 0) this.save.items = this.save.items.filter(e => e.itemId !== itemId); }
    this.persist();
    await this.resolveAndAnimate({ kind: 'item', itemId });
  }

  // ---------------------------------------------------------------------------
  // Catalyst Burst
  // ---------------------------------------------------------------------------

  private async doBurst(): Promise<void> {
    if (this.fsm !== 'menu' || !this.state.catalystBurstReady) return;
    this.fsm = 'animating';
    this.showMenu(false);
    this.hideBurstButton();
    this.log('CATALYST BURST!');
    await this.burstFlash();
    await this.resolveAndAnimate({ kind: 'catalystBurst' });
  }

  private burstFlash(): Promise<void> {
    const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0, 0).setDepth(2000);
    this.cameras.main.zoomTo(1.08, 180, 'Sine.easeInOut', true);
    return new Promise<void>(resolve => {
      this.tweens.add({
        targets: flash, alpha: { from: 0, to: 0.85 }, duration: 150, yoyo: true,
        onComplete: () => { flash.destroy(); this.cameras.main.zoomTo(1, 180, 'Sine.easeInOut', true); this.time.delayedCall(180, () => resolve()); },
      });
    });
  }

  private refreshBurstButton(): void {
    if (this.fsm !== 'menu' || !this.state.catalystBurstReady) { this.hideBurstButton(); return; }
    if (!this.burstButton) {
      this.burstButton = this.add.text(W / 2, 760, '★ CATALYST BURST  [B] ★', { fontFamily: FONT, fontSize: '40px', color: '#ffd166', backgroundColor: '#5a1320', padding: { x: 24, y: 12 } })
        .setOrigin(0.5).setDepth(800).setInteractive({ useHandCursor: true });
      this.burstButton.on('pointerdown', () => { void this.doBurst(); });
    }
    this.burstButton.setVisible(true);
    if (!this.burstTween) this.burstTween = this.tweens.add({ targets: this.burstButton, scaleX: 1.12, scaleY: 1.12, yoyo: true, repeat: -1, duration: 320 });
  }

  private hideBurstButton(): void {
    this.burstTween?.remove();
    this.burstTween = null;
    this.burstButton?.setScale(1).setVisible(false);
  }

  // ---------------------------------------------------------------------------
  // Status-effect icons
  // ---------------------------------------------------------------------------

  private refreshStatusIcons(): void {
    this.playerStatusObjs.forEach(o => o.destroy()); this.playerStatusObjs = [];
    this.enemyStatusObjs.forEach(o => o.destroy()); this.enemyStatusObjs = [];
    this.layStatuses(this.state.enemy.statuses, 32, 132, this.enemyStatusObjs);
    this.layStatuses(this.state.player.statuses, 820, 832, this.playerStatusObjs);
  }

  private layStatuses(statuses: StatusEffectInstance[], x0: number, y0: number, sink: Phaser.GameObjects.GameObject[]): void {
    let x = x0;
    for (const s of statuses) {
      const icon = this.add.image(x, y0, `icon_status_${s.id}`).setOrigin(0, 0).setDisplaySize(40, 40).setDepth(20);
      const num = this.add.text(x + 44, y0, String(Math.max(0, s.turnsRemaining)), { fontFamily: FONT, fontSize: '24px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(20);
      this.tweens.add({ targets: icon, scaleX: 1.25, scaleY: 1.25, yoyo: true, duration: 110 });
      sink.push(icon, num);
      x += 44 + 16;
    }
  }

  // ---------------------------------------------------------------------------
  // Turn resolution + animation
  // ---------------------------------------------------------------------------

  private async doAction(action: BattleAction): Promise<void> {
    if (this.fsm !== 'menu') return;
    this.fsm = 'animating';
    this.showMenu(false);
    this.hideBurstButton();
    await this.resolveAndAnimate(action);
  }

  private async resolveAndAnimate(action: BattleAction): Promise<void> {
    const before = this.state;
    this.log(`» You ${this.describeAction(action)}…`); // make it unambiguous which side the next event belongs to
    const { state: next, events } = resolveTurn(before, action, this.ctx);
    this.dispPlayerHp = before.player.hp;
    this.dispEnemyHp = before.enemy.hp;
    this.dispEnemyMaxHp = before.enemy.maxHp;
    this.state = next;
    await this.animate(events);
    this.snapBars();
    if (this.state.outcome === 'ongoing') {
      this.showMenu(true); this.fsm = 'menu'; this.menuIdx = 0; this.refreshMenu(); this.refreshBurstButton();
    } else this.runEndSequence();
  }

  private async animate(events: BattleEvent[]): Promise<void> {
    let currentAffinity: Affinity = 'Neutral';
    let currentSide: 'player' | 'enemy' = 'player';
    let currentIsBurst = false;
    let currentSkillId: string | undefined;
    for (const ev of events) {
      if (ev.t === 'outcome') return; // the end sequence takes over
      if (ev.t === 'attack') {
        currentAffinity = ev.affinity;
        currentSide = ev.side;
        currentSkillId = ev.skillId;
        currentIsBurst = !!currentSkillId && (this.content.skills[currentSkillId]?.isCatalystBurst ?? false);
      }
      this.applyEvent(ev, currentAffinity, currentSide, currentIsBurst);
      await this.wait(this.delayFor(ev));
    }
  }

  private applyEvent(ev: BattleEvent, currentAffinity: Affinity = 'Neutral', _currentSide: 'player' | 'enemy' = 'player', currentIsBurst = false): void {
    switch (ev.t) {
      case 'turnStart':
        break;
      case 'energyRegen':
        // bar is snapped at the end of the turn; just acknowledge
        break;
      case 'attack': {
        // The player's action was already announced in resolveAndAnimate(); only narrate the enemy's.
        if (ev.side === 'enemy') {
          const skillName = ev.skillId ? this.content.skills[ev.skillId]?.name : undefined;
          this.log(skillName ? `${this.state.enemy.name} uses ${skillName}!` : `${this.state.enemy.name} attacks!`);
        }
        break;
      }
      case 'quizFizzle':
        this.log('Wrong answer — the reaction fizzles to ~30% power.');
        break;
      case 'damage': {
        const onPlayer = ev.target === 'player';
        const sprite = onPlayer ? this.playerSprite : this.enemySprite;
        this.flashSprite(sprite);
        this.cameras.main.shake(110, onPlayer ? 0.006 : 0.004);
        const fxTarget = onPlayer ? this.playerSprite : this.enemySprite;
        playSkillFx(this, fxTarget, currentAffinity, {
          superEffective: ev.effectiveness >= 2,
          crit: ev.crit,
          isBurst: currentIsBurst,
        });
        if (ev.effectiveness >= 2) this.cameras.main.shake(180, 0.012);
        if (onPlayer) { this.dispPlayerHp = Math.max(0, this.dispPlayerHp - ev.amount); this.playerHpBar.setValue(this.dispPlayerHp, this.state.player.maxHp); }
        else { this.dispEnemyHp = Math.max(0, this.dispEnemyHp - ev.amount); this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp); }
        const color = ev.effectiveness >= 2 ? '#ff6b6b' : ev.effectiveness <= 0.5 ? '#9aa0a8' : '#ffffff';
        this.floatText(sprite.x, sprite.y - sprite.displayHeight / 2, `-${ev.amount}`, color);
        if (ev.crit) this.floatText(sprite.x, sprite.y - sprite.displayHeight, '★ Critical Reaction!', '#f9e2af', '24px');
        const effFlavor = ev.effectiveness >= 2 ? '  — super effective!' : (ev.effectiveness > 0 && ev.effectiveness <= 0.5) ? '  — not very effective…' : '';
        const critFlavor = ev.crit ? '  ★ critical!' : '';
        this.log((onPlayer ? `You take ${ev.amount} damage` : `You hit for ${ev.amount}`) + effFlavor + critFlavor);
        break;
      }
      case 'heal': {
        const onPlayer = ev.target === 'player';
        const sprite = onPlayer ? this.playerSprite : this.enemySprite;
        this.flashSprite(sprite, 0x52b788);
        if (onPlayer) { this.dispPlayerHp = Math.min(this.state.player.maxHp, this.dispPlayerHp + ev.amount); this.playerHpBar.setValue(this.dispPlayerHp, this.state.player.maxHp); }
        else { this.dispEnemyHp = Math.min(this.dispEnemyMaxHp, this.dispEnemyHp + ev.amount); this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp); }
        this.floatText(sprite.x, sprite.y - sprite.displayHeight / 2, `+${ev.amount}`, '#a6e3a1');
        this.log(onPlayer ? `You recover ${ev.amount} HP` : `${this.state.enemy.name} recovers ${ev.amount} HP`);
        break;
      }
      case 'statusApplied':
        this.log(`${this.nameOf(ev.target)} is ${ev.id}!`);
        break;
      case 'statusTick': {
        if (ev.damage) {
          const onPlayer = ev.target === 'player';
          if (onPlayer) { this.dispPlayerHp = Math.max(0, this.dispPlayerHp - ev.damage); this.playerHpBar.setValue(this.dispPlayerHp, this.state.player.maxHp); }
          else { this.dispEnemyHp = Math.max(0, this.dispEnemyHp - ev.damage); this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp); }
          this.log(`${this.nameOf(ev.target)} takes ${ev.damage} from ${ev.id}.`);
        }
        break;
      }
      case 'statusExpired':
        this.log(`${ev.id} wore off ${this.nameOf(ev.target) === this.state.player.name ? '' : 'the '}${this.nameOf(ev.target)}.`);
        break;
      case 'buffsStripped':
        this.log('Buffs precipitated out!');
        break;
      case 'extraAction':
        this.log('Catalysed — extra action!');
        break;
      case 'precipitatedSkip':
        this.log(`${ev.side === 'player' ? this.state.player.name : this.state.enemy.name} is precipitated and can't move!`);
        break;
      case 'chainChanged':
        if (!this.studyMode) this.chainMeter.setChain(ev.chain);
        break;
      case 'enemySwitch': {
        const def = this.content.enemies[ev.toEnemyId];
        this.setEnemyVisuals(ev.toEnemyId);
        this.dispEnemyHp = def?.baseStats.hp ?? this.state.enemy.maxHp;
        this.dispEnemyMaxHp = this.dispEnemyHp;
        this.refreshEnemyName();
        this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp, false);
        this.log(`${ev.toName} appears!`);
        break;
      }
      case 'item': {
        const itemName = this.content.items[ev.itemId]?.name ?? ev.itemId;
        this.log(`${this.nameOf(ev.target)} uses ${itemName}.`);
        break;
      }
      case 'faint': {
        const sprite = ev.side === 'player' ? this.playerSprite : this.enemySprite;
        this.tweens.add({ targets: sprite, alpha: 0.15, duration: 400 });
        this.log(`${ev.side === 'player' ? this.state.player.name : this.state.enemy.name} can't continue!`);
        break;
      }
      case 'fleeFailed':
        this.log("Couldn't get away!");
        break;
      case 'outcome':
        break;
    }
  }

  private delayFor(ev: BattleEvent): number {
    switch (ev.t) {
      case 'turnStart': return 60;
      case 'energyRegen': return 80;
      case 'attack': return 280;
      case 'quizFizzle': return 650;
      case 'damage': return 520;
      case 'heal': return 520;
      case 'statusApplied': return 520;
      case 'statusTick': return ev.damage ? 460 : 0;
      case 'statusExpired': return 360;
      case 'buffsStripped': return 460;
      case 'extraAction': return 360;
      case 'precipitatedSkip': return 560;
      case 'chainChanged': return 240;
      case 'enemySwitch': return 640;
      case 'item': return 360;
      case 'faint': return 720;
      case 'fleeFailed': return 560;
      case 'outcome': return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // End sequence (Task 45: the basics — Task 48 fills in the victory rewards)
  // ---------------------------------------------------------------------------

  private runEndSequence(): void {
    this.fsm = 'ended';
    this.hideBurstButton();
    const outcome = this.state.outcome;
    if (outcome === 'fled') {
      this.log('Got away safely!');
      this.time.delayedCall(900, () => { this.persistVitals(); this.returnHome(); });
      return;
    }
    if (outcome === 'playerLose') {
      this.log('Equilibrium collapses around you…');
      this.time.delayedCall(1200, () => {
        this.save.currentHp = 1;
        this.save.currentEnergy = Math.max(this.save.currentEnergy, 50);
        this.save.playerTile = { regionId: '', x: 0, y: 0 }; // invalidate → OverworldScene re-spawns at the map's spawn point
        this.persist();
        this.scene.start('OverworldScene', { regionId: this.params.regionId });
      });
      return;
    }
    // playerWin
    void this.runVictory();
  }

  private async runVictory(): Promise<void> {
    this.log(`${this.state.enemy.name} is stabilised!`);
    await this.wait(900);

    // carry the battle's HP/energy onto the save before the bookkeeping
    this.save.currentHp = Math.max(1, this.state.player.hp);
    this.save.currentEnergy = this.state.player.energy;

    const enemyDef = this.content.enemies[this.params.enemyId];
    const region = this.content.regions.find(r => r.id === this.params.regionId) ?? this.content.regions[0];
    let evolved = null as ReturnType<typeof applyVictory>['evolved'];
    let banners: string[] = [];
    if (enemyDef && region) {
      const result = applyVictory(this.save, enemyDef, region, this.bonusXp, this.content);
      this.save = result.save;
      banners = result.banners;
      evolved = result.evolved;
    }
    this.registry.set('save', this.save);
    this.persist();

    for (let i = 0; i < banners.length; i++) {
      if (evolved && i === banners.length - 1) {
        await this.burstFlash();
        this.playerSprite.setTexture(this.heroBattleKey());
        this.playerLabel?.destroy();
        this.playerLabel = addPlaceholderLabel(this, PLAYER_X, PLAYER_GROUND_Y - this.playerSprite.displayHeight / 2, this.heroBattleKey(), this.content.assets);
        this.playerLabel?.setDepth(11);
      }
      await this.showBanner(banners[i] ?? '');
    }

    if (enemyDef?.role === 'finalBoss') this.scene.start('EndingScene');
    else if (enemyDef?.role === 'regionBoss') this.scene.start('WorldMapScene');
    else this.returnHome();
  }

  private showBanner(text: string, holdMs = 900): Promise<void> {
    const t = this.add.text(W / 2, 384, text, { fontFamily: FONT, fontSize: '44px', color: '#f9e2af', backgroundColor: '#0b0f17cc', padding: { x: 32, y: 16 }, align: 'center', wordWrap: { width: W - 160 } })
      .setOrigin(0.5).setDepth(1200).setScale(0.6);
    return new Promise<void>(resolve => {
      this.tweens.add({
        targets: t, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut',
        onComplete: () => this.time.delayedCall(holdMs, () => {
          this.tweens.add({ targets: t, alpha: 0, duration: 220, onComplete: () => { t.destroy(); resolve(); } });
        }),
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => { this.time.delayedCall(ms, () => resolve()); });
  }

  private log(line: string): void { this.logLine.setText(line); }

  private describeAction(action: BattleAction): string {
    switch (action.kind) {
      case 'attack': return 'strike';
      case 'skill': return `use ${this.content.skills[action.skillId]?.name ?? action.skillId}`;
      case 'item': return `use ${this.content.items[action.itemId]?.name ?? action.itemId}`;
      case 'catalystBurst': return 'unleash a Catalyst Burst';
      case 'run': return 'try to flee';
    }
  }

  private nameOf(side: 'player' | 'enemy'): string { return side === 'player' ? this.state.player.name : this.state.enemy.name; }

  private heroBattleKey(): string {
    const stage = Math.max(0, Math.min(1, this.save.evolutionStage));
    return `hero_${this.save.classId}_${stage}_battle`;
  }

  private setEnemyVisuals(enemyId: string): void {
    const def = this.content.enemies[enemyId];
    const key = def?.spriteKey ?? 'enemy_protium';
    this.enemySprite?.destroy();
    this.enemyLabel?.destroy();
    this.enemySprite = this.add.image(ENEMY_X, ENEMY_GROUND_Y, key).setOrigin(0.5, 1).setDepth(10);
    this.enemyLabel = addPlaceholderLabel(this, ENEMY_X, ENEMY_GROUND_Y - this.enemySprite.displayHeight / 2, key, this.content.assets);
    this.enemyLabel?.setDepth(11);
  }

  private refreshEnemyName(): void {
    this.enemyNameText.setText(`${this.state.enemy.name}  Lv.${this.state.enemy.level}`);
  }

  private flashSprite(sprite: Phaser.GameObjects.Image, tint = 0xffffff): void {
    sprite.setTintFill(tint);
    this.time.delayedCall(90, () => sprite.clearTint());
  }

  private floatText(x: number, y: number, text: string, color: string, size = '48px'): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: size, color, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: t, y: y - 104, alpha: 0, duration: 650, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  private snapBars(): void {
    this.playerHpBar.setValue(this.state.player.hp, this.state.player.maxHp);
    this.playerEnergyBar.setValue(this.state.player.energy, this.state.player.maxEnergy);
    this.enemyHpBar.setValue(this.state.enemy.hp, this.state.enemy.maxHp);
    if (!this.studyMode) this.chainMeter.setChain(this.state.chain);
    this.refreshEnemyName();
    this.refreshStatusIcons();
  }

  private persistVitals(): void {
    this.save.currentHp = Math.max(1, this.state.player.hp);
    this.save.currentEnergy = this.state.player.energy;
    this.persist();
  }

  private persist(): void {
    this.registry.set('save', this.save);
    savePersist();
  }

  private returnHome(): void {
    const returnTo = this.params.returnTo ?? 'OverworldScene';
    const returnData = this.params.returnData ?? { regionId: this.params.regionId };
    this.scene.start(returnTo, returnData);
  }
}
