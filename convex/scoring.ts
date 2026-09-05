// The original Horar.io formula, now executed exclusively by the backend.
export function scoreGuess(chosen: number, correct: number) {
  const direct = Math.abs(chosen - correct);
  const difference = Math.min(direct, 1440 - direct);
  const score = difference >= 120 ? 0 : Math.round(100 * (1 - difference / 120));
  return { difference, score };
}
