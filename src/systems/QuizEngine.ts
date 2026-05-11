import type { QuestionDef, TopicQuizStat } from '../content/types';

export class QuizEngine {
  private shown = new Map<string, Set<string>>(); // topic -> shown question ids this session
  constructor(private bank: Record<string, QuestionDef[]>, private opts: { rng?: () => number } = {}) {}
  private rng() { return (this.opts.rng ?? Math.random)(); }
  private shownSet(topic: string) { let s = this.shown.get(topic); if (!s) { s = new Set(); this.shown.set(topic, s); } return s; }

  pickQuestion(topic: string, preferredDifficulty: number, topicStat?: TopicQuizStat): QuestionDef {
    const all = this.bank[topic];
    if (!all || all.length === 0) throw new Error(`QuizEngine: no questions for topic "${topic}"`);
    const target = (topicStat && topicStat.recentMisses >= 2) ? 1 : Math.max(1, Math.min(3, Math.round(preferredDifficulty)));
    const seen = this.shownSet(topic);
    // try the target band, then widen by ±1, ±2
    for (const widen of [0, 1, 2]) {
      const lo = Math.max(1, target - widen), hi = Math.min(3, target + widen);
      const pool = all.filter(q => q.difficulty >= lo && q.difficulty <= hi && !seen.has(q.id));
      if (pool.length) { const q = pool[Math.floor(this.rng() * pool.length)]!; seen.add(q.id); return q; }
    }
    // exhausted: reset the shown-set and pick from the whole topic at the closest difficulty
    seen.clear();
    const byCloseness = [...all].sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target));
    const bestDiff = Math.abs(byCloseness[0]!.difficulty - target);
    const pool = byCloseness.filter(q => Math.abs(q.difficulty - target) === bestDiff);
    const q = pool[Math.floor(this.rng() * pool.length)]!;
    seen.add(q.id);
    return q;
  }

  checkAnswer(q: QuestionDef, answer: { index?: number; widgetCoeffs?: number[] }): boolean {
    if (q.format === 'mcq') return typeof answer.index === 'number' && answer.index === q.answerIndex;
    if (q.format === 'balanceEquation' && q.equation) {
      const expected = [...q.equation.reactants, ...q.equation.products].map(t => t.coeff);
      const got = answer.widgetCoeffs;
      return Array.isArray(got) && got.length === expected.length && expected.every((c, i) => got[i] === c);
    }
    return false;
  }
}
