import type { QueryCtx } from "./_generated/server";
import { DAY_MS } from "../lib/daily";

// The calendar alone advances the cycle; no cron or future daily rows are needed.
export async function photographForDate(ctx: Pick<QueryCtx, "db">, date: string) {
  const rotation = await ctx.db.query("photoRotations")
    .withIndex("by_key", q => q.eq("key", "active")).unique();
  if (rotation && date >= rotation.startDate && rotation.photographIds.length) {
    const elapsed = Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${rotation.startDate}T12:00:00Z`)) / DAY_MS);
    return ctx.db.get(rotation.photographIds[elapsed % rotation.photographIds.length]);
  }
  return ctx.db.query("photographs").withIndex("by_date", q => q.eq("challengeDate", date)).unique();
}
