// tests/systems/quizEngine.test.ts
import { describe, it, expect } from 'vitest';
import { QuizEngine } from '../../src/systems/QuizEngine';
import type { QuestionDef, TopicQuizStat } from '../../src/content/types';

const Q = (id: string, difficulty: 1 | 2 | 3): QuestionDef => ({ id, topic: 't', difficulty, format: 'mcq', prompt: id, options: ['a', 'b', 'c', 'd'], answerIndex: 0, explanation: 'e' });
const bank = { t: [Q('a1', 1), Q('a2', 1), Q('b1', 2), Q('b2', 2), Q('c1', 3), Q('c2', 3)] };

describe('QuizEngine.pickQuestion', () => {
  it('returns a question of the requested topic at (or near) the preferred difficulty', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const q = qe.pickQuestion('t', 2);
    expect(['b1', 'b2']).toContain(q.id);
  });
  it('does not repeat a question within the session until the pool is exhausted', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) seen.add(qe.pickQuestion('t', i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3).id);
    expect(seen.size).toBe(6); // all six distinct
    const seventh = qe.pickQuestion('t', 1); // pool exhausted -> reset, may repeat now
    expect(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).toContain(seventh.id);
  });
  it('adapts down to difficulty 1 when the student has missed this topic ≥2 times recently', () => {
    const qe = new QuizEngine(bank, { rng: () => 0 });
    const stat: TopicQuizStat = { topic: 't', asked: 5, correct: 1, recentMisses: 3 };
    const q = qe.pickQuestion('t', 3, stat);
    expect(q.difficulty).toBe(1);
  });
  it('widens the difficulty band when nothing unshown sits at the target', () => {
    const qe = new QuizEngine({ t: [Q('only2a', 2), Q('only2b', 2)] }, { rng: () => 0 });
    expect(qe.pickQuestion('t', 1).difficulty).toBe(2); // widened up to find one
  });
  it('throws for a topic with no questions', () => {
    expect(() => new QuizEngine({ t: [] }, { rng: () => 0 }).pickQuestion('t', 1)).toThrow();
    expect(() => new QuizEngine(bank, { rng: () => 0 }).pickQuestion('nope', 1)).toThrow();
  });
});

const eqQ: QuestionDef = { id: 'e1', topic: 't', difficulty: 3, format: 'balanceEquation', prompt: 'Balance H2 + O2 -> H2O',
  equation: { reactants: [{ formula: 'H2', coeff: 2 }, { formula: 'O2', coeff: 1 }], products: [{ formula: 'H2O', coeff: 2 }] }, explanation: '2H2 + O2 -> 2H2O' };
const mcqQ: QuestionDef = { id: 'm1', topic: 't', difficulty: 1, format: 'mcq', prompt: 'p', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'e' };
const orderQ: QuestionDef = { id: 'o1', topic: 't', difficulty: 2, format: 'orderSteps', prompt: 'Order these', steps: ['a', 'b', 'c'], explanation: 'e' };

describe('QuizEngine.checkAnswer', () => {
  const qe = new QuizEngine({ t: [mcqQ, eqQ, orderQ] }, { rng: () => 0 });
  it('mcq: only the matching index is correct', () => {
    expect(qe.checkAnswer(mcqQ, { index: 2 })).toBe(true);
    expect(qe.checkAnswer(mcqQ, { index: 0 })).toBe(false);
    expect(qe.checkAnswer(mcqQ, {})).toBe(false);
  });
  it('balanceEquation: every coefficient (reactants then products) must match', () => {
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [2, 1, 2] })).toBe(true);
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [1, 1, 2] })).toBe(false);
    expect(qe.checkAnswer(eqQ, { widgetCoeffs: [2, 1] })).toBe(false);   // wrong length
    expect(qe.checkAnswer(eqQ, { index: 0 })).toBe(false);              // wrong answer kind
  });
  it('orderSteps: the submitted order must match the stored step order', () => {
    expect(qe.checkAnswer(orderQ, { widgetOrder: [0, 1, 2] })).toBe(true);
    expect(qe.checkAnswer(orderQ, { widgetOrder: [1, 0, 2] })).toBe(false);
    expect(qe.checkAnswer(orderQ, { widgetOrder: [0, 1] })).toBe(false);
    expect(qe.checkAnswer(orderQ, { index: 0 })).toBe(false);
  });
});
