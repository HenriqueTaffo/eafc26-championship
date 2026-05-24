const MASCOT_SRC = "./assets/mistura-mascot.png?v=20260524-sponsor-icons-v1";

function GlobalLoader() {
  return (
    <>
      <div
        id="globalLoader"
        className="global-loader is-visible"
        aria-live="polite"
        aria-busy="true"
        role="status"
      >
        <div id="globalLoaderCard" className="loader-card loader-card-match">
          <div id="globalLoaderChip" className="loader-chip">
            Montando a rodada
          </div>
          <div
            id="globalLoaderSpeech"
            className="loader-speech"
            aria-hidden="true"
          >
            Conferindo a rodada...
          </div>

          <div className="loader-stage" aria-hidden="true">
            <div className="loader-shadow"></div>
            <div className="loader-sweat"></div>
            <div className="loader-scan-line"></div>

            <div className="loader-mascot-wrap">
              <div className="loader-ring"></div>
              <div className="loader-orbit"></div>
              <img className="loader-mascot" src={MASCOT_SRC} alt="" />
            </div>

            <div className="loader-tactical-board">
              <i></i>
              <i></i>
              <i></i>
            </div>

            <div className="loader-market-card">
              <span id="globalLoaderMarketLabel">Scout report</span>
              <b id="globalLoaderMarketValue">OVR 87?</b>
              <span id="globalLoaderMarketDetail">taxa subindo...</span>
            </div>

            <div className="loader-chaos-list">
              <span id="globalLoaderChaosItem1">conferindo lesões</span>
              <span id="globalLoaderChaosItem2">validando mercado</span>
              <span id="globalLoaderChaosItem3">organizando bastidores</span>
            </div>
          </div>

          <div className="loader-copy">
            <strong id="globalLoaderTitle">Carregando dados da liga</strong>
            <span id="globalLoaderText">
              Aguarde enquanto a classificação, o calendário e os painéis são
              atualizados.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function ShellChrome() {
  return (
    <>
      <header className="hero league-hero">
        <div className="league-seal" aria-hidden="true">
          <div className="league-seal-ring">
            <span className="seal-top">MISTURA</span>
            <img src={MASCOT_SRC} alt="" />
            <span className="seal-left">20</span>
            <span className="seal-right">24</span>
            <span className="seal-bottom">MANAGERS LEAGUE</span>
          </div>
        </div>
        <div className="league-hero-divider" aria-hidden="true"></div>
        <div className="league-hero-copy">
          <h1>Mistura Managers League</h1>
          <p>
            Competição oficial de managers. Paixão, estratégia e glória em uma
            liga com identidade própria.
          </p>
        </div>
      </header>

      <section id="managerLoginPanel" className="manager-login-panel"></section>
      <section id="transferProposalPanel" className="decision-center"></section>

      <nav className="tabs" aria-label="Navegação principal">
        <button className="tab-button active" data-view="standingsView">
          <span className="tab-icon">♜</span>Classificação
        </button>
        <button className="tab-button" data-view="calendarView">
          <span className="tab-icon">▦</span>Calendário
        </button>
        <button className="tab-button" data-view="cupsView">
          <span className="tab-icon">🏆</span>Copas
        </button>
        <button className="tab-button" data-view="playersView">
          <span className="tab-icon">▣</span>Escritório
        </button>
        <button className="tab-button" data-view="experienceView">
          <span className="tab-icon">◇</span>Inteligência
        </button>
        <button className="tab-button" data-view="eventsView">
          <span className="tab-icon">✦</span>Eventos
        </button>
        <button className="tab-button" data-view="transfersView">
          <span className="tab-icon">⇄</span>Transferências
        </button>
        <button className="tab-button" data-view="commissionerView">
          <span className="tab-icon">⚖</span>Comissário
        </button>
        <button className="tab-button" data-view="submitView">
          <span className="tab-icon">☁</span>Enviar dados
        </button>
      </nav>

      <section className="app-status-bar" aria-live="polite">
        <span id="syncStatusText">Sincronizando dados da liga...</span>
        <div className="global-search" data-global-search>
          <input
            id="globalSearchInput"
            type="search"
            placeholder="Buscar jogo, técnico, jogador..."
            autoComplete="off"
            aria-label="Busca global da liga"
          />
          <div
            id="globalSearchResults"
            className="global-search-results"
            role="listbox"
            aria-label="Resultados da busca global"
          ></div>
        </div>
        <button type="button" data-manual-sync>
          Sincronizar agora
        </button>
      </section>
    </>
  );
}

function StandingsView() {
  return (
    <>
      <section id="standingsView" className="view active">
        <section
          className="summary home-summary"
          id="standingsSummary"
        ></section>

        <section className="round-center" id="roundCenter"></section>

        <section className="attention-panel" id="attentionPanel"></section>

        <section id="leagueNewsPanel" className="league-news-panel"></section>

        <section className="home-grid">
          <article className="home-panel home-standings-panel">
            <div className="home-panel-header">
              <h2>Classificação geral</h2>
            </div>
            <div className="home-standings-table-wrap">
              <table className="home-standings-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Time</th>
                    <th>Pts</th>
                    <th>J</th>
                    <th>V</th>
                    <th>E</th>
                    <th>D</th>
                    <th>SG</th>
                  </tr>
                </thead>
                <tbody id="homeStandingsTable"></tbody>
              </table>
            </div>
            <button
              className="home-link"
              type="button"
              data-scroll-target="standingsFullBlock"
            >
              Ver classificação completa <span>›</span>
            </button>
          </article>

          <article className="home-panel home-next-panel">
            <div className="home-panel-header">
              <h2>Próximos jogos</h2>
            </div>
            <div className="next-games-list" id="homeNextGames"></div>
            <button
              className="home-link"
              type="button"
              data-view-target="calendarView"
            >
              Ver calendário completo <span>›</span>
            </button>
          </article>
        </section>

        <section className="home-cup-card">
          <div className="cup-icon">🏆</div>
          <div>
            <h2>Copas oficiais</h2>
            <p>
              Carabao Cup e The Emirates FA Cup: chaveamento, próximos jogos e
              classificação.
            </p>
          </div>
          <button
            type="button"
            className="cup-action"
            data-view-target="cupsView"
          >
            Ver copas <span>›</span>
          </button>
        </section>

        <section className="activity-panel" id="activityPanel"></section>

        <section className="legend-block compact-legend">
          <p className="legend-title">Legendas de classificação</p>
          <div className="legend">
            <span className="badge">
              <span className="dot promotion"></span>Acesso direto
            </span>
            <span className="badge">
              <span className="dot playoff"></span>Playoffs
            </span>
            <span className="badge">
              <span className="dot relegation"></span>Rebaixamento
            </span>
            <span className="badge">
              <span className="dot ours"></span>Times com técnico
            </span>
          </div>
        </section>

        <section id="standingsFullBlock" className="full-standings-block">
          <div className="home-panel-header">
            <h2>Tabela completa</h2>
          </div>
          <section className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Time</th>
                  <th>Dono</th>
                  <th>J</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>GP</th>
                  <th>GC</th>
                  <th>SG</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody id="standingsTable"></tbody>
            </table>
          </section>
          <section className="mobile-list" id="standingsMobile"></section>
        </section>
      </section>
    </>
  );
}

function CalendarView() {
  return (
    <>
      <section id="calendarView" className="view">
        <section className="summary" id="calendarSummary"></section>
        <section className="controls">
          <input
            id="calendarSearchInput"
            type="search"
            placeholder="Buscar time, competição, rodada ou técnico..."
          />
          <select id="calendarCompetitionFilter">
            <option value="all">Todas as competições</option>
            <option value="Championship">Championship</option>
            <option value="Copa da Liga">Carabao Cup</option>
            <option value="FA Cup">The Emirates FA Cup</option>
          </select>
          <select id="calendarOwnerFilter">
            <option value="all">Todos os técnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
            <option value="human">Apenas jogos com técnico</option>
            <option value="human-vs-human">Técnico x Técnico</option>
            <option value="cpu">CPU x CPU</option>
          </select>
          <select id="calendarWeekFilter">
            <option value="all">Todas as semanas</option>
          </select>
          <select id="calendarStatusFilter" defaultValue="pending">
            <option value="pending">Somente pendentes</option>
            <option value="next">Próximos 30 jogos</option>
            <option value="done">Somente realizados</option>
            <option value="all">Todos os jogos</option>
          </select>
        </section>
        <section className="legend-block">
          <p className="legend-title">Destaques</p>
          <div className="legend">
            <span className="badge">
              <span className="dot ours"></span>Jogo com técnico
            </span>
            <span className="badge">
              <span className="dot pending"></span>Pendente
            </span>
            <span className="badge">
              <span className="dot done"></span>Realizado
            </span>
          </div>
        </section>
        <section
          className="calendar-week-board"
          id="calendarWeekBoard"
        ></section>
        <section
          className="calendar-month-board"
          id="calendarBoard"
          aria-live="polite"
        ></section>
      </section>
    </>
  );
}

function CupsView() {
  return (
    <>
      <section id="cupsView" className="view">
        <section className="summary" id="cupsSummary"></section>
        <section className="controls">
          <input
            id="cupsSearchInput"
            type="search"
            placeholder="Buscar time, fase ou confronto..."
          />
          <select id="cupsCompetitionFilter">
            <option value="all">Todas as copas</option>
            <option value="Copa da Liga">Carabao Cup</option>
            <option value="FA Cup">The Emirates FA Cup</option>
          </select>
        </section>
        <section className="legend-block">
          <p className="legend-title">Chaveamento das copas</p>
          <div className="legend">
            <span className="badge">
              <span className="dot league-cup"></span>Carabao Cup
            </span>
            <span className="badge">
              <span className="dot fa-cup"></span>The Emirates FA Cup
            </span>
            <span className="badge">
              <span className="dot promotion"></span>Classificado
            </span>
          </div>
        </section>
        <section className="cup-prize-card">
          <div>
            <span className="modal-kicker">Premiação das copas</span>
            <h2>Bônus por avanço de fase</h2>
            <p>
              Além da bilheteria, cada técnico recebe orçamento extra quando seu
              time avança nas copas.
            </p>
          </div>
          <div className="cup-prize-grid">
            <span>
              Fase inicial <strong>+€ 1M</strong>
            </span>
            <span>
              Oitavas <strong>+€ 3M</strong>
            </span>
            <span>
              Quartas <strong>+€ 5M</strong>
            </span>
            <span>
              Semifinal <strong>+€ 8M</strong>
            </span>
            <span>
              Campeão <strong>+€ 12M</strong>
            </span>
          </div>
        </section>
        <section id="cupsBracket"></section>
      </section>
    </>
  );
}

function PlayersView() {
  return (
    <>
      <section id="playersView" className="view">
        <section className="summary" id="playersSummary"></section>
        <section className="controls">
          <input
            id="playersSearchInput"
            type="search"
            placeholder="Buscar técnico, jogador, time, e-mail ou próximo jogo..."
          />
          <select id="playersFilter">
            <option value="all">Todos os técnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
        </section>
        <section className="player-grid" id="playersGrid"></section>
        <section className="leaderboard-grid">
          <article className="leaderboard-card">
            <h2>Gols por time</h2>
            <div id="topScorers"></div>
          </article>
          <article className="leaderboard-card">
            <h2>Top 5 transferências mais caras</h2>
            <div id="topAssists"></div>
          </article>
        </section>
        <p className="footer-note">
          Os gols por time consideram apenas os clubes controlados por técnicos.
          A lista ao lado mostra as cinco contratações mais caras aprovadas até
          agora.
        </p>
      </section>
    </>
  );
}

function EventsView() {
  return (
    <>
      <section id="eventsView" className="view">
        <section className="summary" id="eventsSummary"></section>
        <section className="countdown-card events-command-card">
          <div>
            <span>Central de Eventos</span>
            <strong id="nextEventCountdown">Calculando...</strong>
            <p>
              A sala do caos da liga: dinheiro inesperado, punições, lesões,
              travas de mercado e premiações aparecem aqui com impacto direto
              nos técnicos.
            </p>
          </div>
          <div
            className="event-slot-list"
            id="eventSlotList"
            aria-label="Horários de eventos"
          ></div>
        </section>
        <section className="controls">
          <input
            id="eventsSearchInput"
            type="search"
            placeholder="Buscar evento, jogador ou efeito..."
          />
          <select id="eventsOwnerFilter">
            <option value="all">Todos os técnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
          <select id="eventsTypeFilter">
            <option value="all">Todos os tipos</option>
            <option value="positive">Positivos</option>
            <option value="negative">Negativos</option>
            <option value="neutral">Neutros / mercado</option>
          </select>
          <select id="eventsPeriodFilter" defaultValue="latest">
            <option value="latest">Última rodada</option>
            <option value="active">Ativos / em duração</option>
            <option value="today">Todos de hoje</option>
            <option value="last12">Últimos 12</option>
            <option value="all">Histórico completo</option>
          </select>
        </section>
        <section className="form-card events-intro-card">
          <div>
            <h2>Radar da Liga</h2>
            <p>
              Por padrão, exibimos a última rodada para manter a tela leve. Use
              os filtros para investigar histórico, lesões ativas, punições de
              mercado, premiações e impactos financeiros.
            </p>
          </div>
          <div className="event-legend-pills">
            <span>💰 Caixa</span>
            <span>🚑 DM</span>
            <span>🔒 Mercado</span>
            <span>🏆 Copas</span>
            <span>⚠️ Punições</span>
          </div>
          <span className="app-message" id="eventsMessage"></span>
        </section>
        <section className="event-grid" id="eventsGrid"></section>
        <p className="footer-note">
          Central de eventos v45: lançamentos financeiros entram no orçamento
          automaticamente; mercado, lesões e punições aparecem com duração e
          impacto destacado para cada técnico.
        </p>
      </section>
    </>
  );
}

function ExperienceView() {
  return (
    <>
      <section id="experienceView" className="view">
        <section className="summary" id="experienceSummary"></section>
        <section className="submit-hero experience-hero">
          <div>
            <span className="modal-kicker">Sala de análise</span>
            <h2>Central de Inteligência</h2>
            <p>
              Diagnóstico operacional da liga: ações urgentes, risco financeiro,
              rodada de impacto e postura recomendada para cada técnico.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#intelligenceQueue">Fila de ação</a>
            <a href="#intelligencePower">Power index</a>
            <a href="#intelligenceMarket">Mercado</a>
          </div>
        </section>
        <section className="experience-grid" id="experienceGrid"></section>
      </section>
    </>
  );
}

function TransfersView() {
  return (
    <>
      <section id="transfersView" className="view">
        <section className="summary" id="transferSummary"></section>
        <section className="countdown-card">
          <span>Janela de transferências</span>
          <strong id="nextTransferCountdown">Calculando...</strong>
          <p>
            O limite diário reinicia à meia-noite. Eventos podem aumentar ou
            reduzir o limite do dia.
          </p>
        </section>

        <section
          className="transfer-budget-board"
          id="transferBudgetBoard"
        ></section>

        <section className="transfer-workbench">
          <section className="form-card submit-card submit-card-transfer">
            <div className="submit-card-header">
              <span className="submit-card-icon">⇄</span>
              <div>
                <h2>Registrar transferência</h2>
                <p>
                  Mercado externo, negociação entre técnicos e troca de jogador
                  no mesmo fluxo.
                </p>
              </div>
            </div>
            <form id="transferForm">
              <div className="form-grid">
                <div
                  className="submit-mode-switch full"
                  aria-label="Tipo de transferência"
                >
                  <label>
                    <input
                      name="transferType"
                      type="radio"
                      value="market"
                      defaultChecked
                    />
                    <span>Mercado externo</span>
                  </label>
                  <label>
                    <input name="transferType" type="radio" value="internal" />
                    <span>Entre técnicos</span>
                  </label>
                </div>
                <label>
                  Comprador
                  <select name="buyer" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  className="internal-transfer-field"
                  data-internal-transfer-field
                  hidden
                >
                  Vendedor
                  <select name="seller">
                    <option value="">Selecione o vendedor</option>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  className="internal-transfer-field full"
                  data-internal-transfer-field
                  hidden
                >
                  Jogador do vendedor
                  <select id="internalTransferPlayer" name="internalPlayer">
                    <option value="">Escolha vendedor e jogador</option>
                  </select>
                </label>
                <label className="full" data-market-transfer-field>
                  Buscar jogador no mercado
                  <input
                    id="marketPlayerSearch"
                    type="search"
                    placeholder="Digite nome, clube, liga ou posição..."
                    autoComplete="off"
                  />
                </label>
                <div
                  className="market-player-toolbar full"
                  data-market-transfer-field
                >
                  <span>
                    Por padrão, jogadores já contratados ficam escondidos.
                  </span>
                  <label className="market-toggle">
                    <input id="showContractedPlayers" type="checkbox" />
                    <span>Mostrar já contratados</span>
                  </label>
                </div>
                <div
                  className="market-player-results full"
                  id="marketPlayerResults"
                  data-market-transfer-field
                >
                  <div className="market-empty">
                    Digite o nome, clube, liga ou posição para buscar jogadores.
                  </div>
                </div>
                <div
                  className="transfer-exchange-box full"
                  data-market-transfer-field
                >
                  <div className="transfer-exchange-copy">
                    <span>Troca na negociação</span>
                    <strong>Jogador + dinheiro</strong>
                    <small id="transferExchangeHint">
                      Opcional. O abatimento aparece na prévia antes do envio.
                    </small>
                  </div>
                  <label className="transfer-exchange-control">
                    <span>Jogador oferecido</span>
                    <select id="transferExchangePlayer" name="exchangePlayer">
                      <option value="">Sem jogador na troca</option>
                    </select>
                  </label>
                </div>
                <label>
                  Jogador
                  <input
                    name="player"
                    type="text"
                    placeholder="Nome do jogador"
                    required
                  />
                </label>
                <label>
                  Clube origem
                  <input
                    name="fromClub"
                    type="text"
                    placeholder="Clube atual"
                    required
                  />
                </label>
                <label>
                  Overall EAFC
                  <input
                    name="overall"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="Ex: 82"
                    required
                  />
                </label>
                <label className="full">
                  <span id="transferValueLabel">Valor Transfermarkt</span>
                  <input
                    name="marketValue"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="Ex: 32000000"
                    required
                  />
                </label>
              </div>

              <div className="transfer-live-preview" id="transferFormPreview">
                <strong>Prévia da contratação</strong>
                <span>
                  Preencha comprador, jogador, overall e valor para calcular
                  custo final, saldo e travas antes de enviar.
                </span>
              </div>

              <label className="checkbox-row transfer-confirmation-row">
                <input
                  name="confirmTransferBuyer"
                  type="checkbox"
                  value="yes"
                  required
                />
                <span>
                  Confirmo que o comprador selecionado está correto e assumo
                  esta contratação para esse técnico.
                </span>
              </label>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Enviar transferência
                </button>
                <span className="app-message" id="transferMessage"></span>
              </div>
            </form>
          </section>
        </section>

        <section className="controls">
          <input
            id="transferSearchInput"
            type="search"
            placeholder="Buscar jogador, técnico, destino ou clube..."
          />
          <select id="transferOwnerFilter">
            <option value="all">Todos os técnicos/destinos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
          <select id="transferStatusFilter">
            <option value="all">Todos os status</option>
            <option value="valid">Válidas</option>
            <option value="sale">Vendas CPU</option>
            <option value="duplicate">Duplicadas</option>
          </select>
        </section>
        <section className="transfer-insights" id="transferInsights"></section>

        <section className="rule-card">
          <h2>Regras de transferência</h2>
          <ul>
            <li>
              Orçamento base por jogador: <strong>65 milhões</strong>.
            </li>
            <li>
              Receita semanal: <strong>+2M</strong> por semana ativa da
              temporada.
            </li>
            <li>
              Bônus por mando: <strong>+1,5M</strong> por partida em casa.
            </li>
            <li>
              Bônus por vitória: <strong>+1,25M</strong> por vitória.
            </li>
            <li>
              Bônus de campanha: blocos de 5 jogos rendem até
              <strong>+5M</strong> conforme pontuação.
            </li>
            <li>Eventos financeiros podem aumentar ou reduzir o orçamento.</li>
            <li>Copas geram premiação automática por avanço de fase.</li>
            <li>
              Limite base: <strong>3 transferências por dia</strong>. Eventos
              podem alterar esse limite.
            </li>
            <li>Valor final = valor Transfermarkt + percentual por overall.</li>
          </ul>
        </section>
        <section className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Destino</th>
                <th>Origem</th>
                <th>OVR</th>
                <th>Base/Oferta</th>
                <th>% Overall</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="transferTable"></tbody>
          </table>
        </section>
        <section className="mobile-list" id="transferMobile"></section>
        <p className="footer-note">
          Mostrando apenas as 5 movimentações aprovadas mais recentes.
        </p>
      </section>
    </>
  );
}

function CommissionerView() {
  return (
    <>
      <section id="commissionerView" className="view">
        <section
          className="summary commissioner-summary"
          id="commissionerSummary"
        ></section>
        <section className="submit-hero commissioner-hero">
          <div>
            <span className="modal-kicker">Governança da liga</span>
            <h2>Mesa do comissário</h2>
            <p>
              Leilões, centro médico, fair play, fechamento semanal e ações
              especiais para manter a temporada divertida e controlada.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#commissionerAuctions">Leilões</a>
            <a href="#commissionerMedical">Centro médico</a>
            <a href="#commissionerWeekly">Semana</a>
          </div>
        </section>
        <section className="commissioner-grid" id="commissionerGrid"></section>
        <span className="app-message" id="commissionerMessage"></span>
      </section>
    </>
  );
}

function SubmitView() {
  return (
    <>
      <section id="submitView" className="view">
        <section className="submit-hero">
          <div>
            <span className="modal-kicker">Central de lançamentos</span>
            <h2>Enviar dados da liga</h2>
            <p>
              Resultados oficiais e simulações CPU x CPU em uma tela mais
              direta.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#resultForm">Resultado</a>
            <a href="#cpuSimulationForm">CPU x CPU</a>
          </div>
        </section>

        <section className="submit-form-grid">
          <section className="form-card submit-card submit-card-result">
            <div className="submit-card-header">
              <span className="submit-card-icon">▦</span>
              <div>
                <h2>Enviar resultado</h2>
                <p>
                  Registre placares. Em jogos de copa empatados, informe o
                  vencedor nos pênaltis.
                </p>
              </div>
            </div>
            <form id="resultForm">
              <div className="form-grid">
                <label>
                  Competição
                  <select name="competition" required>
                    <option value="Championship">Championship</option>
                    <option value="Copa da Liga">Carabao Cup</option>
                    <option value="FA Cup">The Emirates FA Cup</option>
                  </select>
                </label>
                <label>
                  Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label>
                  Rodada/Fase
                  <input
                    name="phase"
                    type="text"
                    placeholder="Ex: Rodada 1"
                    required
                  />
                </label>
                <label>
                  Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label>
                  Mandante
                  <input
                    name="home"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Coventry City"
                    required
                  />
                </label>
                <label>
                  Visitante
                  <input
                    name="away"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Birmingham City"
                    required
                  />
                </label>
                <label>
                  Gols mandante
                  <input name="homeScore" type="number" min="0" required />
                </label>
                <label>
                  Gols visitante
                  <input name="awayScore" type="number" min="0" required />
                </label>
                <div
                  className="penalty-section full"
                  data-penalty-section
                  hidden
                >
                  <label className="checkbox-row">
                    <input name="hasPenalties" type="checkbox" value="yes" />
                    <span>Houve disputa de pênaltis?</span>
                  </label>
                  <div className="penalty-fields" data-penalty-fields hidden>
                    <label>
                      Vencedor nos pênaltis
                      <input
                        name="penaltyWinner"
                        list="teamOptions"
                        type="text"
                        placeholder="Ex: Middlesbrough"
                      />
                    </label>
                    <label>
                      Placar dos pênaltis
                      <input
                        name="penaltyScore"
                        type="text"
                        placeholder="Ex: 4 x 3"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Enviar resultado
                </button>
                <span className="app-message" id="resultMessage"></span>
              </div>
            </form>
          </section>

          <section className="form-card submit-card submit-card-cpu">
            <div className="submit-card-header">
              <span className="submit-card-icon">☁</span>
              <div>
                <h2>Simular CPU x CPU da semana</h2>
                <p>
                  Confira a auditoria oficial e simule apenas confrontos CPU x
                  CPU pendentes.
                </p>
              </div>
            </div>
            <form id="cpuSimulationForm">
              <div className="form-grid">
                <label>
                  Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label>
                  Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Simular semana
                </button>
                <span className="app-message" id="cpuSimulationMessage"></span>
              </div>
              <div className="simulation-preview" id="cpuSimulationPreview">
                <div className="sim-preview-empty">
                  Informe ou selecione uma semana para carregar a auditoria CPU
                  x CPU.
                </div>
              </div>
            </form>
          </section>
        </section>
        <datalist id="teamOptions"></datalist>
      </section>
    </>
  );
}

function CalendarResultModal() {
  return (
    <>
      <section
        className="result-modal"
        id="calendarResultModal"
        aria-hidden="true"
      >
        <div className="result-modal-backdrop" data-close-result-modal></div>
        <article
          className="result-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendarResultModalTitle"
        >
          <button
            className="result-modal-close"
            type="button"
            data-close-result-modal
          >
            ×
          </button>
          <div className="result-modal-header">
            <span className="modal-kicker">
              Enviar resultado pelo calendário
            </span>
            <h2 id="calendarResultModalTitle">Resultado da partida</h2>
            <p id="calendarResultModalSubtitle">
              Preencha o placar para atualizar a liga.
            </p>
          </div>

          <form id="calendarResultForm">
            <input type="hidden" name="competition" />
            <input type="hidden" name="week" />
            <input type="hidden" name="phase" />
            <input type="hidden" name="home" />
            <input type="hidden" name="away" />

            <div
              className="modal-match-preview"
              id="calendarResultMatchPreview"
            ></div>

            <div className="form-grid">
              <label>
                Gols mandante
                <input name="homeScore" type="number" min="0" required />
              </label>
              <label>
                Gols visitante
                <input name="awayScore" type="number" min="0" required />
              </label>
              <label>
                Enviado por
                <select name="submittedBy" required>
                  <option value="Henrique">Henrique</option>
                  <option value="Willian">Willian</option>
                  <option value="Rafael">Rafael</option>
                  <option value="Renato">Renato</option>
                  <option value="Bruno Silva">Bruno Silva</option>
                </select>
              </label>

              <div className="penalty-section full" data-penalty-section hidden>
                <label className="checkbox-row">
                  <input name="hasPenalties" type="checkbox" value="yes" />
                  <span>Houve disputa de pênaltis?</span>
                </label>
                <div className="penalty-fields" data-penalty-fields hidden>
                  <label>
                    Vencedor nos pênaltis
                    <input
                      name="penaltyWinner"
                      list="teamOptions"
                      type="text"
                      placeholder="Ex: Middlesbrough"
                    />
                  </label>
                  <label>
                    Placar dos pênaltis
                    <input
                      name="penaltyScore"
                      type="text"
                      placeholder="Ex: 4 x 3"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                Salvar resultado
              </button>
              <span className="app-message" id="calendarResultMessage"></span>
            </div>
          </form>
        </article>
      </section>
    </>
  );
}

export function StaticShell() {
  return (
    <>
      <GlobalLoader />
      <main className="app">
        <ShellChrome />
        <StandingsView />
        <CalendarView />
        <CupsView />
        <PlayersView />
        <EventsView />
        <ExperienceView />
        <TransfersView />
        <CommissionerView />
        <SubmitView />
        <CalendarResultModal />
      </main>
    </>
  );
}

export default StaticShell;
