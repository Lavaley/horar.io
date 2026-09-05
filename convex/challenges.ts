import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { brasiliaDay, nextRelease } from "../lib/daily";
import { imageUrl } from "./images";
import { scoreGuess } from "./scoring";

const receiptValidator = v.object({
  date: v.string(), photographId: v.id("photographs"),
  chosenMinutes: v.number(), correctMinutes: v.number(),
  difference: v.number(), score: v.number(),
});

function checkToken(token: string) {
  if (!/^[a-f0-9-]{36}$/i.test(token)) throw new ConvexError("INVALID_PLAYER");
}

function receipt(guess: Doc<"guesses">) {
  return {
    date: guess.date,
    photographId: guess.photographId,
    chosenMinutes: guess.chosenMinutes,
    correctMinutes: guess.correctMinutes,
    difference: guess.difference,
    score: guess.score,
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
    const photo = await ctx.db.query("photographs").withIndex("by_date", q => q.eq("challengeDate", date)).unique();
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
    return guess ? receipt(guess) : null;
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
    if (existing) return receipt(existing);
    if (args.date !== brasiliaDay(Date.now())) throw new ConvexError("DAY_CHANGED");
    const photo = await ctx.db.get(args.photographId);
    if (!photo || photo.challengeDate !== args.date) throw new ConvexError("CHALLENGE_CHANGED");
    const result = {
      date: args.date, photographId: photo._id, chosenMinutes: args.chosenMinutes,
      correctMinutes: photo.correctMinutes, ...scoreGuess(args.chosenMinutes, photo.correctMinutes),
    };
    await ctx.db.insert("guesses", { ...result, playerToken: args.playerToken });
    return result;
  },
});
