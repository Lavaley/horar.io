import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { brasiliaDay, nextRelease } from "../lib/daily";
import { imageUrl } from "./images";
import { photographForDate } from "./rotation";
import { scoreGuess } from "./scoring";
import { dailyRanking, placement, rankingValidator } from "./ranking";
import type { MutationCtx } from "./_generated/server";

const receiptValidator = v.object({
  date: v.string(), photographId: v.id("photographs"),
  chosenMinutes: v.number(), correctMinutes: v.number(),
  difference: v.number(), score: v.number(),
  ranking: rankingValidator,
});

function checkToken(token: string) {
  if (!/^[a-f0-9-]{36}$/i.test(token)) throw new ConvexError("INVALID_PLAYER");
}

async function receipt(ctx: MutationCtx, guess: Doc<"guesses">) {
  return {
    date: guess.date,
    photographId: guess.photographId,
    chosenMinutes: guess.chosenMinutes,
    correctMinutes: guess.correctMinutes,
    difference: guess.difference,
    score: guess.score,
    ranking: await placement(ctx, guess),
  };
}

// A mutation intentionally avoids query caching of Date.now(). The date is always
// authoritative on the server, including just after Brasília midnight.
export const current = mutation({
  args: {},
  returns: v.object({
    date: v.string(), serverNow: v.number(), nextReleaseAt: v.number(),
    photo: v.union(v.null(), v.object({
      id: v.id("photographs"), image: v.string(),
      alt: v.union(v.null(), v.object({ pt: v.string(), en: v.string() })),
      objectPosition: v.string(), credit: v.union(v.null(), v.string()),
      creditUrl: v.union(v.null(), v.string()),
    })),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const date = brasiliaDay(now);
    const photo = await photographForDate(ctx, date);
    const image = photo ? await imageUrl(ctx, photo.image) : null;
    return {
      date, serverNow: now, nextReleaseAt: nextRelease(now),
      // Explicit projection: never serialize the private photograph document.
      photo: photo && image ? {
        id: photo._id, image, alt: photo.alt ?? null,
        objectPosition: photo.objectPosition ?? "center",
        credit: photo.credit ?? null, creditUrl: photo.creditUrl ?? null,
      } : null,
    };
  },
});

export const result = mutation({
  args: { playerToken: v.string(), date: v.string() },
  returns: v.union(v.null(), receiptValidator),
  handler: async (ctx, args) => {
    checkToken(args.playerToken);
    const guess = await ctx.db.query("guesses").withIndex("by_player_date", q => q.eq("playerToken", args.playerToken).eq("date", args.date)).unique();
    return guess ? receipt(ctx, guess) : null;
  },
});

export const submit = mutation({
  args: { playerToken: v.string(), date: v.string(), photographId: v.id("photographs"), chosenMinutes: v.number() },
  returns: receiptValidator,
  handler: async (ctx, args) => {
    checkToken(args.playerToken);
    if (!Number.isInteger(args.chosenMinutes) || args.chosenMinutes < 0 || args.chosenMinutes >= 1440) {
      throw new ConvexError("INVALID_TIME");
    }
    // Return the first receipt on retries, even if the response was lost at midnight.
    const existing = await ctx.db.query("guesses").withIndex("by_player_date", q => q.eq("playerToken", args.playerToken).eq("date", args.date)).unique();
    if (existing) return receipt(ctx, existing);
    if (args.date !== brasiliaDay(Date.now())) throw new ConvexError("DAY_CHANGED");
    const photo = await photographForDate(ctx, args.date);
    if (!photo || photo._id !== args.photographId) throw new ConvexError("CHALLENGE_CHANGED");
    const result = {
      date: args.date, photographId: photo._id, chosenMinutes: args.chosenMinutes,
      correctMinutes: photo.correctMinutes, ...scoreGuess(args.chosenMinutes, photo.correctMinutes),
    };
    const id = await ctx.db.insert("guesses", { ...result, playerToken: args.playerToken });
    const guess = (await ctx.db.get(id))!;
    await dailyRanking.insertIfDoesNotExist(ctx, guess);
    return receipt(ctx, guess);
  },
});
