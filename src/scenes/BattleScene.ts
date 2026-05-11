import Phaser from 'phaser';
import type { GameContent, SaveData, SkillDef } from '../content/types';
import type { BattleState, BattleEvent, BattleAction, BattleContext } from '../systems/BattleEngine';
import { createBattle, resolveTurn } from '../systems/BattleEngine';
import { playerBattleInputFromSave, battleContextFromContent, REFRESHER_TOAST_KEY } from './battlePresenter';
import { HealthBar } from '../ui/HealthBar';
import { EnergyBar } from '../ui/EnergyBar';
import { ChainMeter } from '../ui/ChainMeter';
import { QuizPanel } from '../ui/QuizPanel';
import { addPlaceholderLabel } from '../ui/placeholderTextures';
import { SaveManager } from '../systems/SaveManager';
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

const W = 480, H = 320;
const FONT = 'monospace';
const ENEMY_X = 360, ENEMY_GROUND_Y = 150;
const PLAYER_X = 110, PLAYER_GROUND_Y = 222;
const MENU_LABELS = ['Attack', 'Skills', 'Items', 'Run'] as const;

type Fsm = 'menu' | 'skillMenu' | 'animating' | 'ended';

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
    this.skillMenuObjs = [];
    this.skillRowButtons = [];

    // --- engine state ---
    this.ctx = battleContextFromContent(this.content, save.settings);
    this.state = createBattle(
      playerBattleInputFromSave(save, this.content),
      { def: enemyDef, level: this.params.level ?? enemyDef.level },
      { rng: Math.random },
    );

    // --- background ---
    this.cameras.main.setBackgroundColor('#0b0f17');
    this.add.image(W / 2, 118, bgKey).setDisplaySize(W, 236).setDepth(-100);
    this.add.rectangle(0, 236, W, H - 236, 0x0b1320).setOrigin(0, 0).setStrokeStyle(1, 0x415a77).setDepth(-50);

    // --- sprites ---
    this.playerSprite = this.add.image(PLAYER_X, PLAYER_GROUND_Y, this.heroBattleKey()).setOrigin(0.5, 1).setDepth(10);
    addPlaceholderLabel(this, PLAYER_X, PLAYER_GROUND_Y - this.playerSprite.displayHeight / 2, this.heroBattleKey(), this.content.assets)?.setDepth(11);
    this.setEnemyVisuals(enemyDef.id);

    // --- enemy panel (top) ---
    this.enemyNameText = this.add.text(8, 8, '', { fontFamily: FONT, fontSize: '9px', color: '#cdd6f4' }).setOrigin(0, 0);
    this.enemyHpBar = new HealthBar(this, 8, 22, 180, 'HP');
    this.refreshEnemyName();
    this.enemyHpBar.setValue(this.state.enemy.hp, this.state.enemy.maxHp, false);

    // --- player panel (bottom-left) ---
    this.add.text(8, 244, `${this.state.player.name}  Lv.${this.state.player.level}`, { fontFamily: FONT, fontSize: '9px', color: '#cdd6f4' });
    this.playerHpBar = new HealthBar(this, 8, 258, 180, 'HP');
    this.playerEnergyBar = new EnergyBar(this, 8, 270, 180, 'EN');
    this.playerHpBar.setValue(this.state.player.hp, this.state.player.maxHp, false);
    this.playerEnergyBar.setValue(this.state.player.energy, this.state.player.maxEnergy, false);
    this.chainMeter = new ChainMeter(this, 8, 290);
    this.chainMeter.setVisible(!this.studyMode);
    if (this.studyMode) this.add.text(8, 286, '(Study Mode — chain off)', { fontFamily: FONT, fontSize: '7px', color: '#89dceb' });

    // --- battle log line ---
    this.logLine = this.add.text(8, 304, '', { fontFamily: FONT, fontSize: '8px', color: '#f9e2af', wordWrap: { width: W - 200 } }).setOrigin(0, 0);

    // --- quiz panel (hidden until a quizzed skill fires) ---
    this.quizPanel = new QuizPanel(this, 20, 34, W - 40, 176);
    this.quizPanel.setDepth(1000);

    // --- action menu (bottom-right) ---
    this.menuButtons = MENU_LABELS.map((label, i) => {
      const t = this.add.text(W - 110, 246 + i * 16, label, { fontFamily: FONT, fontSize: '10px', color: '#cdd6f4' }).setOrigin(0, 0);
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
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown-UP', this.onUp, this);
        kb.off('keydown-DOWN', this.onDown, this);
        kb.off('keydown-ENTER', this.onConfirm, this);
        kb.off('keydown-SPACE', this.onConfirm, this);
        kb.off('keydown-ESC', this.onCancel, this);
      });
    }

    this.log(`A wild ${this.state.enemy.name} appears!`);
    this.fsm = 'menu';
    this.menuIdx = 0;
    this.refreshMenu();
  }

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------

  private onUp(): void {
    if (this.fsm === 'menu') { this.menuIdx = (this.menuIdx + MENU_LABELS.length - 1) % MENU_LABELS.length; this.refreshMenu(); }
    else if (this.fsm === 'skillMenu') { this.skillIdx = (this.skillIdx + this.skillRowCount - 1) % this.skillRowCount; this.refreshSkillMenu(); }
  }
  private onDown(): void {
    if (this.fsm === 'menu') { this.menuIdx = (this.menuIdx + 1) % MENU_LABELS.length; this.refreshMenu(); }
    else if (this.fsm === 'skillMenu') { this.skillIdx = (this.skillIdx + 1) % this.skillRowCount; this.refreshSkillMenu(); }
  }
  private onConfirm(): void {
    if (this.fsm === 'menu') this.confirmMenu();
    else if (this.fsm === 'skillMenu') this.confirmSkillMenu();
  }
  private onCancel(): void {
    if (this.fsm === 'skillMenu') this.closeSkillMenu(true);
  }

  private refreshMenu(): void {
    const runDisabled = this.state.enemy.isBoss;
    this.menuButtons.forEach((b, i) => {
      const disabled = i === 3 && runDisabled;
      const sel = i === this.menuIdx;
      b.setText((sel ? '▷ ' : '  ') + MENU_LABELS[i]);
      b.setColor(disabled ? '#566074' : sel ? '#f9e2af' : '#cdd6f4');
    });
  }

  private showMenu(visible: boolean): void { this.menuButtons.forEach(b => b.setVisible(visible)); }

  private confirmMenu(): void {
    if (this.fsm !== 'menu') return;
    switch (this.menuIdx) {
      case 0: void this.doAction({ kind: 'attack' }); break;
      case 1: this.openSkillMenu(); break;
      case 2: this.log('Items — available in a later build.'); break;        // TODO: Task 47
      case 3:
        if (this.state.enemy.isBoss) { this.log("There's no escaping this battle!"); break; }
        void this.doAction({ kind: 'run' });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Skills submenu + quiz flow
  // ---------------------------------------------------------------------------

  private openSkillMenu(): void {
    if (this.fsm !== 'menu') return;
    this.fsm = 'skillMenu';
    this.showMenu(false);
    const skills = this.save.equippedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    this.skillRowCount = skills.length + 1; // + a "Back" row
    this.skillIdx = 0;
    const x = 150, y = 240, rowH = 12, w = W - x - 8, h = (this.skillRowCount + 1) * rowH + 6;
    const bg = this.add.rectangle(x, y - 4, w, h, 0x0d1b2a, 0.97).setOrigin(0, 0).setStrokeStyle(1, 0x415a77).setDepth(50);
    this.skillMenuObjs = [bg];
    this.skillRowButtons = skills.map((s, i) => {
      const affordable = s.energyCost <= this.state.player.energy;
      const txt = this.add.text(x + 6, y + i * rowH, '', { fontFamily: FONT, fontSize: '8px', color: affordable ? '#cdd6f4' : '#566074' }).setOrigin(0, 0).setDepth(51);
      if (affordable) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerover', () => { this.skillIdx = i; this.refreshSkillMenu(); });
        txt.on('pointerdown', () => { this.skillIdx = i; this.confirmSkillMenu(); });
      }
      this.skillMenuObjs.push(txt);
      return txt;
    });
    const back = this.add.text(x + 6, y + skills.length * rowH, '', { fontFamily: FONT, fontSize: '8px', color: '#cdd6f4' }).setOrigin(0, 0).setDepth(51)
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
      const affordable = s.energyCost <= this.state.player.energy;
      const sel = i === this.skillIdx;
      const tag = s.topic === null ? ' ·basic' : '';
      this.skillRowButtons[i]?.setText(`${sel ? '▷' : ' '} ${s.name}  [${s.affinity}] P${s.power} E${s.energyCost}${tag}`)
        .setColor(!affordable ? '#566074' : sel ? '#f9e2af' : '#cdd6f4');
    });
    const backIdx = skills.length;
    this.skillRowButtons[backIdx]?.setText(`${this.skillIdx === backIdx ? '▷' : ' '} ← Back`).setColor(this.skillIdx === backIdx ? '#f9e2af' : '#cdd6f4');
  }

  private closeSkillMenu(returnToActionMenu: boolean): void {
    this.skillMenuObjs.forEach(o => o.destroy());
    this.skillMenuObjs = [];
    this.skillRowButtons = [];
    if (returnToActionMenu) { this.fsm = 'menu'; this.menuIdx = 1; this.showMenu(true); this.refreshMenu(); }
  }

  private confirmSkillMenu(): void {
    if (this.fsm !== 'skillMenu') return;
    const skills = this.save.equippedSkillIds.map(id => this.content.skills[id]).filter((s): s is SkillDef => !!s);
    if (this.skillIdx >= skills.length) { this.closeSkillMenu(true); return; }
    const skill = skills[this.skillIdx]!;
    if (skill.energyCost > this.state.player.energy) { this.log('Not enough energy for that.'); return; }
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
        this.floatText(this.playerSprite.x, this.playerSprite.y - this.playerSprite.displayHeight - 6, `Reaction mastered!  +${bonus} XP`, '#a6e3a1', '8px');
      } else {
        await this.quizPanel.showCorrection(q);
      }
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
  // Turn resolution + animation
  // ---------------------------------------------------------------------------

  private async doAction(action: BattleAction): Promise<void> {
    if (this.fsm !== 'menu') return;
    this.fsm = 'animating';
    this.showMenu(false);
    await this.resolveAndAnimate(action);
  }

  private async resolveAndAnimate(action: BattleAction): Promise<void> {
    const before = this.state;
    const { state: next, events } = resolveTurn(before, action, this.ctx);
    this.dispPlayerHp = before.player.hp;
    this.dispEnemyHp = before.enemy.hp;
    this.dispEnemyMaxHp = before.enemy.maxHp;
    this.state = next;
    await this.animate(events);
    this.snapBars();
    if (this.state.outcome === 'ongoing') { this.showMenu(true); this.fsm = 'menu'; this.menuIdx = 0; this.refreshMenu(); }
    else this.runEndSequence();
  }

  private async animate(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      if (ev.t === 'outcome') return; // the end sequence takes over
      this.applyEvent(ev);
      await this.wait(this.delayFor(ev));
    }
  }

  private applyEvent(ev: BattleEvent): void {
    switch (ev.t) {
      case 'turnStart':
        break;
      case 'energyRegen':
        // bar is snapped at the end of the turn; just acknowledge
        break;
      case 'attack': {
        const who = ev.side === 'player' ? this.state.player.name : this.state.enemy.name;
        const skillName = ev.skillId ? this.content.skills[ev.skillId]?.name : undefined;
        this.log(skillName ? `${who} uses ${skillName}!` : `${who} attacks!`);
        break;
      }
      case 'quizFizzle':
        this.log('The reaction fizzles to a fraction of its power.');
        break;
      case 'damage': {
        const onPlayer = ev.target === 'player';
        const sprite = onPlayer ? this.playerSprite : this.enemySprite;
        this.flashSprite(sprite);
        this.cameras.main.shake(110, onPlayer ? 0.006 : 0.004);
        if (onPlayer) { this.dispPlayerHp = Math.max(0, this.dispPlayerHp - ev.amount); this.playerHpBar.setValue(this.dispPlayerHp, this.state.player.maxHp); }
        else { this.dispEnemyHp = Math.max(0, this.dispEnemyHp - ev.amount); this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp); }
        const color = ev.effectiveness >= 2 ? '#ff6b6b' : ev.effectiveness <= 0.5 ? '#9aa0a8' : '#ffffff';
        this.floatText(sprite.x, sprite.y - sprite.displayHeight / 2, `-${ev.amount}`, color);
        if (ev.crit) this.floatText(sprite.x, sprite.y - sprite.displayHeight, '★ Critical Reaction!', '#f9e2af', '7px');
        if (ev.effectiveness >= 2) this.log("It's a runaway reaction!");
        else if (ev.effectiveness <= 0.5 && ev.effectiveness > 0) this.log('It barely reacts…');
        break;
      }
      case 'heal': {
        const onPlayer = ev.target === 'player';
        const sprite = onPlayer ? this.playerSprite : this.enemySprite;
        this.flashSprite(sprite, 0x52b788);
        if (onPlayer) { this.dispPlayerHp = Math.min(this.state.player.maxHp, this.dispPlayerHp + ev.amount); this.playerHpBar.setValue(this.dispPlayerHp, this.state.player.maxHp); }
        else { this.dispEnemyHp = Math.min(this.dispEnemyMaxHp, this.dispEnemyHp + ev.amount); this.enemyHpBar.setValue(this.dispEnemyHp, this.dispEnemyMaxHp); }
        this.floatText(sprite.x, sprite.y - sprite.displayHeight / 2, `+${ev.amount}`, '#a6e3a1');
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
    // playerWin — Task 48 layers XP / level-ups / unlocks / evolution / boss-clear on top.
    this.log(`${this.state.enemy.name} is stabilised!`);
    this.time.delayedCall(1100, () => { this.persistVitals(); this.returnHome(); });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => { this.time.delayedCall(ms, () => resolve()); });
  }

  private log(line: string): void { this.logLine.setText(line); }

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

  private floatText(x: number, y: number, text: string, color: string, size = '13px'): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: size, color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 650, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  private snapBars(): void {
    this.playerHpBar.setValue(this.state.player.hp, this.state.player.maxHp);
    this.playerEnergyBar.setValue(this.state.player.energy, this.state.player.maxEnergy);
    this.enemyHpBar.setValue(this.state.enemy.hp, this.state.enemy.maxHp);
    if (!this.studyMode) this.chainMeter.setChain(this.state.chain);
    this.refreshEnemyName();
  }

  private persistVitals(): void {
    this.save.currentHp = Math.max(1, this.state.player.hp);
    this.save.currentEnergy = this.state.player.energy;
    this.persist();
  }

  private persist(): void {
    this.registry.set('save', this.save);
    try { SaveManager.save(this.save, window.localStorage); } catch { /* ignore — playtest builds */ }
  }

  private returnHome(): void {
    const returnTo = this.params.returnTo ?? 'OverworldScene';
    const returnData = this.params.returnData ?? { regionId: this.params.regionId };
    this.scene.start(returnTo, returnData);
  }
}
