import App from "../../js/app.js";
import { Matchup, TeamBadge } from "./CalendarCupsViews.jsx";
import { useAppRuntime } from "./ViewSummaries.jsx";

function ViewButton({ target, children, className = "" }) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        App.main.switchToView(target);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {children}
    </button>
  );
}

function OwnerBadge({ owner, fallback = "#2563eb" }) {
  const label = owner || "Livre / CPU";
  return (
    <span
      className="owner"
      style={{ background: App.ui.ownerColor(label, fallback) }}
    >
      {label}
    </span>
  );
}

function FallbackCard({ title, error }) {
  return (
    <article className="experience-card">
      <span className="modal-kicker">Inteligência</span>
      <h2>{title}</h2>
      <p className="calendar-muted">
        {error?.message || "Não consegui montar este bloco agora."}
      </p>
    </article>
  );
}

function SafePanel({ title, children }) {
  try {
    return children();
  } catch (error) {
    console.warn(`Inteligência indisponível em ${title}:`, error);
    return <FallbackCard title={title} error={error} />;
  }
}

function CommandCenter({ profiles }) {
  const health = App.experience.getLeagueHealth(profiles);
  const topAction = health.queue[0];

  return (
    <article
      className="experience-card intelligence-command experience-wide"
      id="intelligenceQueue"
    >
      <div className="intelligence-command-main">
        <span className="modal-kicker">Prioridade da liga</span>
        <h2>{topAction ? topAction.title : "Liga sem bloqueios urgentes"}</h2>
        <p>
          {topAction
            ? topAction.body
            : "Nenhum técnico aparece com travas críticas no momento. Acompanhe mercado, placares e folha para manter esse cenário."}
        </p>
        {topAction ? (
          <ViewButton className="mini-action-button" target={topAction.target}>
            {topAction.cta}
          </ViewButton>
        ) : null}
      </div>
      <div className="intelligence-pulse-grid">
        <article>
          <span>Caixa negativo</span>
          <strong>{App.utils.formatCurrency(health.negativeCash)}</strong>
        </article>
        <article>
          <span>Slots de mercado</span>
          <strong>{health.openSlots}</strong>
        </article>
        <article>
          <span>Folha semanal</span>
          <strong>{App.utils.formatCurrency(health.payrollWeekly)}</strong>
        </article>
        <article>
          <span>Jogos pendentes</span>
          <strong>{health.pendingHuman}</strong>
        </article>
      </div>
    </article>
  );
}

