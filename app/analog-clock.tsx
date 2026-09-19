"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { formatTime, normalizeMinutes } from "@/lib/daily";
import { usePreferences } from "./preferences";
type Hand = "hour" | "minute";
const clockNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
const clockTicks = Array.from({ length: 60 }, (_, index) => index);
const scoreSegments = Array.from({ length: 72 }, (_, index) => index * 10);
const SCORE_RING_RADIUS = 145;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;
const SCORE_SEGMENT_LENGTH = (SCORE_RING_CIRCUMFERENCE / 72) * 0.78;

export function getHandAngles(minutes: number) {
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

export function getContinuousHandAngles(
  current: { hour: number; minute: number },
  targetMinutes: number,
) {
  const target = getHandAngles(targetMinutes);
  return {
    hour: closestEquivalentAngle(current.hour, target.hour),
    minute: closestEquivalentAngle(current.minute, target.minute),
  };
}

export function scoreColor(score: number) {
  const percentage = Math.max(0, Math.min(100, score / 10));
  // Keep most of the scale in red, orange, and yellow. Green is reserved
  // for the closest 20% so the result ring communicates distance clearly.
  const hue = percentage <= 80
    ? 4 + percentage * 0.6
    : 52 + (percentage - 80) * 3.4;
  const lightness = 47 + Math.sin((percentage / 100) * Math.PI) * 6;
  return `hsl(${hue} 82% ${lightness}%)`;
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

export function useMechanicalTick() {
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
          // On a 12-hour dial, 360 minutes is the farthest visible point.
          const proximity = Math.max(0, 1 - difference / 360);

          return (
            <circle
              key={segmentMinute}
              cx="160"
              cy="160"
              r={SCORE_RING_RADIUS}
              fill="none"
              stroke={scoreColor(proximity * 1000)}
              strokeWidth="11"
              strokeDasharray={`${SCORE_SEGMENT_LENGTH} ${
                SCORE_RING_CIRCUMFERENCE - SCORE_SEGMENT_LENGTH
              }`}
              strokeLinecap="round"
              opacity={0.35 + proximity * 0.55}
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

export function AnalogClock({
  time,
  handAngles,
  isAnimating,
  isLocked,
  scoreVisualization,
  onTimeChange,
  onTick,
}: AnalogClockProps) {
  const { text } = usePreferences();
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
      aria-label={`${text.analog} ${formatTime(time)}`}
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
              "--number-angle": `${number * 30}deg`,
              transform: `rotate(${number * 30}deg) translateY(-7.1rem) rotate(${-number * 30}deg)`,
            } as CSSProperties}
          >
            {number}
          </span>
        ))}
      </div>
      <button
        className="clock-hand hour-hand"
        type="button"
        aria-label={text.hourHand}
        onKeyDown={event => { if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) { event.preventDefault(); onTick(); onTimeChange(time + (["ArrowUp", "ArrowRight"].includes(event.key) ? 60 : -60)); } }}
        disabled={isLocked}
        style={{ transform: `translateX(-50%) rotate(${handAngles.hour}deg)` }}
        onPointerDown={(event) => beginDrag("hour", event)}
      >
        <span />
      </button>
      <button
        className="clock-hand minute-hand"
        type="button"
        aria-label={text.minuteHand}
        onKeyDown={event => { if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) { event.preventDefault(); onTick(); onTimeChange(time + (["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1)); } }}
        disabled={isLocked}
        style={{ transform: `translateX(-50%) rotate(${handAngles.minute}deg)` }}
        onPointerDown={(event) => beginDrag("minute", event)}
      >
        <span />
      </button>
      <span className="clock-pin" aria-hidden="true" />
      <span className="clock-instruction" aria-hidden="true">
        {isLocked ? "" : text.drag}
      </span>
    </div>
  );
}
