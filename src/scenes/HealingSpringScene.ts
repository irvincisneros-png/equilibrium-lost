import Phaser from 'phaser';
import type { GameContent, SaveData, RegionDef } from '../content/types';
import type { QuizEngine } from '../systems/QuizEngine';
import { QuizPanel } from '../ui/QuizPanel';
import { SaveManager } from '../systems/SaveManager';
import { persist as savePersist } from '../persist';
import { MusicManager } from '../systems/MusicManager';
import { effectiveStats } from '../systems/equipment';

interface SpringSceneData { regionId: string }

const W = 1920, H = 1080, FONT = 'monospace';

/**
 * A small quiz-gated healing point: ask 3 difficulty-1 questions on the region's topic.
 * Pass (all 3 correct) = full HP and Energy restored; fail = no penalty, come back later.
 * Always returns to OverworldScene with the same regionId.
 */
export class HealingSpringScene extends Phaser.Scene {
  private content!: GameContent;
  private save!: SaveData;
  private quiz!: QuizEngine;
  private regionId = '';
  private quizPanel!: QuizPanel;
  private progressText!: Phaser.GameObjects.Text;
  private answers: boolean[] = [];

  constructor() { super('HealingSpringScene'); }

  init(data: SpringSceneData): void { this.regionId = data?.regionId ?? ''; }

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

    MusicManager.play(this, 'music_shrine');

    this.cameras.main.setBackgroundColor('#070b12');
    this.add.rectangle(0, 0, W, H, 0x040d1a).setOrigin(0, 0);
    this.add.text(W / 2, 56, `Healing Spring — ${region.name}`, { fontFamily: FONT, fontSize: '44px', color: '#06d6a0' }).setOrigin(0.5);
    this.add.text(W / 2, 120, `A healing spring — answer 3 questions on ${region.shrine.questionTopic.replace(/-/g, ' ')} to refresh.`, { fontFamily: FONT, fontSize: '28px', color: '#8fa3c0' }).setOrigin(0.5);
    this.progressText = this.add.text(W / 2, 850, '', { fontFamily: FONT, fontSize: '32px', color: '#06d6a0' }).setOrigin(0.5);

    this.quizPanel = new QuizPanel(this, 80, 180, W - 160, 600);
    this.quizPanel.setDepth(100);

    void this.runGauntlet(region);
  }

  private async runGauntlet(region: RegionDef): Promise<void> {
    const count = 3;
    const topic = region.shrine.questionTopic;
    for (let i = 0; i < count; i++) {
      this.updateProgress(i, count);
      const q = this.quiz.pickQuestion(topic, 1, this.save.quizStats[topic]);
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

    const passed = this.answers.every(a => a);
    if (passed) {
      this.save.currentHp = effectiveStats(this.save, this.content.equipment ?? {}).hp;
      this.save.currentEnergy = 100;
      await this.banner('Refreshed — HP and Energy restored!', '#06d6a0');
    } else {
      await this.banner('The spring runs murky — come back when you\'ve studied.', '#f9e2af');
    }

    this.registry.set('save', this.save);
    savePersist();
    this.scene.start('OverworldScene', { regionId: region.id });
  }

  private updateProgress(done: number, total: number): void {
    const marks = this.answers.map(a => (a ? '✓' : '✗')).join('');
    const pad = '·'.repeat(Math.max(0, total - this.answers.length));
    this.progressText.setText(`Question ${Math.min(done + 1, total)} / ${total}    ${marks}${pad}`);
  }

  private wait(ms: number): Promise<void> { return new Promise(resolve => { this.time.delayedCall(ms, () => resolve()); }); }

  private banner(text: string, color: string): Promise<void> {
    const t = this.add.text(W / 2, 440, text, { fontFamily: FONT, fontSize: '36px', color, backgroundColor: '#0b0f17cc', padding: { x: 32, y: 16 }, align: 'center', wordWrap: { width: W - 160 } }).setOrigin(0.5).setDepth(200);
    return this.wait(1800).then(() => { t.destroy(); });
  }
}
