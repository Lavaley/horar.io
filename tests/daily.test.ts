/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
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
  const id = await t.run(ctx => ctx.db.insert("photographs", { image: { provider: "external", url: "https://example.com/photo.jpg" }, challengeDate: "2026-09-05", correctMinutes: 665 }));
  return { t, id };
}

describe("original score and Brasília calendar", () => {
  it.each([[665, 665, 0, 100], [664, 665, 1, 99], [605, 665, 60, 50], [545, 665, 120, 0], [0, 720, 720, 0], [1439, 1, 2, 98]])("scores %i against %i", (chosen, correct, difference, score) => {
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
  it("returns the same photo to everyone, with no answer before a guess", async () => {
    const { t, id } = await setup();
    const first = await t.mutation(api.challenges.current, {});
    expect(first).toEqual(await t.mutation(api.challenges.current, {}));
    expect(first.photo?.id).toBe(id);
    expect(JSON.stringify(first)).not.toMatch(/correctMinutes|665|11:05/);
    expect(await t.mutation(api.challenges.result, { playerToken, date: first.date })).toBeNull();
  });
  it("validates on the server, returns the first result on all retries, isolates players", async () => {
    const { t, id } = await setup();
    const args = { playerToken, date: "2026-09-05", photographId: id, chosenMinutes: 605 };
    const result = await t.mutation(api.challenges.submit, args);
    expect(result.score).toBe(50);
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
    expect((await t.mutation(api.challenges.submit, { playerToken, date: "2026-09-06", photographId: nextId, chosenMinutes: 600 })).score).toBe(100);
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