function DecisionQueue({ profiles }) {
  const queue = App.experience.getDecisionQueue(profiles);

  return (
    <article className="experience-card intelligence-queue experience-wide">
      <div className="home-panel-header">
        <div>
          <span className="modal-kicker">Fila de ação</span>
          <h2>O que precisa acontecer agora</h2>
        </div>
        <small>{queue.length} item(ns)</small>
      </div>
      <div className="intelligence-action-list">
        {queue.length ? (
          queue.map((item) => (
            <div
              className={`intelligence-action-row severity-${item.severity}`}
              key={`${item.owner}-${item.title}-${item.target}`}
            >
              <span>{item.owner}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </div>
              <b>{item.metric}</b>
              <ViewButton target={item.target}>Abrir</ViewButton>
            </div>
          ))
        ) : (
          <div className="intelligence-empty-state">
            <strong>Nenhuma ação urgente</strong>
            <span>
              A liga está sem travas críticas. Use os próximos jogos para
              atualizar tendência.
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function PowerIndex({ profiles }) {
  const rows = [...profiles].sort(
    (a, b) =>
      b.intelligenceScore - a.intelligenceScore ||
      Number(a.standing.position || 99) - Number(b.standing.position || 99),
  );

  return (
    <article className="experience-card intelligence-power" id="intelligencePower">
      <span className="modal-kicker">Power index</span>
      <h2>Força real dos técnicos</h2>
      <div className="intelligence-power-list">
        {rows.map((profile, index) => (
          <div
            className={`intelligence-power-row tone-${profile.alert.tone}`}
            key={profile.team.team}
          >
            <i>{index + 1}</i>
            <TeamBadge teamName={profile.team.team} className="small" />
            <div>
              <strong>{profile.team.owner}</strong>
              <small>
                {profile.alert.label} · {profile.team.team}
              </small>
              <span>
                <em style={{ width: `${profile.intelligenceScore}%` }}></em>
              </span>
            </div>
            <b>{profile.intelligenceScore}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function ImpactMatches({ profiles }) {
  const matches = App.experience.getImpactMatches(profiles);

  return (
    <article className="experience-card intelligence-matchday">
      <span className="modal-kicker">Rodada de impacto</span>
      <h2>Jogos que mudam leitura</h2>
      <div className="intelligence-match-list">
        {matches.length ? (
          matches.map((item) => (
            <div className="intelligence-match-card" key={item.event.id}>
              <div>
                <span>{item.label}</span>
                <div className="intelligence-matchup">
                  <Matchup
                    home={item.event.home}
                    away={item.event.away}
                    className="calendar-grid-match"
                  />
                </div>
                <small>
                  {item.event.phase} · {App.utils.formatDate(item.event.date)}
                </small>
              </div>
              <p>{item.detail}</p>
            </div>
          ))
        ) : (
          <p className="calendar-muted">
            Nenhum jogo pendente com técnico encontrado.
          </p>
        )}
      </div>
    </article>
  );
}

function MarketMap({ profiles }) {
  return (
    <article
      className="experience-card intelligence-market experience-wide"
      id="intelligenceMarket"
    >
      <div className="home-panel-header">
        <div>
          <span className="modal-kicker">Mapa de mercado</span>
          <h2>Postura recomendada por técnico</h2>
        </div>
      </div>
      <div className="intelligence-market-grid">
        {profiles.map((profile) => (
          <article
            className={`intelligence-market-card tone-${profile.marketPlan.tone}`}
            key={profile.team.owner}
          >
            <div>
              <OwnerBadge
                owner={profile.team.owner}
                fallback={App.data.ownerColors[profile.team.owner]}
              />
              <strong>{profile.marketPlan.label}</strong>
            </div>
            <p>{profile.marketPlan.detail}</p>
            <dl>
              <div>
                <dt>Saldo</dt>
                <dd>{App.utils.formatCurrency(profile.budget.remaining || 0)}</dd>
              </div>
              <div>
                <dt>Slots</dt>
                <dd>
                  {profile.transfersToday}/{profile.transferLimit}
                </dd>
              </div>
              <div>
                <dt>Folha</dt>
                <dd>
                  {App.utils.formatCurrency(profile.budget.payrollWeekly || 0)}
                  /sem
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </article>
  );
}

function ParityBoard({ profiles }) {
  const rows = App.experience.getParityRows(profiles);

  return (
    <article className="experience-card intelligence-parity">
      <span className="modal-kicker">Saúde competitiva</span>
      <h2>Sinais que não aparecem na tabela</h2>
      <div className="intelligence-parity-list">
        {rows.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function ExperienceGrid() {
  useAppRuntime();
  let profiles = [];

  try {
    profiles = App.experience.getCoachProfiles();
  } catch (error) {
    console.warn("Resumo de inteligência indisponível:", error);
  }

  return (
    <section className="experience-grid" id="experienceGrid">
      <SafePanel title="Painel de controle">
        {() => <CommandCenter profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Fila de ação">
        {() => <DecisionQueue profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Power index">
        {() => <PowerIndex profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Rodada de impacto">
        {() => <ImpactMatches profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Mapa de mercado">
        {() => <MarketMap profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Saúde competitiva">
        {() => <ParityBoard profiles={profiles} />}
      </SafePanel>
    </section>
  );
}

export { ExperienceGrid };
