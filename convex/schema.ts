import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const imageAsset = v.union(
  v.object({ provider: v.literal("convex"), storageId: v.id("_storage") }),
  v.object({ provider: v.literal("external"), url: v.string() }),
);

export default defineSchema({
  photoRotations: defineTable({
    key: v.string(),
    startDate: v.string(),
    photographIds: v.array(v.id("photographs")),
  }).index("by_key", ["key"]),
  photographs: defineTable({
    image: imageAsset,
    correctMinutes: v.number(),
    challengeDate: v.string(),
    capturedDate: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    alt: v.optional(v.object({ pt: v.string(), en: v.string() })),
    objectPosition: v.optional(v.string()),
    credit: v.optional(v.string()),
    creditUrl: v.optional(v.string()),
  }).index("by_date", ["challengeDate"]),
  // Anonymous, per-browser receipts make retries and concurrent tabs idempotent.
  // No accounts, personal data, or public access to other receipts.
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
