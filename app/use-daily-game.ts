"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { streakFor } from "@/lib/daily";

export type DailyChallenge = FunctionReturnType<typeof api.challenges.current>;
export type DailyResult = FunctionReturnType<typeof api.challenges.submit>;
type Pending = { date: string; photographId: DailyResult["photographId"]; chosenMinutes: number };
type Saved = { pending: Pending; result?: DailyResult; streak?: number };
const PREFIX = "horario.daily.";
let client: ConvexHttpClient | undefined;
function backend() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Convex is not configured");
  return client ??= new ConvexHttpClient(url, { logger: false });
}
function readDay(date: string): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + date) ?? "null");
    if (!value || value.pending?.date !== date || !Number.isInteger(value.pending.chosenMinutes) || value.pending.chosenMinutes < 0 || value.pending.chosenMinutes >= 1440 || typeof value.pending.photographId !== "string") return null;
    if (value.result && (value.result.date !== date || !Number.isFinite(value.result.score) || !Number.isFinite(value.result.correctMinutes))) return { pending: value.pending };
    return value;
  } catch { return null; }
}
function playedDates() {
  try {
    return Object.keys(localStorage).filter(key => key.startsWith(PREFIX)).map(key => key.slice(PREFIX.length)).filter(date => readDay(date)?.result);
  } catch { return []; }
}
function saveResult(result: DailyResult) {
  const streak = streakFor([...playedDates(), result.date], result.date);
  localStorage.setItem(PREFIX + result.date, JSON.stringify({ pending: { date: result.date, photographId: result.photographId, chosenMinutes: result.chosenMinutes }, result, streak }));
  localStorage.setItem("horario.streak", JSON.stringify({ date: result.date, count: streak }));
}

export function useDailyGame() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<"connection" | "storageError" | "submissionError" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [now, setNow] = useState(0);
  const token = useRef("");
  const clock = useRef({ server: 0, local: 0 });
  const inFlight = useRef(false);
  const active = useRef(true);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (!token.current || inFlight.current) return;
    const version = ++requestVersion.current;
    try {
      const current = await backend().mutation(api.challenges.current, {});
      const received = await backend().mutation(api.challenges.result, { date: current.date, playerToken: token.current });
      if (!active.current || version !== requestVersion.current) return;
      if (received) { try { saveResult(received); } catch { setError("storageError"); } }
      const saved = readDay(current.date);
      setResult(received ?? saved?.result ?? null);
      setPending(saved?.result || received ? null : saved?.pending ?? null);
      setStreak(streakFor(playedDates(), current.date));
      clock.current = { server: current.serverNow, local: performance.now() };
      setNow(current.serverNow);
      setChallenge(current);
      setError(previous => previous === "storageError" ? previous : null);
    } catch {
      if (active.current && version === requestVersion.current) setError("connection");
    } finally {
      if (active.current && version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const versionRef = requestVersion;
    try {
      token.current = localStorage.getItem("horario.player") ?? crypto.randomUUID();
      localStorage.setItem("horario.player", token.current);
    } catch { token.current = ""; queueMicrotask(() => { if (active.current) { setError("storageError"); setLoading(false); } }); }
    queueMicrotask(() => { if (active.current) void refresh(); });
    const poll = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    const tick = setInterval(() => { if (clock.current.server) setNow(clock.current.server + performance.now() - clock.current.local); }, 1000);
    const wake = () => { if (document.visibilityState === "visible") void refresh(); };
    const sync = (event: StorageEvent) => { if (event.key?.startsWith(PREFIX)) void refresh(); };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("storage", sync);
    return () => { active.current = false; versionRef.current++; clearInterval(poll); clearInterval(tick); window.removeEventListener("focus", wake); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("storage", sync); };
  }, [refresh]);

  useEffect(() => {
    if (!challenge) return;
    const wait = Math.max(50, challenge.nextReleaseAt - (clock.current.server + performance.now() - clock.current.local) + 50);
    const timer = setTimeout(() => { void refresh(); }, wait);
    return () => clearTimeout(timer);
  }, [challenge, refresh]);

  async function submit(chosenMinutes: number) {
    if (!challenge?.photo || result || inFlight.current || error === "storageError") return;
    if (now >= challenge.nextReleaseAt) { void refresh(); return; }
    inFlight.current = true;
    requestVersion.current++;
    const saved = readDay(challenge.date);
    if (saved?.result) { setResult(saved.result); inFlight.current = false; return; }
    const attempt = saved?.pending ?? { date: challenge.date, photographId: challenge.photo.id, chosenMinutes };
    try { localStorage.setItem(PREFIX + challenge.date, JSON.stringify({ pending: attempt })); }
    catch { setError("storageError"); inFlight.current = false; return; }
    setPending(attempt);
    setSubmitting(true);
    setError(null);
    try {
      const received = await backend().mutation(api.challenges.submit, { ...attempt, playerToken: token.current });
      try { saveResult(received); } catch { setError("storageError"); }
      setResult(received);
      setPending(null);
      setStreak(streakFor([...playedDates(), received.date], challenge.date));
    } catch (failure) {
      if (failure instanceof ConvexError && (failure.data === "DAY_CHANGED" || failure.data === "CHALLENGE_CHANGED")) {
        inFlight.current = false;
        await refresh();
      } else setError("submissionError");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      if (clock.current.server + performance.now() - clock.current.local >= challenge.nextReleaseAt) void refresh();
    }
  }

  return { challenge, result, pending, error, loading, submitting, streak, now, refresh, submit };
}
