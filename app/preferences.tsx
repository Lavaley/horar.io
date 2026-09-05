"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { copy, type Language } from "@/lib/i18n";
import { periodAt, type Theme } from "@/lib/daily";
import ClockTutorial from "./clock-tutorial";

const Preferences = createContext({ language: "pt" as Language, text: copy.pt as typeof copy[Language] });
export const usePreferences = () => useContext(Preferences);
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Gameplay reports storage errors. */ } }

export default function SiteExperience({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("pt");
  const [theme, setTheme] = useState<Theme>("interactive");
  const [ready, setReady] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLButtonElement>(null);
  const text = copy[language];
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
    if (cancelled) return;
    const saved = read("horario.language");
    const detected = navigator.languages?.find(lang => /^(pt|en)(-|$)/i.test(lang)) ?? navigator.language;
    setLanguage(saved === "pt" || saved === "en" ? saved : /^en\b/i.test(detected) ? "en" : "pt");
    const savedTheme = read("horario.theme");
    if (savedTheme && Object.hasOwn(copy.pt.themes, savedTheme)) setTheme(savedTheme as Theme);
    if (read("horario.rules-seen") !== "1") setRulesOpen(true);
    save("horario.rules-seen", "1");
    setReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    const title = `Horar.io — ${text.title}`;
    // Next's static metadata can be hydrated after the saved language. Keep the
    // browser title in that language when the framework updates the head later.
    const updateTitle = () => { if (document.title !== title) document.title = title; };
    updateTitle();
    const observer = new MutationObserver(updateTitle);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    save("horario.language", language);
    return () => observer.disconnect();
  }, [language, ready, text.title]);
  useEffect(() => {
    if (!ready) return;
    save("horario.theme", theme);
    const update = () => { document.documentElement.dataset.period = theme === "interactive" ? periodAt(Date.now()) : theme; };
    update();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer = setTimeout(() => { update(); schedule(); }, 60_000 - Date.now() % 60_000 + 10); };
    if (theme === "interactive") schedule();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", update); window.removeEventListener("focus", update); };
  }, [theme, ready]);
  useEffect(() => {
    if (rulesOpen) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [rulesOpen]);
  function closeRules() { dialog.current?.close(); setRulesOpen(false); help.current?.focus(); }
  return <Preferences.Provider value={{ language, text }}>
    <div className="site-shell">
      <div className="landscapes" aria-hidden="true">{(["morning", "afternoon", "night", "dawn"] as const).map(period => <div key={period} className={`nightscape landscape-${period}`} />)}</div>
      <div className="star-glow star-glow-one" aria-hidden="true" />
      <div className="star-glow star-glow-two" aria-hidden="true" />
      <header className="site-header">
        <div className="preferences-controls">
          <div className="language-switch" role="group" aria-label={text.language}>
            {(["pt", "en"] as const).map(lang => <button key={lang} lang={lang === "pt" ? "pt-BR" : "en"} type="button" aria-label={lang === "pt" ? "Português do Brasil" : "English"} aria-pressed={language === lang} onClick={() => setLanguage(lang)}><span className="language-indicator" aria-hidden="true" />{lang === "pt" ? "PT-BR" : "EN"}</button>)}
          </div>
          <label className="theme-control"><span className="sr-only">{text.theme}</span>
            <select aria-label={text.theme} value={theme} onChange={event => setTheme(event.target.value as Theme)}>{Object.entries(text.themes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
        </div>
        <a className="brand" href="#inicio" aria-label={text.home}><span className="clock-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13.25" /><path d="M16 8.5V16l5 3" /></svg></span><span>horar<span className="brand-dot">.</span>io</span></a>
        <div className="header-right"><span className="game-label"><span aria-hidden="true" />{text.dailyGame}</span><button ref={help} className="help-button" type="button" aria-label={text.rulesTitle} aria-haspopup="dialog" onClick={() => setRulesOpen(true)}>?</button></div>
      </header>
      {children}
      <footer className="site-footer"><span>© 2026 Horar.io</span><span className="footer-motto">{text.motto}</span></footer>
      <dialog ref={dialog} className="rules-dialog" aria-labelledby="rules-title" onCancel={event => { event.preventDefault(); closeRules(); }} onClose={() => setRulesOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeRules(); } }}>
        <button className="modal-close" type="button" aria-label={text.close} onClick={closeRules} autoFocus>×</button>
        <h2 id="rules-title">{text.rulesTitle}</h2>
        {rulesOpen && <ClockTutorial />}
        {text.rules.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <button className="start-button rules-start" type="button" onClick={closeRules}>{text.tutorialDone}</button>
      </dialog>
    </div>
  </Preferences.Provider>;
}
