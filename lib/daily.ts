// Brasília observes UTC−03:00 year-round (no daylight saving since 2019).
export const DAY_MS = 86_400_000;
const BRASILIA_OFFSET = 3 * 60 * 60 * 1000;
export type Period = "dawn" | "morning" | "afternoon" | "night";
export type Theme = "interactive" | Period;

export function brasiliaDay(now: number) {
  return new Date(now - BRASILIA_OFFSET).toISOString().slice(0, 10);
}

export function nextRelease(now: number) {
  return Date.parse(`${brasiliaDay(now)}T03:00:00Z`) + DAY_MS;
}

export function periodAt(now: number): Period {
  const hour = new Date(now - BRASILIA_OFFSET).getUTCHours();
  return hour < 6 ? "dawn" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night";
}

export function previousDay(date: string) {
  return new Date(Date.parse(`${date}T12:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

export function streakFor(dates: string[], today: string) {
  const played = new Set(dates);
  let cursor = played.has(today) ? today : previousDay(today);
  let streak = 0;
  while (played.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

export function normalizeMinutes(minutes: number) {
  return ((minutes % 1440) + 1440) % 1440;
}

export function formatTime(minutes: number) {
  const time = normalizeMinutes(minutes);
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}
