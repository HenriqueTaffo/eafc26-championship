const legacyShellHtml = String.raw`

    <div
      id="globalLoader"
      class="global-loader is-visible"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div id="globalLoaderCard" class="loader-card loader-card-match">
        <div id="globalLoaderChip" class="loader-chip">Montando a rodada</div>
        <div id="globalLoaderSpeech" class="loader-speech" aria-hidden="true">
          Conferindo a rodada...
        </div>

        <div class="loader-stage" aria-hidden="true">
          <div class="loader-shadow"></div>
          <div class="loader-sweat"></div>
          <div class="loader-scan-line"></div>

          <div class="loader-mascot-wrap">
            <div class="loader-ring"></div>
            <div class="loader-orbit"></div>
            <img
              class="loader-mascot"
              src="./assets/mistura-mascot.png?v=20260524-sponsor-icons-v1"
              alt=""
            />
          </div>

          <div class="loader-tactical-board"><i></i><i></i><i></i></div>

          <div class="loader-market-card">
            <span id="globalLoaderMarketLabel">Scout report</span>
            <b id="globalLoaderMarketValue">OVR 87?</b>
            <span id="globalLoaderMarketDetail">taxa subindo...</span>
          </div>

          <div class="loader-chaos-list">
            <span id="globalLoaderChaosItem1">conferindo lesÃµes</span>
            <span id="globalLoaderChaosItem2">validando mercado</span>
            <span id="globalLoaderChaosItem3">organizando bastidores</span>
          </div>
        </div>

        <div class="loader-copy">
          <strong id="globalLoaderTitle">Carregando dados da liga</strong>
          <span id="globalLoaderText"
            >Aguarde enquanto a classificaÃ§Ã£o, o calendÃ¡rio e os painÃ©is sÃ£o
            atualizados.</span
          >
        </div>
      </div>
    </div>
    <main class="app">
      <header class="hero league-hero">
        <div class="league-seal" aria-hidden="true">
          <div class="league-seal-ring">
            <span class="seal-top">MISTURA</span>
            <img src="./assets/mistura-mascot.png?v=20260524-sponsor-icons-v1" alt="" />
            <span class="seal-left">20</span>
            <span class="seal-right">24</span>
            <span class="seal-bottom">MANAGERS LEAGUE</span>
          </div>
        </div>
        <div class="league-hero-divider" aria-hidden="true"></div>
        <div class="league-hero-copy">
          <h1>Mistura Managers League</h1>
          <p>
            CompetiÃ§Ã£o oficial de managers. PaixÃ£o, estratÃ©gia e glÃ³ria em uma
            liga com identidade prÃ³pria.
          </p>
        </div>
      </header>

      <section id="managerLoginPanel" class="manager-login-panel"></section>
      <section id="transferProposalPanel" class="decision-center"></section>

      <nav class="tabs" aria-label="NavegaÃ§Ã£o principal">
        <button class="tab-button active" data-view="standingsView">
          <span class="tab-icon">â™œ</span>ClassificaÃ§Ã£o
        </button>
        <button class="tab-button" data-view="calendarView">
          <span class="tab-icon">â–¦</span>CalendÃ¡rio
        </button>
        <button class="tab-button" data-view="cupsView">
          <span class="tab-icon">ðŸ†</span>Copas
        </button>
        <button class="tab-button" data-view="playersView">
          <span class="tab-icon">â–£</span>EscritÃ³rio
        </button>
        <button class="tab-button" data-view="experienceView">
          <span class="tab-icon">â—‡</span>InteligÃªncia
        </button>
        <button class="tab-button" data-view="eventsView">
          <span class="tab-icon">âœ¦</span>Eventos
        </button>
        <button class="tab-button" data-view="transfersView">
          <span class="tab-icon">â‡„</span>TransferÃªncias
        </button>
        <button class="tab-button" data-view="commissionerView">
          <span class="tab-icon">âš–</span>ComissÃ¡rio
        </button>
        <button class="tab-button" data-view="submitView">
          <span class="tab-icon">â˜</span>Enviar dados
        </button>
      </nav>

      <section class="app-status-bar" aria-live="polite">
        <span id="syncStatusText">Sincronizando dados da liga...</span>
        <div class="global-search" data-global-search>
          <input
            id="globalSearchInput"
            type="search"
            placeholder="Buscar jogo, tÃ©cnico, jogador..."
            autocomplete="off"
            aria-label="Busca global da liga"
          />
          <div
            id="globalSearchResults"
            class="global-search-results"
            role="listbox"
            aria-label="Resultados da busca global"
          ></div>
        </div>
        <button type="button" data-manual-sync>Sincronizar agora</button>
      </section>

      <section id="standingsView" class="view active">
        <section class="summary home-summary" id="standingsSummary"></section>

        <section class="round-center" id="roundCenter"></section>

        <section class="attention-panel" id="attentionPanel"></section>

        <section id="leagueNewsPanel" class="league-news-panel"></section>

        <section class="home-grid">
          <article class="home-panel home-standings-panel">
            <div class="home-panel-header">
              <h2>ClassificaÃ§Ã£o geral</h2>
            </div>
            <div class="home-standings-table-wrap">
              <table class="home-standings-table">
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
              class="home-link"
              type="button"
              data-scroll-target="standingsFullBlock"
            >
              Ver classificaÃ§Ã£o completa <span>â€º</span>
            </button>
          </article>

          <article class="home-panel home-next-panel">
            <div class="home-panel-header">
              <h2>PrÃ³ximos jogos</h2>
            </div>
            <div class="next-games-list" id="homeNextGames"></div>
            <button
              class="home-link"
              type="button"
              data-view-target="calendarView"
            >
              Ver calendÃ¡rio completo <span>â€º</span>
            </button>
          </article>
        </section>

        <section class="home-cup-card">
          <div class="cup-icon">ðŸ†</div>
          <div>
            <h2>Copas oficiais</h2>
            <p>Carabao Cup e The Emirates FA Cup: chaveamento, prÃ³ximos jogos e classificaÃ§Ã£o.</p>
          </div>
          <button type="button" class="cup-action" data-view-target="cupsView">
            Ver copas <span>â€º</span>
          </button>
        </section>

        <section class="activity-panel" id="activityPanel"></section>

        <section class="legend-block compact-legend">
          <p class="legend-title">Legendas de classificaÃ§Ã£o</p>
          <div class="legend">
            <span class="badge"
              ><span class="dot promotion"></span>Acesso direto</span
            >
            <span class="badge"><span class="dot playoff"></span>Playoffs</span>
            <span class="badge"
              ><span class="dot relegation"></span>Rebaixamento</span
            >
            <span class="badge"
              ><span class="dot ours"></span>Times com tÃ©cnico</span
            >
          </div>
        </section>

        <section id="standingsFullBlock" class="full-standings-block">
          <div class="home-panel-header">
            <h2>Tabela completa</h2>
          </div>
          <section class="table-wrapper">
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
          <section class="mobile-list" id="standingsMobile"></section>
        </section>
      </section>

      <section id="calendarView" class="view">
        <section class="summary" id="calendarSummary"></section>
        <section class="controls">
          <input
            id="calendarSearchInput"
            type="search"
            placeholder="Buscar time, competiÃ§Ã£o, rodada ou tÃ©cnico..."
          />
          <select id="calendarCompetitionFilter">
            <option value="all">Todas as competiÃ§Ãµes</option>
            <option value="Championship">Championship</option>
            <option value="Copa da Liga">Carabao Cup</option>
            <option value="FA Cup">The Emirates FA Cup</option>
          </select>
          <select id="calendarOwnerFilter">
            <option value="all">Todos os tÃ©cnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
            <option value="human">Apenas jogos com tÃ©cnico</option>
            <option value="human-vs-human">TÃ©cnico x TÃ©cnico</option>
            <option value="cpu">CPU x CPU</option>
          </select>
          <select id="calendarWeekFilter">
            <option value="all">Todas as semanas</option>
          </select>
          <select id="calendarStatusFilter">
            <option value="pending" selected>Somente pendentes</option>
            <option value="next">PrÃ³ximos 30 jogos</option>
            <option value="done">Somente realizados</option>
            <option value="all">Todos os jogos</option>
          </select>
        </section>
        <section class="legend-block">
          <p class="legend-title">Destaques</p>
          <div class="legend">
            <span class="badge"
              ><span class="dot ours"></span>Jogo com tÃ©cnico</span
            >
            <span class="badge"><span class="dot pending"></span>Pendente</span>
            <span class="badge"><span class="dot done"></span>Realizado</span>
          </div>
        </section>
        <section class="calendar-week-board" id="calendarWeekBoard"></section>
        <section
          class="calendar-month-board"
          id="calendarBoard"
          aria-live="polite"
        ></section>
      </section>

      <section id="cupsView" class="view">
        <section class="summary" id="cupsSummary"></section>
        <section class="controls">
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
        <section class="legend-block">
          <p class="legend-title">Chaveamento das copas</p>
          <div class="legend">
            <span class="badge"
              ><span class="dot league-cup"></span>Carabao Cup</span
            >
            <span class="badge"
              ><span class="dot fa-cup"></span>The Emirates FA Cup</span
            >
            <span class="badge"
              ><span class="dot promotion"></span>Classificado</span
            >
          </div>
        </section>
        <section class="cup-prize-card">
          <div>
            <span class="modal-kicker">PremiaÃ§Ã£o das copas</span>
            <h2>BÃ´nus por avanÃ§o de fase</h2>
            <p>
              AlÃ©m da bilheteria, cada tÃ©cnico recebe orÃ§amento extra quando seu
              time avanÃ§a nas copas.
            </p>
          </div>
          <div class="cup-prize-grid">
            <span>Fase inicial <strong>+â‚¬ 1M</strong></span>
            <span>Oitavas <strong>+â‚¬ 3M</strong></span>
            <span>Quartas <strong>+â‚¬ 5M</strong></span>
            <span>Semifinal <strong>+â‚¬ 8M</strong></span>
            <span>CampeÃ£o <strong>+â‚¬ 12M</strong></span>
          </div>
        </section>
        <section id="cupsBracket"></section>
      </section>

      <section id="playersView" class="view">
        <section class="summary" id="playersSummary"></section>
        <section class="controls">
          <input
            id="playersSearchInput"
            type="search"
            placeholder="Buscar tÃ©cnico, jogador, time, e-mail ou prÃ³ximo jogo..."
          />
          <select id="playersFilter">
            <option value="all">Todos os tÃ©cnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
        </section>
        <section class="player-grid" id="playersGrid"></section>
        <section class="leaderboard-grid">
          <article class="leaderboard-card">
            <h2>Gols por time</h2>
            <div id="topScorers"></div>
          </article>
          <article class="leaderboard-card">
            <h2>Top 5 transferÃªncias mais caras</h2>
            <div id="topAssists"></div>
          </article>
        </section>
        <p class="footer-note">
          Os gols por time consideram apenas os clubes controlados por tÃ©cnicos.
          A lista ao lado mostra as cinco contrataÃ§Ãµes mais caras aprovadas atÃ©
          agora.
        </p>
      </section>

      <section id="eventsView" class="view">
        <section class="summary" id="eventsSummary"></section>
        <section class="countdown-card events-command-card">
          <div>
            <span>Central de Eventos</span>
            <strong id="nextEventCountdown">Calculando...</strong>
            <p>
              A sala do caos da liga: dinheiro inesperado, puniÃ§Ãµes, lesÃµes,
              travas de mercado e premiaÃ§Ãµes aparecem aqui com impacto direto
              nos tÃ©cnicos.
            </p>
          </div>
          <div
            class="event-slot-list"
            id="eventSlotList"
            aria-label="HorÃ¡rios de eventos"
          ></div>
        </section>
        <section class="controls">
          <input
            id="eventsSearchInput"
            type="search"
            placeholder="Buscar evento, jogador ou efeito..."
          />
          <select id="eventsOwnerFilter">
            <option value="all">Todos os tÃ©cnicos</option>
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
          <select id="eventsPeriodFilter">
            <option value="latest" selected>Ãšltima rodada</option>
            <option value="active">Ativos / em duraÃ§Ã£o</option>
            <option value="today">Todos de hoje</option>
            <option value="last12">Ãšltimos 12</option>
            <option value="all">HistÃ³rico completo</option>
          </select>
        </section>
        <section class="form-card events-intro-card">
          <div>
            <h2>Radar da Liga</h2>
            <p>
              Por padrÃ£o, exibimos a Ãºltima rodada para manter a tela leve. Use
              os filtros para investigar histÃ³rico, lesÃµes ativas, puniÃ§Ãµes de
              mercado, premiaÃ§Ãµes e impactos financeiros.
            </p>
          </div>
          <div class="event-legend-pills">
            <span>ðŸ’° Caixa</span>
            <span>ðŸš‘ DM</span>
            <span>ðŸ”’ Mercado</span>
            <span>ðŸ† Copas</span>
            <span>âš ï¸ PuniÃ§Ãµes</span>
          </div>
          <span class="app-message" id="eventsMessage"></span>
        </section>
        <section class="event-grid" id="eventsGrid"></section>
        <p class="footer-note">
          Central de eventos v45: lanÃ§amentos financeiros entram no orÃ§amento
          automaticamente; mercado, lesÃµes e puniÃ§Ãµes aparecem com duraÃ§Ã£o e
          impacto destacado para cada tÃ©cnico.
        </p>
      </section>

      <section id="experienceView" class="view">
        <section class="summary" id="experienceSummary"></section>
        <section class="submit-hero experience-hero">
          <div>
            <span class="modal-kicker">Sala de anÃ¡lise</span>
            <h2>Central de InteligÃªncia</h2>
            <p>
              DiagnÃ³stico operacional da liga: aÃ§Ãµes urgentes, risco financeiro,
              rodada de impacto e postura recomendada para cada tÃ©cnico.
            </p>
          </div>
          <div class="submit-hero-actions">
            <a href="#intelligenceQueue">Fila de aÃ§Ã£o</a>
            <a href="#intelligencePower">Power index</a>
            <a href="#intelligenceMarket">Mercado</a>
          </div>
        </section>
        <section class="experience-grid" id="experienceGrid"></section>
      </section>

      <section id="transfersView" class="view">
        <section class="summary" id="transferSummary"></section>
        <section class="countdown-card">
          <span>Janela de transferÃªncias</span>
          <strong id="nextTransferCountdown">Calculando...</strong>
          <p>
            O limite diÃ¡rio reinicia Ã  meia-noite. Eventos podem aumentar ou
            reduzir o limite do dia.
          </p>
        </section>

        <section
          class="transfer-budget-board"
          id="transferBudgetBoard"
        ></section>

        <section class="transfer-workbench">
          <section class="form-card submit-card submit-card-transfer">
            <div class="submit-card-header">
              <span class="submit-card-icon">â‡„</span>
              <div>
                <h2>Registrar transferÃªncia</h2>
                <p>
                  Mercado externo, negociaÃ§Ã£o entre tÃ©cnicos e troca de jogador
                  no mesmo fluxo.
                </p>
              </div>
            </div>
            <form id="transferForm">
              <div class="form-grid">
                <div
                  class="submit-mode-switch full"
                  aria-label="Tipo de transferÃªncia"
                >
                  <label>
                    <input
                      name="transferType"
                      type="radio"
                      value="market"
                      checked
                    />
                    <span>Mercado externo</span>
                  </label>
                  <label>
                    <input name="transferType" type="radio" value="internal" />
                    <span>Entre tÃ©cnicos</span>
                  </label>
                </div>
                <label
                  >Comprador
                  <select name="buyer" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  class="internal-transfer-field"
                  data-internal-transfer-field
                  hidden
                  >Vendedor
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
                  class="internal-transfer-field full"
                  data-internal-transfer-field
                  hidden
                  >Jogador do vendedor
                  <select id="internalTransferPlayer" name="internalPlayer">
                    <option value="">Escolha vendedor e jogador</option>
                  </select>
                </label>
                <label class="full" data-market-transfer-field
                  >Buscar jogador no mercado
                  <input
                    id="marketPlayerSearch"
                    type="search"
                    placeholder="Digite nome, clube, liga ou posiÃ§Ã£o..."
                    autocomplete="off"
                  />
                </label>
                <div
                  class="market-player-toolbar full"
                  data-market-transfer-field
                >
                  <span
                    >Por padrÃ£o, jogadores jÃ¡ contratados ficam
                    escondidos.</span
                  >
                  <label class="market-toggle">
                    <input id="showContractedPlayers" type="checkbox" />
                    <span>Mostrar jÃ¡ contratados</span>
                  </label>
                </div>
                <div
                  class="market-player-results full"
                  id="marketPlayerResults"
                  data-market-transfer-field
                >
                  <div class="market-empty">
                    Digite o nome, clube, liga ou posiÃ§Ã£o para buscar jogadores.
                  </div>
                </div>
                <div
                  class="transfer-exchange-box full"
                  data-market-transfer-field
                >
                  <div class="transfer-exchange-copy">
                    <span>Troca na negociaÃ§Ã£o</span>
                    <strong>Jogador + dinheiro</strong>
                    <small id="transferExchangeHint"
                      >Opcional. O abatimento aparece na prÃ©via antes do
                      envio.</small
                    >
                  </div>
                  <label class="transfer-exchange-control">
                    <span>Jogador oferecido</span>
                    <select id="transferExchangePlayer" name="exchangePlayer">
                      <option value="">Sem jogador na troca</option>
                    </select>
                  </label>
                </div>
                <label
                  >Jogador
                  <input
                    name="player"
                    type="text"
                    placeholder="Nome do jogador"
                    required
                  />
                </label>
                <label
                  >Clube origem
                  <input
                    name="fromClub"
                    type="text"
                    placeholder="Clube atual"
                    required
                  />
                </label>
                <label
                  >Overall EAFC
                  <input
                    name="overall"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="Ex: 82"
                    required
                  />
                </label>
                <label class="full"
                  ><span id="transferValueLabel">Valor Transfermarkt</span>
                  <input
                    name="marketValue"
                    type="number"
                    min="0"
                    step="1"
                    inputmode="numeric"
                    placeholder="Ex: 32000000"
                    required
                  />
                </label>
              </div>

              <div class="transfer-live-preview" id="transferFormPreview">
                <strong>PrÃ©via da contrataÃ§Ã£o</strong>
                <span
                  >Preencha comprador, jogador, overall e valor para calcular
                  custo final, saldo e travas antes de enviar.</span
                >
              </div>

              <label class="checkbox-row transfer-confirmation-row">
                <input
                  name="confirmTransferBuyer"
                  type="checkbox"
                  value="yes"
                  required
                />
                <span
                  >Confirmo que o comprador selecionado estÃ¡ correto e assumo
                  esta contrataÃ§Ã£o para esse tÃ©cnico.</span
                >
              </label>

              <div class="form-actions">
                <button class="primary-button" type="submit">
                  Enviar transferÃªncia
                </button>
                <span class="app-message" id="transferMessage"></span>
              </div>
            </form>
          </section>
        </section>

        <section class="controls">
          <input
            id="transferSearchInput"
            type="search"
            placeholder="Buscar jogador, tÃ©cnico, destino ou clube..."
          />
          <select id="transferOwnerFilter">
            <option value="all">Todos os tÃ©cnicos/destinos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
          <select id="transferStatusFilter">
            <option value="all">Todos os status</option>
            <option value="valid">VÃ¡lidas</option>
            <option value="sale">Vendas CPU</option>
            <option value="duplicate">Duplicadas</option>
          </select>
        </section>
        <section class="transfer-insights" id="transferInsights"></section>

        <section class="rule-card">
          <h2>Regras de transferÃªncia</h2>
          <ul>
            <li>OrÃ§amento base por jogador: <strong>65 milhÃµes</strong>.</li>
            <li>
              Receita semanal: <strong>+2M</strong> por semana ativa da
              temporada.
            </li>
            <li>
              BÃ´nus por mando: <strong>+1,5M</strong> por partida em casa.
            </li>
            <li>BÃ´nus por vitÃ³ria: <strong>+1,25M</strong> por vitÃ³ria.</li>
            <li>
              BÃ´nus de campanha: blocos de 5 jogos rendem atÃ©
              <strong>+5M</strong> conforme pontuaÃ§Ã£o.
            </li>
            <li>Eventos financeiros podem aumentar ou reduzir o orÃ§amento.</li>
            <li>Copas geram premiaÃ§Ã£o automÃ¡tica por avanÃ§o de fase.</li>
            <li>
              Limite base: <strong>3 transferÃªncias por dia</strong>. Eventos
              podem alterar esse limite.
            </li>
            <li>Valor final = valor Transfermarkt + percentual por overall.</li>
          </ul>
        </section>
        <section class="table-wrapper">
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
        <section class="mobile-list" id="transferMobile"></section>
        <p class="footer-note">
          Mostrando apenas as 5 movimentaÃ§Ãµes aprovadas mais recentes.
        </p>
      </section>

      <section id="commissionerView" class="view">
        <section
          class="summary commissioner-summary"
          id="commissionerSummary"
        ></section>
        <section class="submit-hero commissioner-hero">
          <div>
            <span class="modal-kicker">GovernanÃ§a da liga</span>
            <h2>Mesa do comissÃ¡rio</h2>
            <p>
              LeilÃµes, centro mÃ©dico, fair play, fechamento semanal e aÃ§Ãµes
              especiais para manter a temporada divertida e controlada.
            </p>
          </div>
          <div class="submit-hero-actions">
            <a href="#commissionerAuctions">LeilÃµes</a>
            <a href="#commissionerMedical">Centro mÃ©dico</a>
            <a href="#commissionerWeekly">Semana</a>
          </div>
        </section>
        <section class="commissioner-grid" id="commissionerGrid"></section>
        <span class="app-message" id="commissionerMessage"></span>
      </section>

      <section id="submitView" class="view">
        <section class="submit-hero">
          <div>
            <span class="modal-kicker">Central de lanÃ§amentos</span>
            <h2>Enviar dados da liga</h2>
            <p>
              Resultados oficiais e simulaÃ§Ãµes CPU x CPU em uma tela mais
              direta.
            </p>
          </div>
          <div class="submit-hero-actions">
            <a href="#resultForm">Resultado</a>
            <a href="#cpuSimulationForm">CPU x CPU</a>
          </div>
        </section>

        <section class="submit-form-grid">
          <section class="form-card submit-card submit-card-result">
            <div class="submit-card-header">
              <span class="submit-card-icon">â–¦</span>
              <div>
                <h2>Enviar resultado</h2>
                <p>
                  Registre placares. Em jogos de copa empatados, informe o
                  vencedor nos pÃªnaltis.
                </p>
              </div>
            </div>
            <form id="resultForm">
              <div class="form-grid">
                <label
                  >CompetiÃ§Ã£o
                  <select name="competition" required>
                    <option value="Championship">Championship</option>
                    <option value="Copa da Liga">Carabao Cup</option>
                    <option value="FA Cup">The Emirates FA Cup</option>
                  </select>
                </label>
                <label
                  >Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label
                  >Rodada/Fase
                  <input
                    name="phase"
                    type="text"
                    placeholder="Ex: Rodada 1"
                    required
                  />
                </label>
                <label
                  >Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  >Mandante
                  <input
                    name="home"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Coventry City"
                    required
                  />
                </label>
                <label
                  >Visitante
                  <input
                    name="away"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Birmingham City"
                    required
                  />
                </label>
                <label
                  >Gols mandante
                  <input name="homeScore" type="number" min="0" required />
                </label>
                <label
                  >Gols visitante
                  <input name="awayScore" type="number" min="0" required />
                </label>
                <div class="penalty-section full" data-penalty-section hidden>
                  <label class="checkbox-row">
                    <input name="hasPenalties" type="checkbox" value="yes" />
                    <span>Houve disputa de pÃªnaltis?</span>
                  </label>
                  <div class="penalty-fields" data-penalty-fields hidden>
                    <label
                      >Vencedor nos pÃªnaltis
                      <input
                        name="penaltyWinner"
                        list="teamOptions"
                        type="text"
                        placeholder="Ex: Middlesbrough"
                      />
                    </label>
                    <label
                      >Placar dos pÃªnaltis
                      <input
                        name="penaltyScore"
                        type="text"
                        placeholder="Ex: 4 x 3"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div class="form-actions">
                <button class="primary-button" type="submit">
                  Enviar resultado
                </button>
                <span class="app-message" id="resultMessage"></span>
              </div>
            </form>
          </section>

          <section class="form-card submit-card submit-card-cpu">
            <div class="submit-card-header">
              <span class="submit-card-icon">â˜</span>
              <div>
                <h2>Simular CPU x CPU da semana</h2>
                <p>
                  Confira a auditoria oficial e simule apenas confrontos CPU x
                  CPU pendentes.
                </p>
              </div>
            </div>
            <form id="cpuSimulationForm">
              <div class="form-grid">
                <label
                  >Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label
                  >Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
              </div>
              <div class="form-actions">
                <button class="primary-button" type="submit">
                  Simular semana
                </button>
                <span class="app-message" id="cpuSimulationMessage"></span>
              </div>
              <div class="simulation-preview" id="cpuSimulationPreview">
                <div class="sim-preview-empty">
                  Informe ou selecione uma semana para carregar a auditoria CPU x
                  CPU.
                </div>
              </div>
            </form>
          </section>
        </section>
        <datalist id="teamOptions"></datalist>
      </section>

      <section class="result-modal" id="calendarResultModal" aria-hidden="true">
        <div class="result-modal-backdrop" data-close-result-modal></div>
        <article
          class="result-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendarResultModalTitle"
        >
          <button
            class="result-modal-close"
            type="button"
            data-close-result-modal
          >
            Ã—
          </button>
          <div class="result-modal-header">
            <span class="modal-kicker">Enviar resultado pelo calendÃ¡rio</span>
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
              class="modal-match-preview"
              id="calendarResultMatchPreview"
            ></div>

            <div class="form-grid">
              <label
                >Gols mandante
                <input name="homeScore" type="number" min="0" required />
              </label>
              <label
                >Gols visitante
                <input name="awayScore" type="number" min="0" required />
              </label>
              <label
                >Enviado por
                <select name="submittedBy" required>
                  <option value="Henrique">Henrique</option>
                  <option value="Willian">Willian</option>
                  <option value="Rafael">Rafael</option>
                  <option value="Renato">Renato</option>
                  <option value="Bruno Silva">Bruno Silva</option>
                </select>
              </label>

              <div class="penalty-section full" data-penalty-section hidden>
                <label class="checkbox-row">
                  <input name="hasPenalties" type="checkbox" value="yes" />
                  <span>Houve disputa de pÃªnaltis?</span>
                </label>
                <div class="penalty-fields" data-penalty-fields hidden>
                  <label
                    >Vencedor nos pÃªnaltis
                    <input
                      name="penaltyWinner"
                      list="teamOptions"
                      type="text"
                      placeholder="Ex: Middlesbrough"
                    />
                  </label>
                  <label
                    >Placar dos pÃªnaltis
                    <input
                      name="penaltyScore"
                      type="text"
                      placeholder="Ex: 4 x 3"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button class="primary-button" type="submit">
                Salvar resultado
              </button>
              <span class="app-message" id="calendarResultMessage"></span>
            </div>
          </form>
        </article>
      </section>
    </main>
`;

const cp1252Bytes = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f
};

function repairLegacyText(value) {
  if (!/[ÃÂâð]/.test(value)) return value;

  const bytes = [];
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    if (cp1252Bytes[character] !== undefined) {
      bytes.push(cp1252Bytes[character]);
      continue;
    }

    return value;
  }

  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch (error) {
    return value;
  }
}

export default repairLegacyText(legacyShellHtml);

