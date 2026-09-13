"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { formatTime, normalizeMinutes } from "@/lib/daily";
import { usePreferences } from "./preferences";
import { useDailyGame, type DailyChallenge, type DailyResult } from "./use-daily-game";
import { AnalogClock, getHandAngles, getContinuousHandAngles, scoreColor, useMechanicalTick } from "./analog-clock";

const DEFAULT_TIME = 610;
function Arrow() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>; }
const icons = [
  <svg key="eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.7" /></svg>,
  <svg key="clock" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  <svg key="star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.45 4.96 5.47.8-3.96 3.85.94 5.45L12 15.48l-4.9 2.58.94-5.45-3.96-3.85 5.47-.8L12 3Z" /></svg>,
];

function IntroCard({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  const { text } = usePreferences();
  return <section className="game-card" aria-labelledby="game-title">
    <div className="card-heading"><p className="eyebrow"><span aria-hidden="true" />{text.eyebrow}</p><h1 id="game-title">{text.title}</h1><p className="intro">{text.intro}</p></div>
    <ol className="rules" aria-label={text.rulesTitle}>{text.steps.map((rule, index) => <li key={index} className="rule"><div className="rule-topline"><span className="rule-icon">{icons[index]}</span><span className="rule-number">0{index + 1}</span></div><h2>{rule.title}</h2><p>{rule.description}</p></li>)}</ol>
    <div className="card-footer"><p className="score-note"><span>{text.exact}</span><strong>{text.maxPoints}</strong></p><button className="start-button" type="button" onClick={onStart} disabled={loading}><span>{loading ? text.loading : text.start}</span><Arrow /></button></div>
  </section>;
}

function Stepper({ label, value, onDecrease, onIncrease, disabled }: { label: string; value: string; onDecrease: () => void; onIncrease: () => void; disabled: boolean }) {
  const { text } = usePreferences();
  return <div className="time-stepper"><span>{label}</span><div><button type="button" aria-label={`${text.decrease} ${label.toLowerCase()}`} onClick={onDecrease} disabled={disabled}>−</button><strong>{value}</strong><button type="button" aria-label={`${text.increase} ${label.toLowerCase()}`} onClick={onIncrease} disabled={disabled}>+</button></div></div>;
}

function ReturnTomorrow({ challenge, now, streak }: { challenge: DailyChallenge; now: number; streak: number }) {
  const { text } = usePreferences();
  const seconds = Math.max(0, Math.ceil((challenge.nextReleaseAt - now) / 1000));
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
  return <div className="return-tomorrow"><p>{text.completed}</p><p>{text.tomorrow}</p><div className="daily-stats"><div><span>{text.next}</span><strong role="timer" aria-label={text.next}>{countdown}</strong><small>{text.reset}</small></div><div><span>{text.streak}</span><strong>{streak} <small>{streak === 1 ? text.day : text.days}</small></strong></div></div></div>;
}

function GameRound({ game }: { game: ReturnType<typeof useDailyGame> }) {
  const { text, language } = usePreferences();
  const { challenge, result, pending, submitting, error, now } = game;
  const [draftTime, setSelectedTime] = useState(pending?.chosenMinutes ?? result?.correctMinutes ?? DEFAULT_TIME);
  const selectedTime = pending?.chosenMinutes ?? draftTime;
  const [handAngles, setHandAngles] = useState(() => getHandAngles(selectedTime));
  const [revealing, setRevealing] = useState(false);
  const previousResult = useRef<DailyResult | null>(result);
  const playTick = useMechanicalTick();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!result) return;
    const animate = !previousResult.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    previousResult.current = result;
    setRevealing(animate);
    const frame = requestAnimationFrame(() => setHandAngles(angles => getContinuousHandAngles(angles, result.correctMinutes)));
    const timer = setTimeout(() => { setSelectedTime(result.correctMinutes); setRevealing(false); }, animate ? 2040 : 0);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [result]);
  if (!challenge?.photo) return null;
  const locked = !!result || !!pending || submitting || now >= challenge.nextReleaseAt || error === "storageError";
  const hour = Math.floor(selectedTime / 60);
  const minute = selectedTime % 60;
  function chooseTime(minutes: number, preserveHands = false) {
    if (locked) return;
    const normalized = normalizeMinutes(minutes);
    setSelectedTime(normalized);
    if (!preserveHands) setHandAngles(angles => getContinuousHandAngles(angles, normalized));
  }
  function changeBy(delta: number) { playTick(); chooseTime(selectedTime + delta); }
  function selectPeriod(pm: boolean) { if ((hour >= 12) !== pm) { playTick(); chooseTime(selectedTime + (pm ? 720 : -720), true); } }
  function requestSubmission() {
    if (pending) void game.submit(selectedTime);
    else confirmationDialog.current?.showModal();
  }
  function confirmSubmission() {
    confirmationDialog.current?.close();
    void game.submit(selectedTime);
  }
  const dateLabel = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(`${challenge.date}T12:00:00Z`));
  const shownResult = result && !revealing;
  return <section className={`play-card${shownResult ? " daily-completed" : ""}`} aria-labelledby="round-title">
    <div className="round-photo">
      <div className="photo-layers"><div className="photo-layer"><Image src={challenge.photo.image} alt={challenge.photo.alt?.[language] ?? text.photoAlt} fill preload unoptimized sizes="(max-width: 800px) 100vw, 56vw" style={{ objectPosition: challenge.photo.objectPosition }} onLoad={() => setImageReady(true)} onError={() => setImageFailed(true)} /></div></div>
      <div className="photo-shade" aria-hidden="true" />
      <div className="photo-meta"><div><p>{text.dailyPhoto} · {dateLabel}</p><h1 id="round-title">{text.title}</h1></div></div>
      {challenge.photo.credit && <p className="photo-credit">{text.credit}: {challenge.photo.creditUrl ? <a href={challenge.photo.creditUrl} target="_blank" rel="noreferrer">{challenge.photo.credit}</a> : challenge.photo.credit}</p>}
    </div>
    <div className="answer-panel" aria-busy={submitting || revealing}>
      <div className="answer-heading"><div>{!shownResult && <p className="eyebrow compact-eyebrow"><span aria-hidden="true" />{text.perception}</p>}<h2>{shownResult ? text.correct : text.adjust}</h2></div><strong className="selected-time" aria-live="polite">{formatTime(selectedTime)}</strong></div>
      <AnalogClock time={selectedTime} handAngles={pending && !result ? getHandAngles(pending.chosenMinutes) : handAngles} isAnimating={revealing} isLocked={locked} scoreVisualization={shownResult ? { correctTime: result.correctMinutes, chosenTime: result.chosenMinutes, score: result.score } : null} onTimeChange={chooseTime} onTick={playTick} />
      {!shownResult && <div className="precision-controls" role="group" aria-label={text.precision}>
        <Stepper label={text.hour} value={String(hour).padStart(2, "0")} onDecrease={() => changeBy(-60)} onIncrease={() => changeBy(60)} disabled={locked} />
        <Stepper label={text.minute} value={String(minute).padStart(2, "0")} onDecrease={() => changeBy(-1)} onIncrease={() => changeBy(1)} disabled={locked} />
        <div className="period-control"><span>{text.period}</span><div><button type="button" aria-pressed={hour < 12} onClick={() => selectPeriod(false)} disabled={locked}>AM</button><button type="button" aria-pressed={hour >= 12} onClick={() => selectPeriod(true)} disabled={locked}>PM</button></div></div>
      </div>}
      <div className="daily-feedback" aria-live="polite">
        {submitting || revealing ? <p className="daily-status" role="status">{text.revealing}</p> : null}
        {shownResult && <div className="round-result" style={{ "--score-color": scoreColor(result.score) } as CSSProperties}><div className="round-result-copy"><span>{text.correct}</span><strong>{formatTime(result.correctMinutes)}</strong><p className="chosen-time-result"><span>{text.chosen}</span><strong>{formatTime(result.chosenMinutes)}</strong></p><p>{result.difference === 0 ? text.exact : `${Math.floor(result.difference / 60) ? `${Math.floor(result.difference / 60)}h ` : ""}${result.difference % 60}min ${text.difference}`}</p></div><div className="round-points"><strong>{result.score}</strong><span>{text.points}</span></div></div>}
        {(error || imageFailed) && <p role="alert" className="game-error">{text[error ?? "connection"]}</p>}
      </div>
      {shownResult && <section className="daily-ranking" aria-label={text.rankingTitle}>
        <span>{text.rankingTitle}</span>
        <p aria-live="polite">{result.ranking ? <>{text.rankingPosition} <strong>{result.ranking.position.toLocaleString(language === "pt" ? "pt-BR" : "en")}</strong> {text.rankingOf} <strong>{result.ranking.total.toLocaleString(language === "pt" ? "pt-BR" : "en")}</strong> {result.ranking.total === 1 ? text.rankingPlayer : text.rankingPlayers}</> : text.rankingLoading}</p>
        <small>{text.rankingNote}</small>
      </section>}
      {shownResult ? <ReturnTomorrow challenge={challenge} now={now} streak={game.streak} /> : <><button className="confirm-button" type="button" onClick={requestSubmission} disabled={submitting || revealing || !!result || !imageReady || imageFailed || error === "storageError" || now >= challenge.nextReleaseAt}><span>{submitting || revealing ? text.wait : pending ? text.recover : text.confirm}</span><Arrow /></button><p className="one-guess-note">{text.oneGuess}</p></>}
    </div>
    <dialog ref={confirmationDialog} className="guess-dialog" aria-labelledby="guess-dialog-title" aria-describedby="guess-dialog-description">
      <button className="modal-close" type="button" aria-label={text.adjustGuessAction} onClick={() => confirmationDialog.current?.close()}>×</button>
      <p className="eyebrow"><span aria-hidden="true" />{text.oneGuess}</p>
      <h2 id="guess-dialog-title">{text.confirmGuessTitle}</h2>
      <p id="guess-dialog-description" className="guess-dialog-question">{text.confirmGuessPrompt} <strong>{formatTime(selectedTime)}</strong>?</p>
      <p className="guess-dialog-warning">{text.confirmGuessWarning}</p>
      <div className="guess-dialog-actions">
        <button className="guess-adjust-button" type="button" onClick={() => confirmationDialog.current?.close()}>{text.adjustGuessAction}</button>
        <button className="confirm-button" type="button" onClick={confirmSubmission}><span>{text.confirmGuessAction}</span><Arrow /></button>
      </div>
    </dialog>
  </section>;
}

export default function GameExperience() {
  const { text } = usePreferences();
  const game = useDailyGame();
  const [started, setStarted] = useState(false);
  const playing = !!game.challenge?.photo && (started || !!game.result || !!game.pending);
  return <main className={`hero${playing ? " hero-playing" : ""}`} id="inicio">
    <div className="time-orbit" aria-hidden="true" />
    {playing ? <GameRound key={game.challenge!.date} game={game} /> : game.loading ? <IntroCard onStart={() => setStarted(true)} loading /> : !game.challenge?.photo ? <section className="game-card availability-card"><p className="eyebrow">{text.dailyPhoto}</p><h1>{text.unavailable}</h1><p role="status">{game.error ? text[game.error] : text.unavailableBody}</p><button className="start-button" type="button" onClick={() => void game.refresh()}>{text.retry}<Arrow /></button></section> : <IntroCard onStart={() => setStarted(true)} loading={false} />}
  </main>;
}
