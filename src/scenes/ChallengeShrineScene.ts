import Phaser from 'phaser';
import type { GameContent, SaveData, RegionDef } from '../content/types';
import type { QuizEngine } from '../systems/QuizEngine';
import { QuizPanel } from '../ui/QuizPanel';
import { SaveManager } from '../systems/SaveManager';
import { addXp } from '../systems/Progression';
import { scoreGauntlet } from './shrineScoring';

interface ShrineSceneData { regionId: string }

const W = 480, H = 320, FONT = 'monospace';

/**
 * A monster-free quiz gauntlet: ask `shrine.questionCount` questions in sequence, then —
 * if `correct/total >= shrine.passRatio` — mark the shrine cleared and bank `rewardXp` + the
 * rare `rewardItemIds`. A miss costs nothing but a wrong answer; the shrine is always retryable.
 * Scoring lives in the pure `shrineScoring` helper.
 */
export class ChallengeShrineScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private quiz!: QuizEngine;
  private regionId = '';
  private quizPanel!: QuizPanel;
  private progressText!: Phaser.GameObjects.Text;
  private answers: boolean[] = [];

  constructor() { super('ChallengeShrineScene'); }

  init(data: ShrineSceneData): void { this.regionId = data?.regionId ?? ''; }

  create(): void {
    this.content = this.registry.get('content') as GameContent;
    const save = this.registry.get('save') as SaveData | null;
    if (!this.content || !save) { this.scene.start('TitleScene'); return; }
    this.save = save;
    this.quiz = this.registry.get('quiz') as QuizEngine;
    this.answers = [];

    const region = this.content.regions.find(r => r.id === this.regionId) ?? this.content.regions[0];
    if (!region) { this.scene.start('WorldMapScene'); return; }
    this.regionId = region.id;
    const shrine = region.shrine;
    const allowedMisses = shrine.questionCount - Math.ceil(shrine.questionCount * shrine.passRatio);

    this.cameras.main.setBackgroundColor('#070b12');
    this.add.rectangle(0, 0, W, H, 0x0a1018).setOrigin(0, 0);
    this.add.text(W / 2, 14, `Challenge Shrine — ${region.name}`, { fontFamily: FONT, fontSize: '12px', color: '#cdd6f4' }).setOrigin(0.5);
    this.add.text(W / 2, 28, `${shrine.questionCount} questions. Miss no more than ${allowedMisses}.`, { fontFamily: FONT, fontSize: '8px', color: '#8fa3c0' }).setOrigin(0.5);
    this.progressText = this.add.text(W / 2, 222, '', { fontFamily: FONT, fontSize: '9px', color: '#f9e2af' }).setOrigin(0.5);

    this.quizPanel = new QuizPanel(this, 20, 40, W - 40, 170);
    this.quizPanel.setDepth(100);

    void this.runGauntlet(region, shrine);
  }

  private async runGauntlet(region: RegionDef, shrine: RegionDef['shrine']): Promise<void> {
    const count = shrine.questionCount;
    const topic = shrine.questionTopic;
    for (let i = 0; i < count; i++) {
      this.updateProgress(i, count);
      const difficulty = 1 + Math.floor((i * 3) / count); // spread 1 → 2 → 3 across the run
      const q = this.quiz.pickQuestion(topic, difficulty, this.save.quizStats[topic]);
      const ans = await this.quizPanel.ask(q, { studyMode: this.save.settings.studyMode, answerTimer: !!this.save.settings.answerTimer });
      const correct = this.quiz.checkAnswer(q, ans);
      this.answers.push(correct);
      this.save = SaveManager.recordQuizResult(this.save, topic, correct);
      this.registry.set('save', this.save);
      if (!correct) await this.quizPanel.showCorrection(q);
    }
    this.quizPanel.hide();
    this.updateProgress(count, count);
    await this.wait(400);

    const result = scoreGauntlet(this.answers, shrine.passRatio);
    if (result.passed) {
      const rp = this.save.regionProgress[region.id];
      if (rp) rp.shrineCleared = true;
      const cls = this.content.classes.find(c => c.id === this.save.classId);
      if (cls && shrine.rewardXp > 0) {
        const r = addXp({ level: this.save.level, xp: this.save.xp, unlockedSkillIds: this.save.unlockedSkillIds }, shrine.rewardXp, cls);
        this.save.level = r.level; this.save.xp = r.xp; this.save.unlockedSkillIds = r.unlockedSkillIds;
      }
      for (const itemId of shrine.rewardItemIds) {
        const e = this.save.items.find(it => it.itemId === itemId);
        if (e) e.qty += 1; else this.save.items.push({ itemId, qty: 1 });
      }
      await this.banner(`Shrine cleared!  ${result.correct}/${result.total}.  +${shrine.rewardXp} XP and rare materials recovered.`, '#a6e3a1');
    } else {
      await this.banner(`Not quite — ${result.correct}/${result.total}.  Study and return; the Shrine will keep.`, '#f9e2af');
    }
    this.registry.set('save', this.save);
    try { SaveManager.save(this.save, window.localStorage); } catch { /* ignore — playtest builds */ }
    this.scene.start('OverworldScene', { regionId: region.id });
  }

  private updateProgress(done: number, total: number): void {
    const marks = this.answers.map(a => (a ? '✓' : '✗')).join('');
    const pad = '·'.repeat(Math.max(0, total - this.answers.length));
    this.progressText.setText(`Question ${Math.min(done + 1, total)} / ${total}    ${marks}${pad}`);
  }

  private wait(ms: number): Promise<void> { return new Promise(resolve => { this.time.delayedCall(ms, () => resolve()); }); }

  private banner(text: string, color: string): Promise<void> {
    const t = this.add.text(W / 2, 110, text, { fontFamily: FONT, fontSize: '10px', color, backgroundColor: '#0b0f17cc', padding: { x: 8, y: 4 }, align: 'center', wordWrap: { width: W - 40 } }).setOrigin(0.5).setDepth(200);
    return this.wait(1800).then(() => { t.destroy(); });
  }
}
