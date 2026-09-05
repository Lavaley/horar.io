import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

// Separate trees per challenge date: a new day starts with no participants.
export const dailyRanking = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "guesses";
}>(components.dailyRanking, {
  namespace: guess => guess.date,
  sortKey: guess => guess.score,
});

export const rankingValidator = v.object({ position: v.number(), total: v.number() });

export async function placement(ctx: MutationCtx, guess: Doc<"guesses">) {
  const [total, ahead] = await dailyRanking.countBatch(ctx, [
    { namespace: guess.date },
    { namespace: guess.date, bounds: { lower: { key: guess.score, inclusive: false } } },
  ]);
  // Competition ranking: equal scores share a place (1, 1, 3).
  return { position: ahead + 1, total };
}

// Admin-only, bounded and repeatable migration for receipts created before ranking.
// The caller advances the returned cursor until isDone, before publishing the UI.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ cursor: v.string(), isDone: v.boolean(), processed: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("guesses").paginate({ cursor: args.cursor, numItems: 100 });
    for (const guess of page.page) await dailyRanking.insertIfDoesNotExist(ctx, guess);
    return { cursor: page.continueCursor, isDone: page.isDone, processed: page.page.length };
  },
});
