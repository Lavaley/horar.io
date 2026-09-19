import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { imageAsset } from "./schema";
import { brasiliaDay } from "../lib/daily";

// Internal functions are accessible only from the authenticated CLI/dashboard.
export const uploadUrl = internalMutation({ args: {}, returns: v.string(), handler: ctx => ctx.storage.generateUploadUrl() });

// Activation is atomic and only possible once all 50 stored files are ready.
export const activateRotation = internalMutation({
  args: { startDate: v.string(), photographIds: v.array(v.id("photographs")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parsed = Date.parse(`${args.startDate}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0,10) !== args.startDate || args.startDate < brasiliaDay(Date.now())) throw new ConvexError("INVALID_DATE");
    if (args.photographIds.length !== 50 || new Set(args.photographIds).size !== 50) throw new ConvexError("REQUIRES_50_UNIQUE_PHOTOS");
    for (const id of args.photographIds) {
      const photo = await ctx.db.get(id);
      if (!photo || photo.image.provider !== "convex" || !await ctx.storage.getUrl(photo.image.storageId)) throw new ConvexError("INVALID_IMAGE");
    }
    const existing = await ctx.db.query("photoRotations").withIndex("by_key", q => q.eq("key", "active")).unique();
    if (existing) {
      if (existing.startDate === args.startDate && JSON.stringify(existing.photographIds) === JSON.stringify(args.photographIds)) return null;
      throw new ConvexError("ROTATION_ALREADY_ACTIVE");
    }
    await ctx.db.insert("photoRotations", { key: "active", ...args });
    return null;
  },
});

export const hasDate = internalMutation({
  args: { challengeDate: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => !!await ctx.db.query("photographs").withIndex("by_date", q => q.eq("challengeDate", args.challengeDate)).unique(),
});

export const backfillPhotoInfo = internalMutation({
  args: {
    entries: v.array(v.object({
      creditUrl: v.string(),
      capturedDate: v.string(),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
    })),
  },
  returns: v.object({ updated: v.number(), missing: v.array(v.string()) }),
  handler: async (ctx, args) => {
    let updated = 0;
    const missing: string[] = [];
    for (const entry of args.entries) {
      const captured = Date.parse(`${entry.capturedDate}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.capturedDate) || !Number.isFinite(captured) || new Date(captured).toISOString().slice(0, 10) !== entry.capturedDate) throw new ConvexError("INVALID_CAPTURED_DATE");
      if (!entry.creditUrl.startsWith("https://") || [entry.city, entry.state, entry.country].some(value => value !== undefined && (!value.trim() || value.length > 100))) throw new ConvexError("INVALID_PHOTO_INFO");
      const photo = await ctx.db.query("photographs").withIndex("by_credit_url", q => q.eq("creditUrl", entry.creditUrl)).unique();
      if (!photo) {
        missing.push(entry.creditUrl);
        continue;
      }
      const changed = photo.capturedDate !== entry.capturedDate
        || (entry.city !== undefined && photo.city !== entry.city)
        || (entry.state !== undefined && photo.state !== entry.state)
        || (entry.country !== undefined && photo.country !== entry.country);
      if (!changed) continue;
      await ctx.db.patch(photo._id, {
        capturedDate: entry.capturedDate,
        ...(entry.city === undefined ? {} : { city: entry.city }),
        ...(entry.state === undefined ? {} : { state: entry.state }),
        ...(entry.country === undefined ? {} : { country: entry.country }),
      });
      updated += 1;
    }
    return { updated, missing };
  },
});

export const schedule = internalMutation({
  returns: v.id("photographs"),
  args: {
    image: imageAsset, challengeDate: v.string(), correctMinutes: v.number(),
    capturedDate: v.optional(v.string()), city: v.optional(v.string()), state: v.optional(v.string()), country: v.optional(v.string()),
    alt: v.optional(v.object({ pt: v.string(), en: v.string() })),
    objectPosition: v.optional(v.string()), credit: v.optional(v.string()), creditUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsed = Date.parse(`${args.challengeDate}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.challengeDate) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== args.challengeDate) throw new ConvexError("INVALID_DATE");
    if (args.challengeDate < brasiliaDay(Date.now())) throw new ConvexError("PAST_DATE");
    if (args.capturedDate) {
      const captured = Date.parse(`${args.capturedDate}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.capturedDate) || !Number.isFinite(captured) || new Date(captured).toISOString().slice(0, 10) !== args.capturedDate) throw new ConvexError("INVALID_CAPTURED_DATE");
    }
    if ([args.city, args.state, args.country].some(value => value !== undefined && (!value.trim() || value.length > 100))) throw new ConvexError("INVALID_LOCATION");
    if (!Number.isInteger(args.correctMinutes) || args.correctMinutes < 0 || args.correctMinutes >= 1440) throw new ConvexError("INVALID_TIME");
    for (const url of [args.creditUrl, args.image.provider === "external" ? args.image.url : undefined]) {
      if (url && !url.startsWith("https://")) throw new ConvexError("HTTPS_REQUIRED");
    }
    const existing = await ctx.db.query("photographs").withIndex("by_date", q => q.eq("challengeDate", args.challengeDate)).unique();
    if (existing) throw new ConvexError("DATE_ALREADY_SCHEDULED");
    if (args.image.provider === "convex") {
      const file = await ctx.db.system.get(args.image.storageId);
      if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.contentType ?? "")) throw new ConvexError("INVALID_IMAGE");
    }
    return ctx.db.insert("photographs", args);
  },
});
