import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { RRule } from "rrule";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import App from "../../js/app.js";
import { Matchup, TeamBadge } from "./SharedClubComponents.jsx";
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
      <span className="modal-kicker">Intelig?ncia</span>
      <h2>{title}</h2>
      <p className="calendar-muted">
        {error?.message || "N?o consegui montar este bloco agora."}
      </p>
    </article>
  );
}

function SafePanel({ title, children }) {
  try {
    return children();
  } catch (error) {
    console.warn(`Intelig?ncia indisponivel em ${title}:`, error);
    return <FallbackCard title={title} error={error} />;
  }
}

function formatCompactMoney(value = 0) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) >= 1000000) {
    return `€${(numeric / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(numeric) >= 1000) {
    return `€${Math.round(numeric / 1000)}k`;
  }
  return App.utils.formatCurrency(numeric);
}

function buildChartRows(profiles = []) {
  return [...profiles]
    .sort((a, b) => Number(b.intelligenceScore || 0) - Number(a.intelligenceScore || 0))
    .slice(0, 8)
    .map((profile) => ({
      manager: String(profile.team?.owner || "-")
        .split(" ")
        .slice(0, 2)
        .join(" "),
      score: Number(profile.intelligenceScore || 0),
      remaining: Math.round(Number(profile.budget?.remaining || 0) / 100000) / 10,
      payroll: Math.round(Number(profile.budget?.payrollWeekly || 0) / 1000),
      pressure:
        Number(profile.budget?.remaining || 0) <= 0
          ? 100
          : Math.min(
              100,
              Math.round(
                ((Number(profile.budget?.payrollWeekly || 0) * 4) /
                  Math.max(1, Number(profile.budget?.remaining || 0))) *
                  100,
              ),
            ),
    }));
}

function ChartTooltip({ active, payload, label, mode = "score" }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};

  return (
    <div className="experience-chart-tooltip">
      <strong>{label}</strong>
      {mode === "finance" ? (
        <>
          <span>Caixa: {formatCompactMoney((row.remaining || 0) * 1000000)}</span>
          <span>Folha: {formatCompactMoney((row.payroll || 0) * 1000)}</span>
        </>
      ) : (
        <>
          <span>?ndice: {row.score}/100</span>
          <span>Press?o: {row.pressure}%</span>
        </>
      )}
    </div>
  );
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
            : "Nenhum t?cnico aparece com trava cr?tica agora. O foco vira caixa, mercado e jogos pendentes."}
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
          <span className="modal-kicker">Fila de a?o</span>
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
            <strong>Nenhuma a?o urgente</strong>
            <span>
              A liga est? est?vel. Use a rodada para ajustar elenco, mercado e
              caixa.
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function ScoreChart({ profiles }) {
  const rows = buildChartRows(profiles);

  return (
    <article className="experience-card experience-chart-card">
      <span className="modal-kicker">Pulso competitivo</span>
      <h2>?ndice de comando</h2>
      <div className="experience-chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} barCategoryGap={14}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="manager"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#a8b3c7", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: "#70819c", fontSize: 11 }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar
              dataKey="score"
              radius={[10, 10, 4, 4]}
              fill="url(#scoreGradient)"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffd54d" />
                <stop offset="100%" stopColor="#44d0c5" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="experience-chart-footer">
        <span>Quanto maior o ?ndice, mais controle sobre risco, caixa e execu?o.</span>
      </div>
    </article>
  );
}

function FinanceChart({ profiles }) {
  const rows = buildChartRows(profiles);

  return (
    <article className="experience-card experience-chart-card">
      <span className="modal-kicker">Press?o financeira</span>
      <h2>Caixa vs folha</h2>
      <div className="experience-chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="manager"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#a8b3c7", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={34}
              tick={{ fill: "#70819c", fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip mode="finance" />}
              cursor={{ stroke: "rgba(255,255,255,0.16)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="remaining"
              name="Caixa (M)"
              stroke="#44d0c5"
              fill="rgba(68, 208, 197, 0.18)"
              strokeWidth={2.2}
            />
            <Area
              type="monotone"
              dataKey="payroll"
              name="Folha (k)"
              stroke="#ffb948"
              fill="rgba(255, 185, 72, 0.12)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="experience-chart-footer">
        <span>Caixa em milh?es de euro e folha semanal em milhares.</span>
      </div>
    </article>
  );
}

function PowerIndex({ profiles }) {
  const rows = [...profiles].sort(
    (a, b) =>
      Number(b.intelligenceScore || 0) - Number(a.intelligenceScore || 0) ||
      Number(a.standing?.position || 99) - Number(b.standing?.position || 99),
  );

  return (
    <article className="experience-card intelligence-power" id="intelligencePower">
      <span className="modal-kicker">Power index</span>
      <h2>For?a real dos t?cnicos</h2>
      <div className="intelligence-power-list">
        {rows.map((profile, index) => (
          <div
            className={`intelligence-power-row tone-${profile.alert?.tone || "watch"}`}
            key={profile.team?.team || `${profile.team?.owner}-${index}`}
          >
            <i>{index + 1}</i>
            <TeamBadge teamName={profile.team?.team} className="small" />
            <div>
              <strong>{profile.team?.owner}</strong>
              <small>
                {profile.alert?.label || "Em leitura"} · {profile.team?.team}
              </small>
              <span>
                <em style={{ width: `${profile.intelligenceScore || 0}%` }}></em>
              </span>
            </div>
            <b>{profile.intelligenceScore || 0}</b>
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
      <h2>Jogos que mudam a leitura</h2>
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
            Nenhum jogo pendente com t?cnico encontrado.
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
          <h2>Postura recomendada por t?cnico</h2>
        </div>
      </div>
      <div className="intelligence-market-grid">
        {profiles.map((profile) => (
          <article
            className={`intelligence-market-card tone-${profile.marketPlan?.tone || "watch"}`}
            key={profile.team?.owner}
          >
            <div>
              <OwnerBadge
                owner={profile.team?.owner}
                fallback={App.data.ownerColors[profile.team?.owner]}
              />
              <strong>{profile.marketPlan?.label || "Sem sinal"}</strong>
            </div>
            <p>{profile.marketPlan?.detail || "Sem leitura de mercado."}</p>
            <dl>
              <div>
                <dt>Saldo</dt>
                <dd>{App.utils.formatCurrency(profile.budget?.remaining || 0)}</dd>
              </div>
              <div>
                <dt>Slots</dt>
                <dd>
                  {profile.transfersToday || 0}/{profile.transferLimit || 0}
                </dd>
              </div>
              <div>
                <dt>Folha</dt>
                <dd>
                  {App.utils.formatCurrency(profile.budget?.payrollWeekly || 0)}/sem
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
      <span className="modal-kicker">Sa?de competitiva</span>
      <h2>Sinais que n?o aparecem na tabela</h2>
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

function AutomationPanel() {
  const [pwaReady, setPwaReady] = useState(false);
  const timeZone = "America/Sao_Paulo";
  const transferDeadline = App.config?.transferWindowOpenUntil
    ? new Date(App.config.transferWindowOpenUntil)
    : null;
  const automationRows = useMemo(() => {
    const now = new Date();
    const payrollRule = new RRule({
      freq: RRule.WEEKLY,
      interval: 1,
      count: 4,
      dtstart: now,
    });
    return payrollRule.all().map((date, index) => ({
      label: index === 0 ? "Proxima folha" : `Folha +${index}`,
      value: formatInTimeZone(date, timeZone, "dd/MM HH:mm"),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ready = Boolean(
        navigator.serviceWorker?.controller ||
          (await navigator.serviceWorker?.getRegistration?.()),
      );
      if (!cancelled) setPwaReady(ready);
    };
    if ("serviceWorker" in navigator) check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="experience-card automation-panel experience-wide">
      <div className="home-panel-header">
        <div>
          <span className="modal-kicker">Automacao e PWA</span>
          <h2>Rotinas que a liga deve observar</h2>
        </div>
        <small>{pwaReady ? "PWA ativo" : "PWA preparando cache"}</small>
      </div>
      <div className="automation-grid">
        <div>
          <span>Realtime</span>
          <strong>{App.state?.apiLoaded ? "Online" : "Aguardando dados"}</strong>
          <small>Matches, mercado, eventos, propostas e notificacoes.</small>
        </div>
        <div>
          <span>Janela</span>
          <strong>
            {transferDeadline
              ? formatInTimeZone(transferDeadline, timeZone, "dd/MM HH:mm")
              : "Sem prazo"}
          </strong>
          <small>Referencia unica para travas e alertas de mercado.</small>
        </div>
        {automationRows.slice(0, 2).map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>Recorrencia semanal calculada com regra automatica.</small>
          </div>
        ))}
      </div>
      <div className="automation-actions">
        <ViewButton className="secondary-button" target="calendarView">
          Abrir agenda
        </ViewButton>
        <ViewButton className="primary-button" target="transfersView">
          Abrir mercado
        </ViewButton>
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
    console.warn("Resumo de intelig?ncia indispon?vel:", error);
  }

  return (
    <section className="experience-grid" id="experienceGrid">
      <SafePanel title="Painel de controle">
        {() => <CommandCenter profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Fila de a?o">
        {() => <DecisionQueue profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Pulso competitivo">
        {() => <ScoreChart profiles={profiles} />}
      </SafePanel>
      <SafePanel title="Press?o financeira">
        {() => <FinanceChart profiles={profiles} />}
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
      <SafePanel title="Automacao">
        {() => <AutomationPanel />}
      </SafePanel>
      <SafePanel title="Sa?de competitiva">
        {() => <ParityBoard profiles={profiles} />}
      </SafePanel>
    </section>
  );
}

export { ExperienceGrid };
