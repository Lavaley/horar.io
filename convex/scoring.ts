// Scores the shortest distance around a 24-hour clock. The exact opposite
// moment (12 hours away) is the only guess worth zero points.
export function scoreGuess(chosen: number, correct: number) {
  const direct = Math.abs(chosen - correct);
  const difference = Math.min(direct, 1440 - direct);
  const score = Math.round(1000 * (1 - difference / 720));
  return { difference, score };
}
