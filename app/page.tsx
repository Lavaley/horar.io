import GameExperience from "./game-experience";

function ClockMark() {
  return (
    <span className="clock-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="13.25" />
        <path d="M16 8.5V16l5 3" />
        <circle className="clock-center" cx="16" cy="16" r="1.5" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <div className="site-shell">
      <div className="nightscape" aria-hidden="true" />
      <div className="star-glow star-glow-one" aria-hidden="true" />
      <div className="star-glow star-glow-two" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Horar.io — início">
          <ClockMark />
          <span>
            horar<span className="brand-dot">.</span>io
          </span>
        </a>
        <span className="game-label">
          <span aria-hidden="true" />
          Jogo de percepção
        </span>
      </header>

      <GameExperience />

      <footer className="site-footer">
        <span>© 2026 Horar.io</span>
        <span className="footer-motto">Olhe de novo. O tempo deixa pistas.</span>
      </footer>
    </div>
  );
}
