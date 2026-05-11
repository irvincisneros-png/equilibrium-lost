/** Pure scoring for a Challenge Shrine run: pass when `correct / total >= passRatio`. Phaser-free → unit-tested. */
export function scoreGauntlet(answers: boolean[], passRatio: number): { correct: number; total: number; passed: boolean } {
  const total = answers.length;
  const correct = answers.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct / total >= passRatio };
}
