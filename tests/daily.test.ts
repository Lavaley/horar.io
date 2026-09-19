/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { scoreGuess } from "../convex/scoring";
import { brasiliaDay, nextRelease, periodAt, streakFor } from "../lib/daily";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const playerToken = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T15:00:00Z"));
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dailyRanking");
  const id = await t.run(ctx => ctx.db.insert("photographs", { image: { provider: "external", url: "https://example.com/photo.jpg" }, challengeDate: "2026-09-05", correctMinutes: 665, capturedDate: "2025-08-14", city: "São Paulo", state: "SP", country: "Brasil", creditUrl: "https://commons.wikimedia.org/wiki/File:Photo.jpg" }));
  return { t, id };
}

describe("1000-point score and Brasília calendar", () => {
  it.each([[665, 665, 0, 1000], [664, 665, 1, 999], [605, 665, 60, 917], [545, 665, 120, 833], [1, 720, 719, 1], [0, 720, 720, 0], [1439, 1, 2, 997]])("scores %i against %i", (chosen, correct, difference, score) => {
    expect(scoreGuess(chosen, correct)).toEqual({ difference, score });
  });
  it("changes the daily challenge at 03:00 UTC, across months and years", () => {
    expect(brasiliaDay(Date.parse("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
    expect(brasiliaDay(Date.parse("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
    expect(nextRelease(Date.parse("2026-12-31T23:00:00Z"))).toBe(Date.parse("2027-01-01T03:00:00Z"));
  });
  it.each([["02:59:59", "night"], ["03:00:00", "dawn"], ["08:59:59", "dawn"], ["09:00:00", "morning"], ["14:59:59", "morning"], ["15:00:00", "afternoon"], ["20:59:59", "afternoon"], ["21:00:00", "night"]])("selects the period at %s UTC", (time, expected) => {
    expect(periodAt(Date.parse(`2026-09-05T${time}Z`))).toBe(expected);
  });
  it("counts participation once a day and breaks the streak on missed days", () => {
    expect(streakFor(["2026-08-31", "2026-09-01", "2026-09-01"], "2026-09-02")).toBe(2);
    expect(streakFor(["2026-08-31", "2026-09-01"], "2026-09-03")).toBe(0);
    expect(streakFor(["2026-08-31", "2026-09-02"], "2026-09-02")).toBe(1);
  });
});

describe("Convex daily game", () => {
  it("backfills source photo information idempotently", async () => {
    const { t } = await setup();
    const entry = { creditUrl: "https://commons.wikimedia.org/wiki/File:Photo.jpg", capturedDate: "2024-06-22", city: "Vang Vieng", state: "Província de Vientiane", country: "Laos" };
    expect(await t.mutation(internal.admin.backfillPhotoInfo, { entries: [entry] })).toEqual({ updated: 1, missing: [] });
    expect(await t.mutation(internal.admin.backfillPhotoInfo, { entries: [entry] })).toEqual({ updated: 0, missing: [] });
    expect((await t.mutation(api.challenges.current, {})).photo).toMatchObject(entry);
  });
  it("returns the same photo to everyone, with no answer before a guess", async () => {
    const { t, id } = await setup();
    const first = await t.mutation(api.challenges.current, {});
    expect(first).toEqual(await t.mutation(api.challenges.current, {}));
    expect(first.photo?.id).toBe(id);
    expect(first.photo).toMatchObject({ capturedDate: "2025-08-14", city: "São Paulo", state: "SP", country: "Brasil" });
    expect(JSON.stringify(first)).not.toMatch(/correctMinutes|665|11:05/);
    expect(await t.mutation(api.challenges.result, { playerToken, date: first.date })).toBeNull();
  });
  it("validates on the server, returns the first result on all retries, isolates players", async () => {
    const { t, id } = await setup();
    const args = { playerToken, date: "2026-09-05", photographId: id, chosenMinutes: 605 };
    const result = await t.mutation(api.challenges.submit, args);
    expect(result.score).toBe(917);
    expect(result.correctMinutes).toBe(665);
    expect(await t.mutation(api.challenges.submit, { ...args, chosenMinutes: 665 })).toEqual(result);
    expect(await t.mutation(api.challenges.result, { playerToken: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", date: args.date })).toBeNull();
    expect(await t.run(ctx => ctx.db.query("guesses").collect())).toHaveLength(1);
  });
  it.each([-1, 1440, 5.5, Number.NaN])("rejects invalid minutes %s", async chosenMinutes => {
    const { t, id } = await setup();
    await expect(t.mutation(api.challenges.submit, { playerToken, date: "2026-09-05", photographId: id, chosenMinutes })).rejects.toThrow();
  });
  it("rejects future photographs and client-controlled dates", async () => {
    const { t, id } = await setup();
    await expect(t.mutation(api.challenges.submit, { playerToken, date: "2026-09-06", photographId: id, chosenMinutes: 0 })).rejects.toThrow("DAY_CHANGED");
    const futureId = await t.run(ctx => ctx.db.insert("photographs", { image: { provider: "external", url: "https://example.com/future.jpg" }, challengeDate: "2026-09-06", correctMinutes: 200 }));
    await expect(t.mutation(api.challenges.submit, { playerToken, date: "2026-09-05", photographId: futureId, chosenMinutes: 0 })).rejects.toThrow("CHALLENGE_CHANGED");
  });
  it("changes the photo at midnight and permits the new day's guess", async () => {
    const { t, id } = await setup();
    const first = await t.mutation(api.challenges.submit, { playerToken, date: "2026-09-05", photographId: id, chosenMinutes: 10 });
    const nextId = await t.run(ctx => ctx.db.insert("photographs", { image: { provider: "external", url: "https://example.com/next.jpg" }, challengeDate: "2026-09-06", correctMinutes: 600 }));
    vi.setSystemTime(new Date("2026-09-06T03:00:00Z"));
    expect((await t.mutation(api.challenges.current, {})).photo?.id).toBe(nextId);
    expect(await t.mutation(api.challenges.submit, { playerToken, date: first.date, photographId: id, chosenMinutes: 10 })).toEqual(first);
    const next = await t.mutation(api.challenges.submit, { playerToken, date: "2026-09-06", photographId: nextId, chosenMinutes: 600 });
    expect(next.score).toBe(1000);
    expect(next.ranking).toEqual({ position: 1, total: 1 });
  });
  it("has an honest empty state and does not repeat an old photo", async () => {
    const { t } = await setup();
    vi.setSystemTime(new Date("2026-09-08T03:00:00Z"));
    expect((await t.mutation(api.challenges.current, {})).photo).toBeNull();
  });
  it("prevents duplicate or invalid challenge schedules", async () => {
    const { t } = await setup();
    const args = { image: { provider: "external" as const, url: "https://example.com/photo.jpg" }, challengeDate: "2026-09-05", correctMinutes: 1 };
    await expect(t.mutation(internal.admin.schedule, args)).rejects.toThrow("DATE_ALREADY_SCHEDULED");
    await expect(t.mutation(internal.admin.schedule, { ...args, challengeDate: "2026-02-30" })).rejects.toThrow("INVALID_DATE");
  });
});

describe("perpetual photo rotation", () => {
  it("cycles 50 photos indefinitely, changes at Brasília midnight and keeps daily receipts separate", async () => {
    const { t } = await setup();
    const ids = await t.run(async ctx => {
      const ids = [];
      for (let index = 0; index < 50; index++) {
        ids.push(await ctx.db.insert("photographs", { image: { provider: "external", url: `https://example.com/${index}.jpg` }, challengeDate: `catalog-${index}`, correctMinutes: 600 + index }));
      }
      await ctx.db.insert("photoRotations", { key: "active", startDate: "2026-09-05", photographIds: ids });
      return ids;
    });
    const first = await t.mutation(api.challenges.submit, { playerToken, date: "2026-09-05", photographId: ids[0], chosenMinutes: 600 });
    for (const day of [1, 49, 50, 99, 100, 365, 3650]) {
      vi.setSystemTime(new Date(Date.parse("2026-09-05T03:00:00Z") + day * 86400000));
      const current = await t.mutation(api.challenges.current, {});
      expect(current.photo?.id).toBe(ids[day % 50]);
      expect(JSON.stringify(current)).not.toContain("correctMinutes");
      await expect(t.mutation(api.challenges.submit, { playerToken, date: current.date, photographId: ids[(day + 1) % 50], chosenMinutes: 600 })).rejects.toThrow("CHALLENGE_CHANGED");
      const result = await t.mutation(api.challenges.submit, { playerToken, date: current.date, photographId: ids[day % 50], chosenMinutes: 600 + day % 50 });
      expect(result.score).toBe(1000);
      expect(result.ranking).toEqual({ position: 1, total: 1 });
    }
    expect(await t.mutation(api.challenges.result, { playerToken, date: first.date })).toEqual(first);
    vi.setSystemTime(new Date("2026-10-25T02:59:59Z"));
    expect((await t.mutation(api.challenges.current, {})).photo?.id).toBe(ids[49]);
    vi.setSystemTime(new Date("2026-10-25T03:00:00Z"));
    expect((await t.mutation(api.challenges.current, {})).photo?.id).toBe(ids[0]);
  });

  it("rejects incomplete rotation activation", async () => {
    const { t, id } = await setup();
    await expect(t.mutation(internal.admin.activateRotation, { startDate: "2026-09-05", photographIds: Array(50).fill(id) })).rejects.toThrow("REQUIRES_50_UNIQUE_PHOTOS");
    await expect(t.mutation(internal.admin.activateRotation, { startDate: "2026-02-30", photographIds: [] })).rejects.toThrow("INVALID_DATE");
  });
});

describe("daily ranking", () => {
  const tokenFor = (index: number) => `${String(index).padStart(8, "0")}-aaaa-4aaa-aaaa-aaaaaaaaaaaa`;

  it("ranks by score, shares tied places, refreshes totals and never duplicates retries", async () => {
    const { t, id } = await setup();
    const submit = (index: number, chosenMinutes: number) => t.mutation(api.challenges.submit, { playerToken: tokenFor(index), date: "2026-09-05", photographId: id, chosenMinutes });
    expect((await submit(1, 0)).ranking).toEqual({ position: 1, total: 1 });
    await submit(2, 665);
    await submit(3, 665);
    expect((await submit(4, 605)).ranking).toEqual({ position: 3, total: 4 });
    expect((await submit(1, 665)).ranking).toEqual({ position: 4, total: 4 });
    expect((await submit(1, 665)).score).toBe(76);
    expect((await t.mutation(api.challenges.result, { playerToken: tokenFor(2), date: "2026-09-05" }))?.ranking).toEqual({ position: 1, total: 4 });
    expect(await t.mutation(api.challenges.result, { playerToken: tokenFor(9), date: "2026-09-05" })).toBeNull();
  });

  it("counts concurrent participants once and gives tied winners the same place", async () => {
    const { t, id } = await setup();
    const args = { date: "2026-09-05", photographId: id, chosenMinutes: 665 };
    await Promise.all(Array.from({ length: 6 }, (_, index) => t.mutation(api.challenges.submit, { ...args, playerToken: tokenFor(index % 3) })));
    expect((await t.mutation(api.challenges.result, { date: args.date, playerToken: tokenFor(0) }))?.ranking).toEqual({ position: 1, total: 3 });
  });

  it("backfills 1000 existing participants across pages idempotently and isolates days", async () => {
    const { t, id } = await setup();
    await t.run(async ctx => {
      for (let index = 0; index < 1000; index++) {
        await ctx.db.insert("guesses", { playerToken: tokenFor(index), date: "2026-09-05", photographId: id, chosenMinutes: 665, correctMinutes: 665, difference: 0, score: index === 0 ? 100 : 50 });
      }
      await ctx.db.insert("guesses", { playerToken: tokenFor(1001), date: "2026-09-04", photographId: id, chosenMinutes: 665, correctMinutes: 665, difference: 0, score: 100 });
    });
    for (let pass = 0; pass < 2; pass++) {
      let cursor: string | null = null;
      let done = false;
      let processed = 0;
      while (!done) {
        const page: { cursor: string; isDone: boolean; processed: number } = await t.mutation(internal.ranking.backfill, { cursor });
        cursor = page.cursor;
        done = page.isDone;
        processed += page.processed;
      }
      expect(processed).toBe(1001);
    }
    const winner = await t.mutation(api.challenges.result, { date: "2026-09-05", playerToken: tokenFor(0) });
    expect(winner?.ranking).toEqual({ position: 1, total: 1000 });
    expect(JSON.stringify(winner)).not.toContain("playerToken");
  }, 30_000);
});
