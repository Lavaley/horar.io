"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";

type Screen = "intro" | "playing" | "summary";
type Hand = "hour" | "minute";

type Round = {
  id: number;
  image: string;
  alt: string;
  correctMinutes: number;
  objectPosition: string;
};

type RoundResult = {
  roundId: number;
  chosenMinutes: number;
  correctMinutes: number;
  difference: number;
  score: number;
};

const DEFAULT_TIME = 10 * 60 + 10;
const REVEAL_DURATION = 2000;

const rounds: Round[] = [
  {
    id: 1,
    image: "/game/01.jpeg",
    alt: "Montanhas cobertas por neblina vistas de uma estrada",
    correctMinutes: 11 * 60 + 5,
    objectPosition: "center 58%",
  },
  {
    id: 2,
    image: "/game/02.jpeg",
    alt: "Praia de águas rasas diante de uma encosta arborizada",
    correctMinutes: 11 * 60 + 20,
    objectPosition: "center 62%",
  },
  {
    id: 3,
    image: "/game/03.jpeg",
    alt: "Nascer do sol alaranjado sobre o mar e a areia da praia",
    correctMinutes: 5 * 60 + 10,
    objectPosition: "center 48%",
  },
  {
    id: 4,
    image: "/game/04.jpeg",
    alt: "Piscina entre edifícios sob um céu azul com nuvens",
    correctMinutes: 13 * 60 + 21,
    objectPosition: "center 55%",
  },
  {
    id: 5,
    image: "/game/05.jpeg",
    alt: "Vista urbana ensolarada com montanhas ao fundo",
    correctMinutes: 13 * 60 + 45,
    objectPosition: "center 56%",
  },
  {
    id: 6,
    image: "/game/06.jpeg",
    alt: "Pôr do sol vermelho intenso sobre casas e árvores",
    correctMinutes: 18 * 60 + 4,
    objectPosition: "center 46%",
  },
  {
    id: 7,
    image: "/game/07.jpeg",
    alt: "Enseada azul entre grandes pedras e uma encosta verde",
    correctMinutes: 12 * 60 + 7,
    objectPosition: "center 60%",
  },
  {
    id: 8,
    image: "/game/08.jpeg",
    alt: "Piscina ao entardecer sob um céu azul e rosado",
    correctMinutes: 18 * 60 + 6,
    objectPosition: "center 54%",
  },
];

const rules = [
  {
    number: "01",
    title: "Observe",
    description: "Leia a luz, as sombras e cada detalhe da cena.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.7" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Marque o horário",
    description: "Gire os ponteiros para escolher a hora e os minutos.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Some pontos",
    description: "Quanto mais perto do instante real, maior a pontuação.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.45 4.96 5.47.8-3.96 3.85.94 5.45L12 15.48l-4.9 2.58.94-5.45-3.96-3.85 5.47-.8L12 3Z" />
      </svg>
    ),
  },
];

const clockNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
const clockTicks = Array.from({ length: 60 }, (_, index) => index);
const scoreSegments = Array.from({ length: 72 }, (_, index) => index * 10);
const SCORE_RING_RADIUS = 145;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;
const SCORE_SEGMENT_LENGTH = (SCORE_RING_CIRCUMFERENCE / 72) * 0.78;

function normalizeMinutes(minutes: number) {
  return ((minutes % 1440) + 1440) % 1440;
}

