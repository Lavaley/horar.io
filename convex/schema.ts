import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const imageAsset = v.union(
  v.object({ provider: v.literal("convex"), storageId: v.id("_storage") }),
  v.object({ provider: v.literal("external"), url: v.string() }),
);

export default defineSchema({
  photographs: defineTable({
    image: imageAsset,
    correctMinutes: v.number(),
    challengeDate: v.string(),
    alt: v.optional(v.object({ pt: v.string(), en: v.string() })),
    objectPosition: v.optional(v.string()),
    credit: v.optional(v.string()),
    creditUrl: v.optional(v.string()),
  }).index("by_date", ["challengeDate"]),
  // Anonymous, per-browser receipts make retries and concurrent tabs idempotent.
  // No accounts, personal data, ranking, or public access to other receipts.
  guesses: defineTable({
    playerToken: v.string(),
    date: v.string(),
    photographId: v.id("photographs"),
    chosenMinutes: v.number(),
    correctMinutes: v.number(),
    difference: v.number(),
    score: v.number(),
  }).index("by_player_date", ["playerToken", "date"]),
});
