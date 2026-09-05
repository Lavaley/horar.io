"use client";

import { useState } from "react";
import { AnalogClock, getHandAngles, getContinuousHandAngles } from "./analog-clock";
import { usePreferences } from "./preferences";
import { formatTime, normalizeMinutes } from "@/lib/daily";

export default function ClockTutorial() {
  const { text } = usePreferences();
  const [time, setTime] = useState(9 * 60);
  const [handAngles, setHandAngles] = useState(() => getHandAngles(9 * 60));
  const [touched, setTouched] = useState(false);
  const matched = time === 10 * 60 + 10;

  function changeTime(minutes: number) {
    setTime(normalizeMinutes(minutes));
    setHandAngles(current => getContinuousHandAngles(current, minutes));
    setTouched(true);
  }

  return <section className="clock-tutorial" aria-label={text.tutorialTitle}>
    <div className="tutorial-copy">
      <span className="tutorial-label">{text.tutorialTitle}</span>
      <h3>{text.tutorialTarget} <strong>10:10</strong></h3>
      <p>{text.tutorialInstructions}</p>
      <p className="tutorial-keyboard">{text.tutorialKeyboard}</p>
    </div>
    <div className="tutorial-dial">
      <AnalogClock time={time} handAngles={handAngles} isAnimating={false} isLocked={false} scoreVisualization={null} onTimeChange={changeTime} onTick={() => {}} />
    </div>
    <div className="tutorial-feedback" data-matched={matched}>
      <span>{text.chosen} <output>{formatTime(time)}</output></span>
      <p role="status">{matched ? text.tutorialSuccess : touched ? text.tutorialKeepGoing : text.tutorialSafe}</p>
    </div>
    <button className="tutorial-reset" type="button" onClick={() => { changeTime(9 * 60); setTouched(false); }}>{text.tutorialReset}</button>
  </section>;
}