function formatTime(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function circularMinuteDifference(first: number, second: number) {
  const directDifference = Math.abs(
    normalizeMinutes(first) - normalizeMinutes(second),
  );
  return Math.min(directDifference, 1440 - directDifference);
}

function calculateScore(difference: number) {
  if (difference >= 120) return 0;
  return Math.round(100 * (1 - difference / 120));
}

function formatDifference(minutes: number) {
  if (minutes === 0) return "Acerto exato";
  if (minutes < 60) return `${minutes} min de diferença`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}h de diferença`
    : `${hours}h ${remainingMinutes}min de diferença`;
}

function getHandAngles(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const minute = normalized % 60;
  const hour = Math.floor(normalized / 60) % 12;

  return {
    hour: hour * 30 + minute * 0.5,
    minute: minute * 6,
  };
}

function closestEquivalentAngle(current: number, target: number) {
  const delta = (((target - current + 180) % 360) + 360) % 360 - 180;
  return current + delta;
}

function getContinuousHandAngles(
  current: { hour: number; minute: number },
  targetMinutes: number,
) {
  const target = getHandAngles(targetMinutes);
  return {
    hour: closestEquivalentAngle(current.hour, target.hour),
    minute: closestEquivalentAngle(current.minute, target.minute),
  };
}

function scoreColor(score: number) {
  const percentage = Math.max(0, Math.min(100, score));
  const hue = percentage * 1.2;
  const lightness = 48 + Math.sin((percentage / 100) * Math.PI) * 5;
  return `hsl(${hue} 78% ${lightness}%)`;
}

function IntroCard({ onStart }: { onStart: () => void }) {
  return (
    <section className="game-card" aria-labelledby="game-title">
      <div className="card-heading">
        <p className="eyebrow">
          <span aria-hidden="true" />
          O tempo está na imagem
        </p>
        <h1 id="game-title">Que horas eram?</h1>
        <p className="intro">
          Observe uma fotografia, encontre as pistas de luz e confie na sua
          percepção para descobrir o instante exato.
        </p>
      </div>

      <ol className="rules" aria-label="Como jogar">
        {rules.map((rule) => (
          <li key={rule.number} className="rule">
            <div className="rule-topline">
              <span className="rule-icon">{rule.icon}</span>
              <span className="rule-number">{rule.number}</span>
            </div>
            <h2>{rule.title}</h2>
            <p>{rule.description}</p>
          </li>
        ))}
      </ol>

      <div className="card-footer">
        <p className="score-note">
          <span>Acerto exato</span>
          <strong>100 pontos por imagem</strong>
        </p>
        <button className="start-button" type="button" onClick={onStart}>
          <span>Iniciar jogo</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}

type AnalogClockProps = {
  time: number;
  handAngles: { hour: number; minute: number };
  isAnimating: boolean;
  isLocked: boolean;
  scoreVisualization: {
    correctTime: number;
    chosenTime: number;
    score: number;
  } | null;
  onTimeChange: (minutes: number, preserveHands?: boolean) => void;
  onTick: () => void;
};

function useMechanicalTick() {
  const audioContext = useRef<AudioContext | null>(null);
  const tickBuffer = useRef<AudioBuffer | null>(null);
  const activeSources = useRef(new Set<AudioBufferSourceNode>());
  const lastTickAt = useRef(0);

  useEffect(() => {
    const sources = activeSources.current;

    return () => {
      sources.forEach((source) => source.stop());
      sources.clear();
      if (audioContext.current) void audioContext.current.close();
    };
  }, []);

  function getAudioContext() {
    if (audioContext.current) return audioContext.current;

    const context = new AudioContext({ latencyHint: "interactive" });
    const sampleCount = Math.floor(context.sampleRate * 0.045);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const time = index / context.sampleRate;
      const noise = Math.random() * 2 - 1;
      const click = Math.sin(2 * Math.PI * 1850 * time);
      samples[index] =
        (noise * 0.52 + click * 0.48) * Math.exp(-time * 115);
    }

    audioContext.current = context;
    tickBuffer.current = buffer;
    return context;
  }

  return function playTick() {
    const now = performance.now();
    if (now - lastTickAt.current < 42 || activeSources.current.size >= 5) return;
    lastTickAt.current = now;

    const context = getAudioContext();
    const buffer = tickBuffer.current;
    if (!buffer) return;

    const start = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = 0.94 + Math.random() * 0.12;
      gain.gain.value = 0.055;
      source.connect(gain).connect(context.destination);
      activeSources.current.add(source);
      source.onended = () => {
        activeSources.current.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    };

    if (context.state === "suspended") {
      void context.resume().then(start).catch(() => undefined);
    } else {
      start();
    }
  };
}

function ScoreRadial({
  correctTime,
  chosenTime,
  score,
}: {
  correctTime: number;
  chosenTime: number;
  score: number;
}) {
  const correctDialMinute = normalizeMinutes(correctTime) % 720;
  const chosenDialMinute = normalizeMinutes(chosenTime) % 720;
  const correctAngle = correctDialMinute * 0.5;
  const chosenAngle = chosenDialMinute * 0.5;

  return (
    <svg
      className="score-radial"
      viewBox="0 0 320 320"
      aria-hidden="true"
    >
      <g className="score-sectors">
        {scoreSegments.map((segmentMinute) => {
          const directDifference = Math.abs(
            segmentMinute - correctDialMinute,
          );
          const difference = Math.min(
            directDifference,
            720 - directDifference,
          );
          const proximity = Math.max(0, 1 - difference / 120);

          return (
            <circle
              key={segmentMinute}
              cx="160"
              cy="160"
              r={SCORE_RING_RADIUS}
              fill="none"
              stroke={scoreColor(proximity * 100)}
              strokeWidth="11"
              strokeDasharray={`${SCORE_SEGMENT_LENGTH} ${
                SCORE_RING_CIRCUMFERENCE - SCORE_SEGMENT_LENGTH
              }`}
              strokeLinecap="round"
              opacity={0.2 + proximity * 0.68}
              transform={`rotate(${segmentMinute * 0.5 - 90} 160 160)`}
            />
          );
        })}
      </g>
      <line
        className="correct-time-marker"
        x1="160"
        y1="8"
        x2="160"
        y2="24"
        transform={`rotate(${correctAngle} 160 160)`}
      />
      <path
        className="chosen-time-marker"
        d="M160 3 153 19h14Z"
        fill={scoreColor(score)}
        transform={`rotate(${chosenAngle} 160 160)`}
      />
    </svg>
  );
}

function AnalogClock({
  time,
  handAngles,
  isAnimating,
  isLocked,
  scoreVisualization,
  onTimeChange,
  onTick,
}: AnalogClockProps) {
  const clockElement = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    hand: Hand;
    lastPointerAngle: number;
    unwrappedMinutes: number;
    lastTickMinute: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function pointerAngle(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle =
      (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI +
      90;
    return (angle + 360) % 360;
  }

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || isLocked) return;

    const currentPointerAngle = pointerAngle(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
    const angleDelta =
      ((currentPointerAngle - drag.lastPointerAngle + 540) % 360) - 180;

    drag.lastPointerAngle = currentPointerAngle;
    drag.unwrappedMinutes +=
      drag.hand === "minute" ? angleDelta / 6 : angleDelta * 2;
    const nextMinutes = Math.round(drag.unwrappedMinutes);
    if (normalizeMinutes(nextMinutes) !== normalizeMinutes(drag.lastTickMinute)) {
      drag.lastTickMinute = nextMinutes;
      onTick();
    }
    onTimeChange(nextMinutes);
  }

  function beginDrag(
    hand: Hand,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (isLocked) return;
    const element = clockElement.current;
    if (!element) return;

    event.preventDefault();
    event.stopPropagation();
    dragState.current = {
      hand,
      lastPointerAngle: pointerAngle(
        event.clientX,
        event.clientY,
        element.getBoundingClientRect(),
      ),
      unwrappedMinutes: time,
      lastTickMinute: time,
    };
    onTick();
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endDrag() {
    dragState.current = null;
    setIsDragging(false);
  }

  return (
    <div
      ref={clockElement}
      className={`analog-clock${isAnimating ? " is-animating" : ""}${
        isDragging ? " is-dragging" : ""
      }${scoreVisualization ? " has-score-radial" : ""}`}
      role="group"
      aria-label={`Relógio analógico marcando ${formatTime(time)}`}
      onPointerMove={updateFromPointer}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="clock-bezel" aria-hidden="true" />
      {scoreVisualization ? <ScoreRadial {...scoreVisualization} /> : null}
      <div className="clock-ticks" aria-hidden="true">
        {clockTicks.map((tick) => (
          <span
            className={tick % 5 === 0 ? "tick tick-major" : "tick"}
            key={tick}
            style={{ transform: `rotate(${tick * 6}deg)` }}
          />
        ))}
      </div>
      <div className="clock-numbers" aria-hidden="true">
        {clockNumbers.map((number) => (
          <span
            key={number}
            style={{
              transform: `rotate(${number * 30}deg) translateY(-7.1rem) rotate(${-number * 30}deg)`,
            }}
          >
            {number}
          </span>
        ))}
      </div>
      <button
        className="clock-hand hour-hand"
        type="button"
        aria-label="Arraste para ajustar as horas"
        disabled={isLocked}
        style={{ transform: `translateX(-50%) rotate(${handAngles.hour}deg)` }}
        onPointerDown={(event) => beginDrag("hour", event)}
      >
        <span />
      </button>
      <button
        className="clock-hand minute-hand"
        type="button"
        aria-label="Arraste para ajustar os minutos"
        disabled={isLocked}
        style={{ transform: `translateX(-50%) rotate(${handAngles.minute}deg)` }}
        onPointerDown={(event) => beginDrag("minute", event)}
      >
        <span />
      </button>
      <span className="clock-pin" aria-hidden="true" />
      <span className="clock-instruction" aria-hidden="true">
        Arraste os ponteiros
      </span>
    </div>
  );
}

function RoundImage({ round }: { round: Round }) {
  const scope = useRef<HTMLDivElement | null>(null);
  const currentLayer = useRef<HTMLDivElement | null>(null);
  const incomingLayer = useRef<HTMLDivElement | null>(null);
  const [visibleRound, setVisibleRound] = useState(round);
  const [incomingRound, setIncomingRound] = useState<Round | null>(null);

  useLayoutEffect(() => {
    const current = currentLayer.current;
    if (!current) return;

    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(current, { autoAlpha: 1, scale: 1 });
        return;
      }
      gsap.fromTo(
        current,
        { autoAlpha: 0, scale: 1.018 },
        { autoAlpha: 1, scale: 1, duration: 0.34, ease: "power2.out" },
      );
    }, scope);

    return () => context.revert();
  }, []);

  useEffect(() => {
    if (round.id === visibleRound.id) return;
    let cancelled = false;
    const preload = new window.Image();
    preload.src = round.image;

    const showIncoming = async () => {
      if (!preload.complete) {
        await new Promise<void>((resolve, reject) => {
          preload.onload = () => resolve();
          preload.onerror = () => reject(new Error("Image preload failed"));
        });
      }
      if (typeof preload.decode === "function") {
        await preload.decode().catch(() => undefined);
      }
      if (!cancelled) setIncomingRound(round);
    };

    void showIncoming().catch(() => {
      if (!cancelled) setVisibleRound(round);
    });
    return () => {
      cancelled = true;
    };
  }, [round, visibleRound.id]);

  useLayoutEffect(() => {
    const current = currentLayer.current;
    const incoming = incomingLayer.current;
    if (!incomingRound || !current || !incoming) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(current, { autoAlpha: 0 });
      gsap.set(incoming, { autoAlpha: 1, scale: 1 });
      const frame = requestAnimationFrame(() => {
        setVisibleRound(incomingRound);
        setIncomingRound(null);
      });
      return () => cancelAnimationFrame(frame);
    }

    const context = gsap.context(() => {
      gsap.set(incoming, { autoAlpha: 0, scale: 1.018 });
      gsap
        .timeline({
          defaults: { overwrite: "auto" },
          onComplete: () => {
            setVisibleRound(incomingRound);
            setIncomingRound(null);
          },
        })
        .to(current, {
          autoAlpha: 0,
          scale: 0.99,
          duration: 0.22,
          ease: "power1.in",
        })
        .to(
          incoming,
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          "-=0.12",
        );
    }, scope);

    return () => context.revert();
  }, [incomingRound]);

  return (
    <div ref={scope} className="photo-layers">
      <div ref={currentLayer} className="photo-layer">
        <Image
          key={visibleRound.id}
          src={visibleRound.image}
          alt={visibleRound.alt}
          fill
          preload
          unoptimized
          sizes="(max-width: 800px) 100vw, 56vw"
          style={{ objectPosition: visibleRound.objectPosition }}
        />
      </div>
      {incomingRound ? (
        <div ref={incomingLayer} className="photo-layer photo-layer-incoming">
          <Image
            key={incomingRound.id}
            src={incomingRound.image}
            alt={incomingRound.alt}
            fill
            loading="eager"
            unoptimized
            sizes="(max-width: 800px) 100vw, 56vw"
            style={{ objectPosition: incomingRound.objectPosition }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  disabled,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
}) {
  return (
    <div className="time-stepper">
      <span>{label}</span>
      <div>
        <button
          type="button"
          aria-label={`Diminuir ${label.toLowerCase()}`}
          onClick={onDecrease}
          disabled={disabled}
        >
          −
        </button>
        <strong>{value}</strong>
        <button
          type="button"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          onClick={onIncrease}
          disabled={disabled}
        >
          +
        </button>
      </div>
    </div>
  );
}

function GameRound({
  round,
  roundIndex,
  selectedTime,
  handAngles,
  isAnimating,
  isRevealed,
  roundScore,
  chosenTime,
  onTimeChange,
  onConfirm,
  onNext,
  onTick,
}: {
  round: Round;
  roundIndex: number;
  selectedTime: number;
  handAngles: { hour: number; minute: number };
  isAnimating: boolean;
  isRevealed: boolean;
  roundScore: number | null;
  chosenTime: number | null;
  onTimeChange: (minutes: number, preserveHands?: boolean) => void;
  onConfirm: () => void;
  onNext: () => void;
  onTick: () => void;
}) {
  const resultElement = useRef<HTMLDivElement | null>(null);
  const hour = Math.floor(selectedTime / 60);
  const minute = selectedTime % 60;
  const isLocked = isAnimating || isRevealed;
  const isLastRound = roundIndex === rounds.length - 1;

  function changeBy(delta: number) {
    onTick();
    onTimeChange(selectedTime + delta);
  }

  function selectPeriod(isPm: boolean) {
    const currentIsPm = hour >= 12;
    if (currentIsPm !== isPm) {
      onTick();
      onTimeChange(selectedTime + (isPm ? 720 : -720), true);
    }
  }

  useLayoutEffect(() => {
    const result = resultElement.current;
    if (!isRevealed || !result) return;

    const context = gsap.context(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      gsap.fromTo(
        result,
        { autoAlpha: 0, y: reducedMotion ? 0 : 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: reducedMotion ? 0 : 0.32,
          ease: "power2.out",
          overwrite: "auto",
        },
      );
    }, result);

    return () => context.revert();
  }, [isRevealed, round.id]);

  return (
    <section className="play-card" aria-labelledby="round-title">
      <div className="round-photo">
        <RoundImage round={round} />
        <div className="photo-shade" aria-hidden="true" />
        <div className="photo-meta">
          <div>
            <p>Rodada {String(roundIndex + 1).padStart(2, "0")}</p>
            <h1 id="round-title">Que horas eram?</h1>
          </div>
          <span className="round-counter">
            {roundIndex + 1} <i>/</i> {rounds.length}
          </span>
        </div>
      </div>

      <div className="answer-panel" aria-busy={isAnimating}>
        <div className="answer-heading">
          <div>
            <p className="eyebrow compact-eyebrow">
              <span aria-hidden="true" />
              Sua percepção
            </p>
            <h2>Ajuste os ponteiros</h2>
          </div>
          <strong className="selected-time" aria-live="polite">
            {formatTime(selectedTime)}
          </strong>
        </div>

        <AnalogClock
          time={selectedTime}
          handAngles={handAngles}
          isAnimating={isAnimating}
          isLocked={isLocked}
          scoreVisualization={
            isRevealed && roundScore !== null && chosenTime !== null
              ? {
                  correctTime: round.correctMinutes,
                  chosenTime,
                  score: roundScore,
                }
              : null
          }
          onTimeChange={onTimeChange}
          onTick={onTick}
        />

        <div className="precision-controls" aria-label="Ajuste preciso do horário">
          <Stepper
            label="Hora"
            value={String(hour).padStart(2, "0")}
            onDecrease={() => changeBy(-60)}
            onIncrease={() => changeBy(60)}
            disabled={isLocked}
          />
          <Stepper
            label="Minuto"
            value={String(minute).padStart(2, "0")}
            onDecrease={() => changeBy(-1)}
            onIncrease={() => changeBy(1)}
            disabled={isLocked}
          />
          <div className="period-control">
            <span>Período</span>
            <div>
              <button
                type="button"
                aria-pressed={hour < 12}
                onClick={() => selectPeriod(false)}
                disabled={isLocked}
              >
                AM
              </button>
              <button
                type="button"
                aria-pressed={hour >= 12}
                onClick={() => selectPeriod(true)}
                disabled={isLocked}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        <div className="feedback-slot">
          {isAnimating ? (
            <div className="reveal-status" role="status">
              <span aria-hidden="true" />
              Revelando o instante correto…
            </div>
          ) : null}

          {isRevealed && roundScore !== null && chosenTime !== null ? (
            <div
              ref={resultElement}
              className="round-result"
              aria-live="polite"
              style={{ "--score-color": scoreColor(roundScore) } as CSSProperties}
            >
              <div className="round-result-copy">
                <span>Horário correto</span>
                <strong>{formatTime(round.correctMinutes)}</strong>
                <p>Você marcou {formatTime(chosenTime)}</p>
              </div>
              <div className="round-points">
                <strong>{roundScore}</strong>
                <span>pontos</span>
              </div>
            </div>
          ) : null}
        </div>

        <button
          className="confirm-button"
          type="button"
          onClick={isRevealed ? onNext : onConfirm}
          disabled={isAnimating}
        >
          <span>
            {isAnimating
              ? "Aguarde…"
              : isRevealed
                ? isLastRound
                  ? "Ver resultado"
                  : "Próxima imagem"
                : "Confirmar horário"}
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function Summary({
  results,
  onRestart,
}: {
  results: RoundResult[];
  onRestart: () => void;
}) {
  const total = results.reduce((sum, result) => sum + result.score, 0);
  const maximum = rounds.length * 100;
  const percentage = Math.round((total / maximum) * 100);
  const exactAnswers = results.filter((result) => result.difference === 0).length;
  const performance =
    percentage >= 85
      ? "Olhar de cronometrista"
      : percentage >= 60
        ? "Boa leitura da luz"
        : percentage >= 35
          ? "Intuição em formação"
          : "Cada sombra ensina";

  return (
    <section className="summary-card" aria-labelledby="summary-title">
      <div className="summary-intro">
        <p className="eyebrow">
          <span aria-hidden="true" />
          Fim de jogo
        </p>
        <h1 id="summary-title">{performance}</h1>
        <p>
          Você concluiu as {rounds.length} cenas. Compare cada palpite com o
          instante real e veja onde sua percepção chegou mais perto.
        </p>
      </div>

      <div className="score-medallion" aria-label={`${total} de ${maximum} pontos`}>
        <span>Sua pontuação</span>
        <strong>{total}</strong>
        <small>de {maximum} pontos</small>
      </div>

      <div className="summary-stats">
        <div>
          <strong>{percentage}%</strong>
          <span>Aproveitamento</span>
        </div>
        <div>
          <strong>{exactAnswers}</strong>
          <span>{exactAnswers === 1 ? "Acerto exato" : "Acertos exatos"}</span>
        </div>
        <div>
          <strong>
            {Math.round(
              results.reduce((sum, result) => sum + result.difference, 0) /
                results.length,
            )}
            min
          </strong>
          <span>Desvio médio</span>
        </div>
      </div>

      <ol className="result-list" aria-label="Resumo das rodadas">
        {results.map((result, index) => (
          <li key={result.roundId}>
            <span className="result-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{formatTime(result.chosenMinutes)}</strong>
              <span>Seu palpite</span>
            </div>
            <div>
              <strong>{formatTime(result.correctMinutes)}</strong>
              <span>Horário correto</span>
            </div>
            <div className="result-distance">
              <strong>{result.score} pts</strong>
              <span>{formatDifference(result.difference)}</span>
            </div>
          </li>
        ))}
      </ol>

      <button className="start-button restart-button" type="button" onClick={onRestart}>
        <span>Jogar novamente</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 8a8 8 0 1 0 1 6M19 4v4h-4" />
        </svg>
      </button>
    </section>
  );
}

export default function GameExperience() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState(DEFAULT_TIME);
  const [handAngles, setHandAngles] = useState(() => getHandAngles(DEFAULT_TIME));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [chosenTime, setChosenTime] = useState<number | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const mainElement = useRef<HTMLElement | null>(null);
  const answerLocked = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrame = useRef<number | null>(null);
  const playTick = useMechanicalTick();

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  useEffect(() => {
    mainElement.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [roundIndex, screen]);

  useEffect(() => {
    if (screen !== "playing") return;
    const nextRound = rounds[roundIndex + 1];
    if (!nextRound) return;
    const preload = new window.Image();
    preload.src = nextRound.image;
  }, [roundIndex, screen]);

  const currentRound = rounds[roundIndex];

  function chooseTime(minutes: number, preserveHands = false) {
    if (isAnimating || isRevealed) return;
    const normalized = normalizeMinutes(minutes);
    setSelectedTime(normalized);
    if (!preserveHands) {
      setHandAngles((currentAngles) =>
        getContinuousHandAngles(currentAngles, normalized),
      );
    }
  }

  function resetRound() {
    answerLocked.current = false;
    setSelectedTime(DEFAULT_TIME);
    setHandAngles(getHandAngles(DEFAULT_TIME));
    setIsAnimating(false);
    setIsRevealed(false);
    setRoundScore(null);
    setChosenTime(null);
  }

  function startGame() {
    setRoundIndex(0);
    setResults([]);
    resetRound();
    setScreen("playing");
  }

  function confirmAnswer() {
    if (answerLocked.current || isAnimating || isRevealed) return;
    answerLocked.current = true;

    const difference = circularMinuteDifference(
      selectedTime,
      currentRound.correctMinutes,
    );
    const score = calculateScore(difference);
    const correctAngles = getHandAngles(currentRound.correctMinutes);
    const targetAngles = {
      hour: closestEquivalentAngle(handAngles.hour, correctAngles.hour),
      minute: closestEquivalentAngle(handAngles.minute, correctAngles.minute),
    };
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = prefersReducedMotion ? 50 : REVEAL_DURATION;

    setChosenTime(selectedTime);
    setRoundScore(score);
    setResults((currentResults) => [
      ...currentResults,
      {
        roundId: currentRound.id,
        chosenMinutes: selectedTime,
        correctMinutes: currentRound.correctMinutes,
        difference,
        score,
      },
    ]);
    setIsAnimating(true);

    if (prefersReducedMotion) {
      setHandAngles(targetAngles);
    } else {
      animationFrame.current = requestAnimationFrame(() => {
        animationFrame.current = requestAnimationFrame(() => {
          setHandAngles(targetAngles);
        });
      });
    }

    revealTimer.current = setTimeout(() => {
      setSelectedTime(currentRound.correctMinutes);
      setIsAnimating(false);
      setIsRevealed(true);
    }, duration + 40);
  }

  function nextRound() {
    if (roundIndex === rounds.length - 1) {
      setScreen("summary");
      return;
    }

    setRoundIndex((index) => index + 1);
    resetRound();
  }

  return (
    <main
      ref={mainElement}
      className={`hero${screen === "playing" ? " hero-playing" : ""}${
        screen === "summary" ? " hero-summary" : ""
      }`}
      id="inicio"
    >
      <div className="time-orbit" aria-hidden="true" />
      {screen === "intro" ? <IntroCard onStart={startGame} /> : null}
      {screen === "playing" ? (
        <GameRound
          round={currentRound}
          roundIndex={roundIndex}
          selectedTime={selectedTime}
          handAngles={handAngles}
          isAnimating={isAnimating}
          isRevealed={isRevealed}
          roundScore={roundScore}
          chosenTime={chosenTime}
          onTimeChange={chooseTime}
          onConfirm={confirmAnswer}
          onNext={nextRound}
          onTick={playTick}
        />
      ) : null}
      {screen === "summary" ? (
        <Summary results={results} onRestart={startGame} />
      ) : null}
    </main>
  );
}
