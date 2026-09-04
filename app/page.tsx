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
    description: "Escolha a hora e os minutos em que a foto foi tirada.",
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

      <main className="hero" id="inicio">
        <div className="time-orbit" aria-hidden="true" />

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
              <strong>Pontuação máxima</strong>
            </p>
            <button className="start-button" type="button">
              <span>Iniciar jogo</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© 2026 Horar.io</span>
        <span className="footer-motto">Olhe de novo. O tempo deixa pistas.</span>
      </footer>
    </div>
  );
}
