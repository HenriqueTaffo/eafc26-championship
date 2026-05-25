import App from "./app.js";

const SHORTLIST_STAGES = [
  "Prioridade alta",
  "Monitorando",
  "Proposta pronta",
  "Negociando",
  "Perdido",
];

const SHORTLIST_STAGE_META = {
  "prioridade alta": {
    label: "Prioridade alta",
    tone: "hot",
    hint: "Alvo para atacar agora.",
  },
  monitorando: {
    label: "Monitorando",
    tone: "watch",
    hint: "Ainda em observacao.",
  },
  "proposta pronta": {
    label: "Proposta pronta",
    tone: "ready",
    hint: "Ja vale montar oferta.",
  },
  negociando: {
    label: "Negociando",
    tone: "live",
    hint: "Existe tratativa em curso.",
  },
  perdido: {
    label: "Perdido",
    tone: "cold",
    hint: "Saiu do radar por enquanto.",
  },
};

const POSITION_GROUPS = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LCB: "DEF",
  RCB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  LDM: "MID",
  RDM: "MID",
  CM: "MID",
  LCM: "MID",
  RCM: "MID",
  CAM: "MID",
  LAM: "MID",
  RAM: "MID",
  LM: "ATT",
  RM: "ATT",
  LW: "ATT",
  RW: "ATT",
  LF: "ATT",
  RF: "ATT",
  CF: "ATT",
  ST: "ATT",
  LS: "ATT",
  RS: "ATT",
};

const POSITION_ALIASES = {
  GOALKEEPER: "GK",
  "CENTER BACK": "CB",
  "CENTRE BACK": "CB",
  "LEFT BACK": "LB",
  "RIGHT BACK": "RB",
  "LEFT WING BACK": "LWB",
  "RIGHT WING BACK": "RWB",
  "CENTER DEFENSIVE MIDFIELDER": "CDM",
  "CENTRE DEFENSIVE MIDFIELDER": "CDM",
  "DEFENSIVE MIDFIELDER": "CDM",
  "CENTER MIDFIELDER": "CM",
  "CENTRE MIDFIELDER": "CM",
  "MIDFIELDER": "CM",
  "CENTER ATTACKING MIDFIELDER": "CAM",
  "CENTRE ATTACKING MIDFIELDER": "CAM",
  "ATTACKING MIDFIELDER": "CAM",
  "LEFT MIDFIELDER": "LM",
  "RIGHT MIDFIELDER": "RM",
  "LEFT WING": "LW",
  "RIGHT WING": "RW",
  "CENTER FORWARD": "CF",
  "CENTRE FORWARD": "CF",
  STRIKER: "ST",
};

const POSITION_LABELS = {
  GK: "Goleiro",
  DEF: "Defesa",
  MID: "Meio",
  ATT: "Ataque",
};

const MAX_COMPARE_ITEMS = 3;

function getWorkspaceDefaults() {
  return {
    compare: [],
  };
}

function normalizeStage(value = "") {
  const normalized = App.utils.normalizeText(value);
  return SHORTLIST_STAGE_META[normalized]?.label || "Monitorando";
}

function getPositionCode(position = "") {
  const normalized = String(position || "")
    .trim()
    .toUpperCase()
    .replaceAll(".", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";
  if (POSITION_GROUPS[normalized]) return normalized;
  if (POSITION_ALIASES[normalized]) return POSITION_ALIASES[normalized];

  const tokenMatch = normalized
    .split(/[^A-Z]+/)
    .filter(Boolean)
    .reverse()
    .find((token) => POSITION_GROUPS[token]);
  if (tokenMatch) return tokenMatch;

  const aliasMatch = Object.entries(POSITION_ALIASES).find(([label]) =>
    normalized.includes(label),
  );
  return aliasMatch?.[1] || normalized;
}

function getPositionGroup(position = "") {
  const code = getPositionCode(position);
  return POSITION_GROUPS[code] || "ATT";
}

function getPositionLabel(group = "") {
  return POSITION_LABELS[group] || "Elenco";
}

function serializeCandidate(candidate = {}) {
  try {
    return encodeURIComponent(JSON.stringify(candidate));
  } catch (error) {
    return "";
  }
}

function parseCandidate(raw = "") {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (error) {
    return null;
  }
}

function sanitizeCandidate(candidate = {}) {
  if (!candidate || !candidate.player) return null;

  return {
    key:
      candidate.key ||
      [
        App.transfers.normalizePlayerRatingKey(candidate.player),
        App.transfers.normalizePlayerRatingKey(candidate.club || candidate.fromClub),
      ]
        .filter(Boolean)
        .join("|"),
    player: String(candidate.player || "").trim(),
    club: String(candidate.club || candidate.fromClub || "").trim(),
    fromClub: String(candidate.fromClub || candidate.club || "").trim(),
    buyer: String(candidate.buyer || "").trim(),
    seller: String(candidate.seller || "").trim(),
    position: getPositionCode(candidate.position || ""),
    league: String(candidate.league || "").trim(),
    overall: Number(candidate.overall || 0) || 0,
    marketValue: Number(candidate.marketValue || 0) || 0,
    finalValue: Number(candidate.finalValue || 0) || 0,
    weeklySalary: Number(candidate.weeklySalary || 0) || 0,
    salarySourceName: String(candidate.salarySourceName || "").trim(),
    salarySourceUrl: String(candidate.salarySourceUrl || "").trim(),
    age: Number(candidate.age || 0) || 0,
    source: String(candidate.source || "market").trim(),
    note: String(candidate.note || "").trim(),
  };
}

function renderWorkspacePill(label = "", tone = "") {
  return `<span class="transfer-pill ${tone ? `is-${tone}` : ""}">${App.utils.escapeHtml(label)}</span>`;
}

function renderWorkspaceEmpty(title, text) {
  return `
    <div class="transfer-workspace-empty">
      <strong>${App.utils.escapeHtml(title)}</strong>
      <p>${App.utils.escapeHtml(text)}</p>
    </div>
  `;
}

Object.assign(App.transfers, {
  compareLimit: MAX_COMPARE_ITEMS,
  shortlistStages: SHORTLIST_STAGES,

  getWorkspaceStorageKey() {
    const session = App.auth?.getSession?.();
    return `mml-transfer-cockpit-v1:${session?.managerId || "anon"}`;
  },

  getWorkspaceState() {
    const key = App.transfers.getWorkspaceStorageKey();
    if (
      App.transfers.workspaceState &&
      App.transfers.workspaceStateKey === key
    ) {
      return App.transfers.workspaceState;
    }

    let next = getWorkspaceDefaults();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        next = { ...next, ...JSON.parse(raw) };
      }
    } catch (error) {
      next = getWorkspaceDefaults();
    }

    next.compare = Array.isArray(next.compare)
      ? next.compare.map(sanitizeCandidate).filter(Boolean)
      : [];
    App.transfers.workspaceStateKey = key;
    App.transfers.workspaceState = next;
    return next;
  },

  saveWorkspaceState() {
    const key = App.transfers.getWorkspaceStorageKey();
    const state = App.transfers.getWorkspaceState();
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn("Nao consegui salvar o cockpit local:", error);
    }
  },

  getCompareCandidates() {
    return App.transfers.getWorkspaceState().compare || [];
  },

  setCompareCandidates(candidates = []) {
    const state = App.transfers.getWorkspaceState();
    state.compare = candidates.map(sanitizeCandidate).filter(Boolean);
    App.transfers.saveWorkspaceState();
    return state.compare;
  },

  getCandidateKey(candidate = {}) {
    return (
      sanitizeCandidate(candidate)?.key ||
      [
        App.transfers.normalizePlayerRatingKey(candidate.player),
        App.transfers.normalizePlayerRatingKey(candidate.club || candidate.fromClub),
      ]
        .filter(Boolean)
        .join("|")
    );
  },

  serializeCandidate,
  parseCandidateData: parseCandidate,
  getPositionGroup,

  getPositionLabelForCandidate(candidate = {}) {
    return getPositionLabel(getPositionGroup(candidate.position));
  },

  normalizeShortlistStage(value = "") {
    return normalizeStage(value);
  },

  getShortlistStageMeta(value = "") {
    const normalized = App.utils.normalizeText(normalizeStage(value));
    return (
      SHORTLIST_STAGE_META[normalized] || SHORTLIST_STAGE_META.monitorando
    );
  },

  getShortlistTargets() {
    return Array.isArray(App.auth?.myTransferTargets)
      ? App.auth.myTransferTargets
      : [];
  },

  findShortlistTarget(candidate = {}) {
    const playerKey = App.transfers.normalizePlayerRatingKey(candidate.player);
    const clubKey = App.transfers.normalizePlayerRatingKey(
      candidate.club || candidate.fromClub,
    );
    return App.transfers.getShortlistTargets().find((item) => {
      const itemPlayerKey = App.transfers.normalizePlayerRatingKey(item.player);
      const itemClubKey = App.transfers.normalizePlayerRatingKey(item.club);
      return itemPlayerKey === playerKey && (!clubKey || itemClubKey === clubKey);
    });
  },

  buildCandidateFromTarget(target = {}) {
    const marketPlayer =
      App.transfers.findMarketPlayerByName(target.player, {
        club: target.club,
      }) || {};
    const rating =
      App.transfers.getRatingForPlayerName(target.player, {
        club: target.club,
      }) || {};

    return sanitizeCandidate({
      player: target.player,
      club: target.club || marketPlayer.club || rating.club || "",
      fromClub: target.club || marketPlayer.club || rating.club || "",
      position: rating.position || marketPlayer.position || "",
      league: marketPlayer.league || "",
      overall: Number(rating.overall || marketPlayer.overall || 0),
      marketValue: Number(
        target.value ||
          marketPlayer.market_value_eur ||
          App.transfers.getMarketPlayerValue(marketPlayer) ||
          0,
      ),
      weeklySalary: Number(
        App.transfers.getVerifiedWeeklySalary({
          ...marketPlayer,
          ...rating,
          player: target.player,
          fromClub: target.club,
          weeklySalary: target.weeklySalary,
        }) || 0,
      ),
      salarySourceName:
        target.salarySourceName ||
        App.transfers.getSalaryReferenceFromItem({
          ...marketPlayer,
          ...rating,
          player: target.player,
          fromClub: target.club,
        }).salarySourceName ||
        "",
      salarySourceUrl:
        target.salarySourceUrl ||
        App.transfers.getSalaryReferenceFromItem({
          ...marketPlayer,
          ...rating,
          player: target.player,
          fromClub: target.club,
        }).salarySourceUrl ||
        "",
      age: Number(marketPlayer.age || 0),
      source: "shortlist",
      note: target.note || "",
    });
  },

  buildCandidateFromMarketPlayer(player = {}) {
    const rating = App.transfers.findEaRatingForMarketPlayer(player) || {};
    const marketValue = App.transfers.getMarketPlayerValue(player);
    const salaryReference = App.transfers.getSalaryReferenceFromItem({
      ...player,
      overall: Number(rating.overall || player.overall || 0),
      marketValue,
    });

    return sanitizeCandidate({
      player: player.name || "",
      club: player.club || "",
      fromClub: player.club || "",
      position: rating.position || player.position || "",
      league: player.league || "",
      overall: Number(rating.overall || player.overall || 0),
      marketValue,
      weeklySalary: Number(salaryReference.weeklySalary || 0),
      salarySourceName: salaryReference.salarySourceName || "",
      salarySourceUrl: salaryReference.salarySourceUrl || "",
      age: Number(player.age || 0),
      source: "market",
    });
  },

  getCurrentCandidate(form = document.getElementById("transferForm")) {
    if (!form) return null;
    const preview = App.transfers.getTransferPreview(form);
    const playerName = form.elements.player?.value || "";
    const fromClub = form.elements.fromClub?.value || "";
    if (!playerName && !preview?.hasEnoughData) return null;

    const marketPlayer =
      App.transfers.findMarketPlayerByName(playerName, { club: fromClub }) || {};
    const rating =
      App.transfers.getRatingForPlayerName(playerName, {
        club: fromClub,
      }) || App.transfers.findEaRatingForMarketPlayer(marketPlayer) || {};

    return sanitizeCandidate({
      player: playerName,
      club: fromClub || marketPlayer.club || rating.club || "",
      fromClub: fromClub || marketPlayer.club || rating.club || "",
      buyer: preview?.buyer || form.elements.buyer?.value || "",
      seller: preview?.seller || form.elements.seller?.value || "",
      position: rating.position || marketPlayer.position || "",
      league: marketPlayer.league || "",
      overall: Number(form.elements.overall?.value || rating.overall || 0),
      marketValue: Number(
        form.elements.marketValue?.value ||
          App.transfers.getMarketPlayerValue(marketPlayer) ||
          0,
      ),
      finalValue: Number(preview?.finalValue || 0),
      weeklySalary: Number(
        preview?.weeklySalary || form.elements.weeklySalary?.value || 0,
      ),
      salarySourceName:
        preview?.salarySourceName || form.elements.salarySourceName?.value || "",
      salarySourceUrl:
        preview?.salarySourceUrl || form.elements.salarySourceUrl?.value || "",
      age: Number(marketPlayer.age || 0),
      source: App.transfers.isInternalTransferForm(form) ? "internal" : "form",
    });
  },

  addCompareCandidate(candidate = {}) {
    const clean = sanitizeCandidate(candidate);
    if (!clean) return App.transfers.getCompareCandidates();

    const current = App.transfers.getCompareCandidates();
    const existingIndex = current.findIndex(
      (item) => item.key === App.transfers.getCandidateKey(clean),
    );
    let next = current;
    if (existingIndex >= 0) {
      next = current.filter((_, index) => index !== existingIndex);
    } else {
      next = [clean, ...current].slice(0, App.transfers.compareLimit);
    }
    return App.transfers.setCompareCandidates(next);
  },

  removeCompareCandidate(candidateKey = "") {
    const next = App.transfers
      .getCompareCandidates()
      .filter((item) => item.key !== candidateKey);
    return App.transfers.setCompareCandidates(next);
  },

  clearCompareCandidates() {
    return App.transfers.setCompareCandidates([]);
  },

  async pinCandidate(candidate = {}, stage = "Monitorando") {
    const session = App.auth?.getSession?.();
    if (!session || App.auth?.isCommissioner?.()) {
      throw new Error("Faca login como tecnico para manter shortlist privada.");
    }

    const clean = sanitizeCandidate(candidate);
    if (!clean) throw new Error("Escolha um jogador antes de salvar na shortlist.");

    const existing = App.transfers.findShortlistTarget(clean);
    const targets = await App.auth.upsertMyTransferTarget({
      id: existing?.id || "",
      player: clean.player,
      club: clean.club || clean.fromClub || "",
      value: Number(clean.marketValue || clean.finalValue || 0),
      priority: normalizeStage(stage || existing?.priority || "Monitorando"),
      note: existing?.note || clean.note || "",
    });

    App.players?.savePrivateTransferTargets?.(session.managerName, targets);
    App.auth?.renderAll?.();
    return targets;
  },

  async updateShortlistStage(targetId, nextStage) {
    const target = App.transfers
      .getShortlistTargets()
      .find((item) => String(item.id) === String(targetId));
    if (!target) return [];

    return App.transfers.pinCandidate(
      App.transfers.buildCandidateFromTarget(target),
      nextStage || target.priority,
    );
  },

  async removeShortlistTarget(targetId) {
    const session = App.auth?.getSession?.();
    if (!session || App.auth?.isCommissioner?.()) {
      throw new Error("Faca login como tecnico para editar a shortlist.");
    }

    const targets = await App.auth.deleteMyTransferTarget(targetId);
    App.players?.savePrivateTransferTargets?.(session.managerName, targets);
    App.auth?.renderAll?.();
    return targets;
  },

  populateSellerOptions(form) {
    if (!form?.elements.seller) return;
    const currentValue = form.elements.seller.value;
    const buyer = form.elements.buyer?.value || "";
    const options = App.utils
      .getHumanBuyers()
      .filter((owner) => owner !== buyer)
      .sort((a, b) => a.localeCompare(b));

    App.dom.setHtml(
      form.elements.seller,
      `
        <option value="">Selecione o vendedor</option>
        ${options
          .map(
            (owner) =>
              `<option value="${App.utils.escapeHtml(owner)}">${App.utils.escapeHtml(owner)}</option>`,
          )
          .join("")}
      `,
    );

    if (options.includes(currentValue)) {
      form.elements.seller.value = currentValue;
    } else {
      form.elements.seller.value = "";
      if (form.elements.internalPlayer) form.elements.internalPlayer.value = "";
    }
  },

  syncInternalTransferFields(form) {
    if (!form) return;

    const isInternal = App.transfers.isInternalTransferForm(form);
    const marketFields = form.querySelectorAll("[data-market-transfer-field]");
    const internalFields = form.querySelectorAll(
      "[data-internal-transfer-field]",
    );
    const valueLabel = document.getElementById("transferValueLabel");
    const message = document.getElementById("transferMessage");

    App.transfers.populateSellerOptions(form);
    App.utils.setMessage(message, "", "");

    marketFields.forEach((element) => {
      element.hidden = isInternal;
    });
    internalFields.forEach((element) => {
      element.hidden = !isInternal;
    });
    if (valueLabel) {
      valueLabel.textContent = isInternal
        ? "Valor negociado entre tecnicos"
        : "Valor Transfermarkt";
    }

    if (!isInternal) {
      if (form.elements.seller) form.elements.seller.value = "";
      if (form.elements.internalPlayer) form.elements.internalPlayer.value = "";
      App.transfers.populateInternalTransferPlayers(form);
      App.transfers.populateExchangePlayers(form);
      App.transfers.refreshWorkspace(form);
      return;
    }

    App.transfers.populateInternalTransferPlayers(form);
    App.transfers.populateExchangePlayers(form);
    App.transfers.selectInternalTransferPlayer(form);
    App.transfers.refreshWorkspace(form);
  },

  populateInternalTransferPlayers(form) {
    const select = document.getElementById("internalTransferPlayer");
    if (!select || !form) return;

    const seller = form.elements.seller?.value || "";
    const players = seller
      ? App.transfers.getOwnedTransfersByBuyer(seller)
      : [];
    const currentValue = select.value;
    const firstOptionLabel = !seller
      ? "Escolha vendedor e jogador"
      : players.length
        ? "Escolha o jogador"
        : "Sem jogadores disponiveis para este tecnico";

    App.dom.setHtml(
      select,
      `
        <option value="">${firstOptionLabel}</option>
        ${players
          .map((item, index) => {
            const rating = App.transfers.getRatingForPlayerName(item.player, {
              club: item.fromClub,
            });
            const position = rating?.position ? ` - ${rating.position}` : "";
            return `
              <option value="${index}">
                ${App.utils.escapeHtml(item.player)}${App.utils.escapeHtml(position)} - ${App.utils.formatCurrency(item.totalCost)}
              </option>
            `;
          })
          .join("")}
      `,
    );

    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
    select.disabled = !players.length;
  },

  selectInternalTransferPlayer(form) {
    const select = document.getElementById("internalTransferPlayer");
    if (!select || !form || !App.transfers.isInternalTransferForm(form)) return;

    const seller = form.elements.seller?.value || "";
    const transfer = App.transfers.getInternalTransferPlayerByIndex(
      seller,
      select.value,
    );

    if (!transfer) {
      if (form.elements.player) form.elements.player.value = "";
      if (form.elements.fromClub)
        form.elements.fromClub.value = seller
          ? `Negociacao interna: ${seller}`
          : "";
      if (form.elements.overall) form.elements.overall.value = "";
      if (form.elements.marketValue) form.elements.marketValue.value = "";
      App.transfers.refreshWorkspace(form);
      return;
    }

    if (form.elements.player) form.elements.player.value = transfer.player || "";
    if (form.elements.fromClub) {
      form.elements.fromClub.value = `Negociacao interna: ${seller}`;
    }
    if (form.elements.overall) form.elements.overall.value = transfer.overall || "";
    if (form.elements.marketValue) {
      form.elements.marketValue.value = Math.round(
        Number(transfer.marketValue || transfer.totalCost || 0),
      );
    }

    App.transfers.refreshWorkspace(form);
  },

  getTransferDiagnostics(preview) {
    if (!preview?.hasEnoughData) {
      return { blocking: [], warnings: [], positive: [] };
    }

    const blocking = [];
    const warnings = [];
    const positive = [];

    if (preview.duplicateBlock) {
      blocking.push({
        key: "duplicate",
        title: "Jogador ja pertence a liga",
        detail: `Hoje ${preview.duplicate.buyer} ja controla ${preview.player}.`,
      });
      if (!preview.isInternal) {
        warnings.push({
          key: "auction",
          title: "Fluxo recomendado",
          detail: "Abra leilao automatico para formalizar a disputa.",
        });
      }
    }

    if (preview.sameBuyerAndSeller) {
      blocking.push({
        key: "same-sides",
        title: "Vendedor invalido",
        detail: "Comprador e vendedor precisam ser tecnicos diferentes.",
      });
    }

    if (preview.exchangeSamePlayer) {
      blocking.push({
        key: "same-trade",
        title: "Troca invalida",
        detail: "O jogador usado na troca nao pode ser o mesmo alvo da compra.",
      });
    }

    if (preview.salaryReferenceMissing) {
      blocking.push({
        key: "salary",
        title: "Folha indefinida",
        detail:
          "Nao foi possivel validar salario semanal publico ou regulatorio.",
      });
    }

    if (preview.marketEmbargo) {
      blocking.push({
        key: "embargo",
        title: "Mercado travado",
        detail:
          "Existe embargo por divida salarial, saldo negativo ou restricao ativa.",
      });
    }

    if (preview.limitReached) {
      blocking.push({
        key: "limit",
        title: "Limite diario batido",
        detail:
          Number(preview.budget?.transferLimit || 0) <= 0
            ? `${preview.buyer} esta sem movimentos externos hoje.`
            : `${preview.buyer} ja usou ${preview.budget.transfersToday}/${preview.budget.transferLimit} movimentos hoje.`,
      });
    }

    if (preview.overBudget) {
      blocking.push({
        key: "budget",
        title: "Saldo insuficiente",
        detail: `Faltam ${App.utils.formatCurrency(Math.abs(preview.remainingAfter))} para fechar em caixa.`,
      });
    }

    if (preview.payrollBlocked) {
      blocking.push({
        key: "payroll",
        title: "Folha acima do teto",
        detail: `Teto recomendado: ${App.utils.formatCurrency(preview.payrollCeiling)}/sem.`,
      });
    }

    if (
      preview.isInternal &&
      preview.duplicate &&
      !preview.internalSellerMismatch
    ) {
      positive.push({
        key: "internal",
        title: "Fluxo interno valido",
        detail: `${preview.seller} e o dono atual. A proposta nao consome limite diario.`,
      });
    }

    if (preview.exchangePlayer && preview.exchangeCredit > 0) {
      positive.push({
        key: "trade-credit",
        title: "Troca encaixada",
        detail: `${preview.exchangePlayer.player} gera abatimento de ${App.utils.formatCurrency(preview.exchangeCredit)} no caixa.`,
      });
    }

    if (
      !preview.isInternal &&
      (Number(preview.finalValue || 0) >= 25000000 ||
        Number(preview.overall || 0) >= 88)
    ) {
      warnings.push({
        key: "spotlight",
        title: "Negocio de alto impacto",
        detail:
          "Compra pesada. Vale alinhar no grupo ou tratar como movimento premium.",
      });
    }

    if (
      preview.runwayWeeksAfter !== null &&
      Number(preview.runwayWeeksAfter) < 3
    ) {
      warnings.push({
        key: "runway",
        title: "Caixa curto",
        detail:
          "A folha pos-compra deixa menos de tres semanas de folego financeiro.",
      });
    }

    if (!blocking.length) {
      positive.unshift({
        key: "clear",
        title: "Negocio liberado",
        detail: "Os bloqueios principais passaram. O envio pode seguir.",
      });
    }

    return { blocking, warnings, positive };
  },

  renderTransferPreview(form) {
    const target = document.getElementById("transferFormPreview");
    if (!target || !form) return;

    const preview = App.transfers.getTransferPreview(form);
    const submitButton = form.querySelector("button[type='submit']");

    if (App.transfers.isTransferWindowLocked()) {
      if (submitButton) submitButton.disabled = true;
      target.className = "transfer-live-preview danger";
      App.dom.setHtml(
        target,
        `
          <strong>Janela de transferencias fechada</strong>
          <span>${App.utils.escapeHtml(App.transfers.getTransferWindowLockMessage())}</span>
        `,
      );
      return;
    }

    if (!preview?.hasEnoughData) {
      if (submitButton && !submitButton.dataset.submitting) {
        submitButton.disabled = false;
      }
      target.className = "transfer-live-preview";
      App.dom.setHtml(
        target,
        `
          <strong>Previa da contratacao</strong>
          <span>Escolha comprador, alvo, OVR e valor para calcular custo, folha, teto e limite diario antes de enviar.</span>
        `,
      );
      return;
    }

    const diagnostics = App.transfers.getTransferDiagnostics(preview);
    const messageItems = [
      ...diagnostics.blocking.map((item) => item.detail),
      ...diagnostics.warnings.map((item) => item.detail),
      ...diagnostics.positive.map((item) => item.detail),
    ];

    if (submitButton && !submitButton.dataset.submitting) {
      submitButton.disabled = Boolean(preview.hardBlock);
    }

    const metrics = [
      { label: "OVR", value: preview.overall },
      { label: "Taxa", value: `${Math.round(Number(preview.rate || 0) * 100)}%` },
      {
        label: preview.isInternal ? "Valor negociado" : "Custo final",
        value: App.utils.formatCurrency(preview.finalValue),
      },
      ...(preview.exchangePlayer
        ? [
            {
              label: "Abatimento",
              value: App.utils.formatCurrency(preview.exchangeCredit),
              tone: "warning",
            },
            {
              label: "Caixa na mesa",
              value: App.utils.formatCurrency(preview.cashFinalValue),
            },
          ]
        : []),
      {
        label: "Saldo apos",
        value: App.utils.formatCurrency(preview.remainingAfter),
        tone: preview.remainingAfter < 0 ? "danger" : "",
      },
      {
        label: "Folha semanal",
        value: preview.salaryReferenceMissing
          ? "Pendente"
          : App.utils.formatCurrency(preview.weeklySalary),
        unit: "/sem",
        tone: preview.salaryReferenceMissing ? "danger" : "",
      },
      {
        label: "Movimentos hoje",
        value: preview.isInternal
          ? "Nao consome"
          : `${preview.budget?.transfersToday || 0}/${preview.budget?.transferLimit || 0}`,
      },
      {
        label: "Folego",
        value:
          preview.runwayWeeksAfter === null
            ? "Sem folha"
            : `${preview.runwayWeeksAfter} sem.`,
        tone:
          preview.runwayWeeksAfter !== null && preview.runwayWeeksAfter < 3
            ? "warning"
            : "",
      },
    ];

    target.className = `transfer-live-preview ${preview.hardBlock ? "danger" : "success"}`;
    App.dom.setHtml(
      target,
      `
        <div class="preview-header">
          <strong>${App.utils.escapeHtml(preview.player)}</strong>
          <span>${App.utils.escapeHtml(preview.buyer)}</span>
        </div>
        <div class="preview-grid">
          ${metrics
            .map(
              (item) => `
                <span class="preview-metric ${item.tone ? `is-${item.tone}` : ""}">
                  <small class="preview-metric-label">${App.utils.escapeHtml(item.label)}</small>
                  <span class="preview-metric-value">
                    <strong>${App.utils.escapeHtml(String(item.value))}</strong>
                    ${item.unit ? `<em>${App.utils.escapeHtml(item.unit)}</em>` : ""}
                  </span>
                </span>
              `,
            )
            .join("")}
        </div>
        <ul class="preview-alerts">
          ${messageItems
            .map((message) => `<li>${App.utils.escapeHtml(message)}</li>`)
            .join("")}
        </ul>
        ${
          preview.duplicateBlock && !preview.isInternal
            ? `<button type="button" class="secondary-button" data-open-auto-auction>Abrir leilao automatico</button>`
            : ""
        }
      `,
    );
  },

  getBuyerRosterSnapshot(buyer = "") {
    const squadData = App.state.apiSquadManagement || {};
    const roster = Array.isArray(squadData.rosters?.[buyer])
      ? squadData.rosters[buyer]
      : [];
    const lineup = squadData.lineups?.[buyer]?.lineup || {};
    const finance = (Array.isArray(squadData.finance) ? squadData.finance : []).find(
      (item) =>
        App.utils.normalizeText(item.manager_name || item.managerName) ===
        App.utils.normalizeText(buyer),
    );

    if (roster.length) {
      return { roster, lineup, finance };
    }

    const fallbackRoster = App.transfers.getOwnedTransfersByBuyer(buyer).map(
      (item, index) => {
        const rating = App.transfers.getRatingForPlayerName(item.player, {
          club: item.fromClub,
        });
        return {
          id: index + 1,
          name: item.player,
          position: rating?.position || "",
          overall: Number(item.overall || rating?.overall || 0),
          weeklySalary: Number(item.weeklySalary || 0),
        };
      },
    );

    return { roster: fallbackRoster, lineup: {}, finance };
  },

  getSquadNeedProfile(buyer = "") {
    const snapshot = App.transfers.getBuyerRosterSnapshot(buyer);
    const roster = Array.isArray(snapshot.roster) ? snapshot.roster : [];
    const playerById = new Map(
      roster.map((player, index) => [String(player.id || index + 1), player]),
    );
    const lineupPlayers = Object.values(snapshot.lineup || {})
      .map((value) => playerById.get(String(value)))
      .filter(Boolean);

    return ["GK", "DEF", "MID", "ATT"].reduce((acc, group) => {
      const rosterPlayers = roster.filter(
        (player) => getPositionGroup(player.position) === group,
      );
      const starters = lineupPlayers.filter(
        (player) => getPositionGroup(player.position) === group,
      );
      const rosterAvg = rosterPlayers.length
        ? Math.round(
            rosterPlayers.reduce(
              (sum, player) => sum + Number(player.overall || 0),
              0,
            ) / rosterPlayers.length,
          )
        : 0;
      const starterAvg = starters.length
        ? Math.round(
            starters.reduce(
              (sum, player) => sum + Number(player.overall || 0),
              0,
            ) / starters.length,
          )
        : rosterAvg;
      const depth = rosterPlayers.length - starters.length;
      let risk = 0;
      if (!rosterPlayers.length || !starters.length) risk = 3;
      else if (starterAvg < 72 || depth < 1) risk = 2;
      else if (starterAvg < 76 || depth < 2) risk = 1;
      acc[group] = {
        group,
        label: getPositionLabel(group),
        rosterCount: rosterPlayers.length,
        starterCount: starters.length,
        depth,
        rosterAvg,
        starterAvg,
        risk,
      };
      return acc;
    }, {});
  },

  evaluateCandidateFit(candidate = {}, buyer = "") {
    const clean = sanitizeCandidate(candidate);
    if (!clean || !buyer) {
      return {
        label: "Sem leitura",
        tone: "watch",
        detail: "Escolha comprador e alvo para medir encaixe.",
      };
    }

    const profile = App.transfers.getSquadNeedProfile(buyer);
    const group = getPositionGroup(clean.position);
    const lane = profile[group];
    if (!lane) {
      return {
        label: "Observacao",
        tone: "watch",
        detail: "Posicao do alvo ainda nao foi identificada.",
      };
    }

    const starterAvg = Number(lane.starterAvg || 0);
    const overall = Number(clean.overall || 0);
    if (lane.risk >= 3) {
      return {
        label: "Encaixe critico",
        tone: "hot",
        detail: `${lane.label} e um buraco real no elenco de ${buyer}.`,
      };
    }
    if (lane.risk >= 2 && overall >= starterAvg) {
      return {
        label: "Titular imediato",
        tone: "ready",
        detail: `${lane.label} esta exposto e o OVR do alvo sobe o teto agora.`,
      };
    }
    if (overall >= starterAvg + 2) {
      return {
        label: "Upgrade claro",
        tone: "live",
        detail: `${lane.label} ganha salto tecnico sobre a media atual.`,
      };
    }
    if (overall >= Math.max(68, starterAvg - 1)) {
      return {
        label: "Rotacao util",
        tone: "watch",
        detail: `${lane.label} recebe profundidade sem pressionar tanto a folha.`,
      };
    }
    return {
      label: "Baixa urgencia",
      tone: "cold",
      detail: `${lane.label} nao e a maior carencia hoje para ${buyer}.`,
    };
  },

  estimateCompetition(candidate = {}, buyer = "", preview = null) {
    const clean = sanitizeCandidate(candidate);
    if (!clean) {
      return {
        label: "Fria",
        tone: "cold",
        count: 0,
        detail: "Sem alvo selecionado.",
        rivals: [],
      };
    }

    const cost = Number(
      preview?.cashFinalValue || clean.finalValue || clean.marketValue || 0,
    );
    const group = getPositionGroup(clean.position);
    const rivals = App.utils
      .getHumanBuyers()
      .filter((owner) => owner && owner !== buyer)
      .map((owner) => {
        const budget = App.transfers
          .getSpendingSummary()
          .find((item) => item.buyer === owner);
        const needs = App.transfers.getSquadNeedProfile(owner)[group];
        const afford =
          Number(budget?.remaining || 0) >= Math.max(0, cost * 0.65);
        const open =
          !budget?.marketEmbargo &&
          Number(budget?.transfersToday || 0) <
            Number(budget?.transferLimit || 0);
        const risk = Number(needs?.risk || 0);
        const score =
          (afford ? 2 : 0) +
          (open ? 1 : 0) +
          risk +
          (Number(clean.overall || 0) >= 80 ? 1 : 0);
        return { owner, afford, open, risk, score };
      })
      .filter((item) => item.afford && item.open && item.risk >= 1)
      .sort((a, b) => b.score - a.score || a.owner.localeCompare(b.owner));

    const count = rivals.length;
    return {
      label: count >= 3 ? "Alta" : count >= 2 ? "Media" : count === 1 ? "Baixa" : "Fria",
      tone: count >= 3 ? "hot" : count >= 2 ? "ready" : count === 1 ? "watch" : "cold",
      count,
      detail: count
        ? `${count} tecnico(s) com caixa e carencia parecida: ${rivals
            .slice(0, 3)
            .map((item) => item.owner)
            .join(", ")}.`
        : "Nenhum rival obvio com caixa + carencia no momento.",
      rivals,
    };
  },

  getSuggestedTradeIns(preview) {
    if (!preview || preview.isInternal || !preview.buyer) return [];

    const buyer = preview.buyer;
    const target = App.transfers.getCurrentCandidate();
    const targetGroup = getPositionGroup(target?.position);
    const snapshot = App.transfers.getBuyerRosterSnapshot(buyer);
    const starterIds = new Set(
      Object.values(snapshot.lineup || {}).map((value) => String(value)),
    );

    return App.transfers
      .getOwnedTransfersByBuyer(buyer)
      .map((item, index) => {
        const rating = App.transfers.getRatingForPlayerName(item.player, {
          club: item.fromClub,
        });
        const group = getPositionGroup(rating?.position);
        const rosterMatch = (snapshot.roster || []).find(
          (player) =>
            App.transfers.normalizePlayerRatingKey(player.name) ===
            App.transfers.normalizePlayerRatingKey(item.player),
        );
        const isStarter = rosterMatch
          ? starterIds.has(String(rosterMatch.id))
          : false;
        const score =
          (group === targetGroup ? 5 : 0) +
          (isStarter ? -3 : 2) +
          (Number(target?.overall || 0) > Number(item.overall || 0) ? 1 : 0);
        return {
          index,
          player: item.player,
          overall: Number(item.overall || rating?.overall || 0),
          position: rating?.position || "",
          totalCost: Number(item.totalCost || item.marketValue || 0),
          credit: App.transfers.getExchangeCredit(
            preview.finalValue,
            Number(item.totalCost || item.marketValue || 0),
          ),
          isStarter,
          score,
        };
      })
      .filter(
        (item) =>
          App.transfers.normalizePlayerRatingKey(item.player) !==
            App.transfers.normalizePlayerRatingKey(preview.player) &&
          Number(item.credit || 0) > 0,
      )
      .sort((a, b) => b.score - a.score || b.credit - a.credit)
      .slice(0, 3);
  },

  buildCandidateTimeline(candidate = {}, preview = null) {
    const clean = sanitizeCandidate(candidate);
    const shortlist = App.transfers.findShortlistTarget(clean || {});
    const proposals = (App.auth?.myTransferProposals || [])
      .filter(
        (item) =>
          App.transfers.normalizePlayerRatingKey(item.player) ===
          App.transfers.normalizePlayerRatingKey(clean?.player),
      )
      .sort((a, b) => {
        const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
        const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
        return aTime - bTime;
      });
    const transfers = App.transfers
      .getValidTransfers()
      .filter(
        (item) =>
          App.transfers.normalizePlayerRatingKey(item.player) ===
          App.transfers.normalizePlayerRatingKey(clean?.player),
      )
      .slice(0, 1);

    const items = [];
    if (shortlist) {
      items.push({
        when: shortlist.updatedAt || shortlist.createdAt || "",
        title: "Shortlist atualizada",
        detail: `${normalizeStage(shortlist.priority)} na fila privada.`,
      });
    }
    if (preview?.hasEnoughData) {
      items.push({
        when: "",
        title: "Previa montada",
        detail: `Caixa ${App.utils.formatCurrency(preview.cashFinalValue || preview.finalValue)} e folha ${App.utils.formatCurrency(preview.weeklySalary)}/sem.`,
      });
    }
    proposals.forEach((item) => {
      items.push({
        when: item.created_at || item.createdAt || "",
        title:
          item.proposal_role === "sent"
            ? "Proposta enviada"
            : "Oferta recebida",
        detail: `${App.utils.formatCurrency(Number(item.proposed_value || 0))} - ${item.status || "pending"}.`,
      });
      if (item.answered_at || item.answeredAt) {
        items.push({
          when: item.answered_at || item.answeredAt || "",
          title: "Resposta da negociacao",
          detail:
            item.response_message ||
            `Status final: ${item.status || "respondido"}.`,
        });
      }
    });
    transfers.forEach((item) => {
      items.push({
        when: item.timestamp || "",
        title: "Transferencia concluida",
        detail: `${item.buyer} fechou em ${App.utils.formatCurrency(item.totalCost)}.`,
      });
    });

    return items
      .filter((item) => item.title)
      .sort((a, b) => {
        const aTime = a.when ? new Date(a.when).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.when ? new Date(b.when).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(-6);
  },

  renderOpsBoard(form = document.getElementById("transferForm")) {
    const target = document.getElementById("transferOpsBoard");
    if (!target) return;

    const session = App.auth?.getSession?.();
    const buyer = form?.elements?.buyer?.value || session?.managerName || "";
    const budget = App.transfers
      .getSpendingSummary()
      .find((item) => item.buyer === buyer);
    const preview = form ? App.transfers.getTransferPreview(form) : null;
    const shortlistCount = App.transfers.getShortlistTargets().length;
    const pendingReceived = (App.auth?.myTransferProposals || []).filter(
      (item) => item.proposal_role !== "sent" && item.status === "pending",
    ).length;
    const pendingSent = (App.auth?.myTransferProposals || []).filter(
      (item) => item.proposal_role === "sent" && item.status === "pending",
    ).length;
    const listings = Number(
      App.auth?.myTransferSaleListings?.listings?.length || 0,
    );
    const openUntil = App.config.transferWindowOpenUntil
      ? App.utils.formatDateTime(App.config.transferWindowOpenUntil)
      : "Sem data";
    const remainingMoves = budget
      ? Math.max(
          0,
          Number(budget.transferLimit || 0) - Number(budget.transfersToday || 0),
        )
      : 0;

    if (!buyer || !budget) {
      App.dom.setHtml(
        target,
        renderWorkspaceEmpty(
          "Cockpit operacional",
          "Escolha o comprador para abrir orcamento, limite e radar da rodada.",
        ),
      );
      return;
    }

    App.dom.setHtml(
      target,
      `
        <article class="transfer-ops-card">
          <span>Janela operacional</span>
          <strong>${App.transfers.isTransferWindowLocked() ? "Fechada" : "Aberta"}</strong>
          <small>Mercado externo ate ${App.utils.escapeHtml(openUntil)}</small>
        </article>
        <article class="transfer-ops-card">
          <span>Caixa livre</span>
          <strong>${App.utils.formatCurrency(Number(budget.remaining || 0))}</strong>
          <small>${buyer} ainda pode girar ${App.utils.formatCurrency(Number(budget.totalBudget || 0))} no ciclo.</small>
        </article>
        <article class="transfer-ops-card">
          <span>Movimentos hoje</span>
          <strong>${remainingMoves}</strong>
          <small>${Number(budget.transfersToday || 0)}/${Number(budget.transferLimit || 0)} usados.</small>
        </article>
        <article class="transfer-ops-card">
          <span>Folha projetada</span>
          <strong>${App.utils.formatCurrency(Number(preview?.payrollAfter || budget.payrollWeekly || 0))}/sem</strong>
          <small>Teto recomendado ${App.utils.formatCurrency(Number(preview?.payrollCeiling || 0))}/sem.</small>
        </article>
        <article class="transfer-ops-card">
          <span>Shortlist</span>
          <strong>${shortlistCount}</strong>
          <small>Alvos privados ativos neste login.</small>
        </article>
        <article class="transfer-ops-card">
          <span>Hub de negociacao</span>
          <strong>${pendingReceived + pendingSent}</strong>
          <small>${pendingReceived} recebida(s), ${pendingSent} enviada(s), ${listings} jogador(es) na vitrine.</small>
        </article>
      `,
    );
  },

  renderDealCenter(form = document.getElementById("transferForm")) {
    const target = document.getElementById("transferDealCenter");
    if (!target) return;

    const candidate = App.transfers.getCurrentCandidate(form);
    const preview = form ? App.transfers.getTransferPreview(form) : null;
    if (!candidate) {
      App.dom.setHtml(
        target,
        `
          <div class="home-panel-header">
            <div>
              <h2>Deal center</h2>
              <p class="coach-card-subtitle">Leitura rapida da negociacao, encaixe e risco antes do envio.</p>
            </div>
          </div>
          ${renderWorkspaceEmpty(
            "Nenhum alvo em foco",
            "Selecione um jogador do mercado ou carregue um alvo da shortlist para abrir comparativo, timeline e sugestoes de troca.",
          )}
        `,
      );
      return;
    }

    const shortlist = App.transfers.findShortlistTarget(candidate);
    const fit = App.transfers.evaluateCandidateFit(
      candidate,
      preview?.buyer || form?.elements?.buyer?.value || "",
    );
    const competition = App.transfers.estimateCompetition(
      candidate,
      preview?.buyer || form?.elements?.buyer?.value || "",
      preview,
    );
    const diagnostics = App.transfers.getTransferDiagnostics(preview);
    const suggestions = App.transfers.getSuggestedTradeIns(preview);
    const timeline = App.transfers.buildCandidateTimeline(candidate, preview);
    const isCompared = App.transfers
      .getCompareCandidates()
      .some((item) => item.key === candidate.key);
    const encodedCandidate = App.utils.escapeHtml(
      App.transfers.serializeCandidate(candidate),
    );
    const shortlistMeta = shortlist
      ? App.transfers.getShortlistStageMeta(shortlist.priority)
      : null;

    App.dom.setHtml(
      target,
      `
        <div class="home-panel-header">
          <div>
            <h2>Deal center</h2>
            <p class="coach-card-subtitle">Cockpit do alvo selecionado: preco, encaixe, rivais e roteiro de negociacao.</p>
          </div>
          ${
            shortlistMeta
              ? renderWorkspacePill(shortlistMeta.label, shortlistMeta.tone)
              : renderWorkspacePill("Sem shortlist", "cold")
          }
        </div>

        <div class="transfer-deal-hero">
          <div>
            <strong>${App.utils.escapeHtml(candidate.player)}</strong>
            <span>${App.utils.escapeHtml([candidate.position || "Posicao pendente", candidate.club || candidate.fromClub, candidate.overall ? `OVR ${candidate.overall}` : ""].filter(Boolean).join(" - "))}</span>
          </div>
          <div class="transfer-deal-actions">
            <button type="button" class="secondary-button" data-transfer-shortlist-save="${encodedCandidate}" data-transfer-shortlist-stage="${App.utils.escapeHtml(shortlist?.priority || "Prioridade alta")}">
              ${shortlist ? "Atualizar shortlist" : "Salvar na shortlist"}
            </button>
            <button type="button" class="secondary-button" data-transfer-compare-add="${encodedCandidate}">
              ${isCompared ? "Remover comparacao" : "Comparar"}
            </button>
          </div>
        </div>

        <div class="transfer-deal-metrics">
          <article>
            <span>Custo de entrada</span>
            <strong>${App.utils.formatCurrency(Number(preview?.cashFinalValue || preview?.finalValue || candidate.marketValue || 0))}</strong>
            <small>${preview?.exchangePlayer ? `com troca de ${preview.exchangePlayer.player}` : "sem abatimento aplicado"}</small>
          </article>
          <article>
            <span>Folha semanal</span>
            <strong>${candidate.weeklySalary ? `${App.utils.formatCurrency(candidate.weeklySalary)}/sem` : "Pendente"}</strong>
            <small>${App.utils.escapeHtml(candidate.salarySourceName || "Sem fonte consolidada ainda")}</small>
          </article>
          <article>
            <span>Encaixe no elenco</span>
            <strong>${App.utils.escapeHtml(fit.label)}</strong>
            <small>${App.utils.escapeHtml(fit.detail)}</small>
          </article>
          <article>
            <span>Radar de concorrencia</span>
            <strong>${App.utils.escapeHtml(competition.label)}</strong>
            <small>${App.utils.escapeHtml(competition.detail)}</small>
          </article>
        </div>

        <div class="transfer-deal-columns">
          <section class="transfer-deal-section">
            <h3>Bloqueios e sinais</h3>
            <div class="transfer-deal-list">
              ${
                diagnostics.blocking.length || diagnostics.warnings.length || diagnostics.positive.length
                  ? [
                      ...diagnostics.blocking.map(
                        (item) => `
                          <div class="transfer-deal-alert is-danger">
                            <strong>${App.utils.escapeHtml(item.title)}</strong>
                            <p>${App.utils.escapeHtml(item.detail)}</p>
                          </div>
                        `,
                      ),
                      ...diagnostics.warnings.map(
                        (item) => `
                          <div class="transfer-deal-alert is-warning">
                            <strong>${App.utils.escapeHtml(item.title)}</strong>
                            <p>${App.utils.escapeHtml(item.detail)}</p>
                          </div>
                        `,
                      ),
                      ...diagnostics.positive.map(
                        (item) => `
                          <div class="transfer-deal-alert is-success">
                            <strong>${App.utils.escapeHtml(item.title)}</strong>
                            <p>${App.utils.escapeHtml(item.detail)}</p>
                          </div>
                        `,
                      ),
                    ].join("")
                  : renderWorkspaceEmpty(
                      "Sem leitura",
                      "Preencha valor, OVR e folha para destrinchar o negocio.",
                    )
              }
            </div>
          </section>

          <section class="transfer-deal-section">
            <h3>Sugestoes de troca</h3>
            <div class="transfer-deal-list">
              ${
                suggestions.length
                  ? suggestions
                      .map(
                        (item) => `
                          <div class="transfer-swap-item">
                            <div>
                              <strong>${App.utils.escapeHtml(item.player)}</strong>
                              <p>${App.utils.escapeHtml([item.position || "posicao pendente", item.overall ? `OVR ${item.overall}` : "", item.isStarter ? "titular atual" : "rotacao"].filter(Boolean).join(" - "))}</p>
                            </div>
                            <div class="transfer-swap-actions">
                              <span>${App.utils.formatCurrency(item.credit)}</span>
                              <button type="button" class="secondary-button" data-transfer-apply-exchange="${item.index}">Usar na troca</button>
                            </div>
                          </div>
                        `,
                      )
                      .join("")
                  : renderWorkspaceEmpty(
                      "Sem troca recomendada",
                      "O comprador ainda nao tem ativos bons para abater este negocio ou o alvo pede caixa puro.",
                    )
              }
            </div>
          </section>
        </div>

        <section class="transfer-deal-section transfer-timeline-section">
          <h3>Timeline da negociacao</h3>
          <div class="transfer-timeline-list">
            ${
              timeline.length
                ? timeline
                    .map(
                      (item) => `
                        <div class="transfer-timeline-item">
                          <span>${App.utils.escapeHtml(item.when ? App.utils.formatDateTime(item.when) : "Agora")}</span>
                          <strong>${App.utils.escapeHtml(item.title)}</strong>
                          <p>${App.utils.escapeHtml(item.detail)}</p>
                        </div>
                      `,
                    )
                    .join("")
                : renderWorkspaceEmpty(
                    "Timeline vazia",
                    "Este alvo ainda nao entrou em shortlist, proposta ou transferencia concluida.",
                  )
            }
          </div>
        </section>
      `,
    );
  },

  renderShortlistBoard() {
    const target = document.getElementById("transferShortlistBoard");
    if (!target) return;

    const session = App.auth?.getSession?.();
    const shortlist = App.transfers.getShortlistTargets();

    if (!session || App.auth?.isCommissioner?.()) {
      App.dom.setHtml(
        target,
        `
          <div class="home-panel-header">
            <div>
              <h2>Shortlist</h2>
              <p class="coach-card-subtitle">Fila privada por tecnico.</p>
            </div>
          </div>
          ${renderWorkspaceEmpty(
            "Login de tecnico necessario",
            "A shortlist usa a area privada do manager logado.",
          )}
        `,
      );
      return;
    }

    const grouped = SHORTLIST_STAGES.reduce((acc, stage) => {
      acc[stage] = shortlist.filter(
        (item) => normalizeStage(item.priority) === stage,
      );
      return acc;
    }, {});

    App.dom.setHtml(
      target,
      `
        <div class="home-panel-header">
          <div>
            <h2>Shortlist real</h2>
            <p class="coach-card-subtitle">Monitoramento, proposta pronta, negociando e perdas ficam num fluxo so.</p>
          </div>
          <span>${shortlist.length}</span>
        </div>

        <div class="transfer-shortlist-groups">
          ${
            shortlist.length
              ? SHORTLIST_STAGES.map((stage) => {
                  const items = grouped[stage] || [];
                  const meta = App.transfers.getShortlistStageMeta(stage);
                  return `
                    <section class="transfer-shortlist-group">
                      <div class="transfer-shortlist-group-head">
                        <strong>${App.utils.escapeHtml(stage)}</strong>
                        ${renderWorkspacePill(String(items.length), meta.tone)}
                      </div>
                      <div class="transfer-shortlist-list">
                        ${
                          items.length
                            ? items
                                .map((item) => {
                                  const candidate = App.transfers.buildCandidateFromTarget(item);
                                  const encoded = App.utils.escapeHtml(
                                    App.transfers.serializeCandidate(candidate),
                                  );
                                  const fit = App.transfers.evaluateCandidateFit(
                                    candidate,
                                    session.managerName,
                                  );
                                  return `
                                    <article class="transfer-shortlist-item">
                                      <div class="transfer-shortlist-copy">
                                        <strong>${App.utils.escapeHtml(item.player)}</strong>
                                        <small>${App.utils.escapeHtml([item.club, candidate.position || "", candidate.overall ? `OVR ${candidate.overall}` : "", item.value ? App.utils.formatCurrency(item.value) : ""].filter(Boolean).join(" - "))}</small>
                                        <span>${App.utils.escapeHtml(item.note || fit.detail)}</span>
                                      </div>
                                      <div class="transfer-shortlist-tools">
                                        <select data-transfer-shortlist-status="${App.utils.escapeHtml(item.id)}">
                                          ${SHORTLIST_STAGES.map(
                                            (option) =>
                                              `<option value="${App.utils.escapeHtml(option)}" ${normalizeStage(item.priority) === option ? "selected" : ""}>${App.utils.escapeHtml(option)}</option>`,
                                          ).join("")}
                                        </select>
                                        <div class="transfer-inline-actions">
                                          <button type="button" class="secondary-button" data-transfer-load-candidate="${encoded}">Carregar</button>
                                          <button type="button" class="secondary-button" data-transfer-compare-add="${encoded}">Comparar</button>
                                          <button type="button" class="secondary-button" data-transfer-shortlist-remove="${App.utils.escapeHtml(item.id)}">Remover</button>
                                        </div>
                                      </div>
                                    </article>
                                  `;
                                })
                                .join("")
                            : `<div class="transfer-shortlist-empty">Nenhum alvo em ${App.utils.escapeHtml(stage.toLowerCase())}.</div>`
                        }
                      </div>
                    </section>
                  `;
                }).join("")
              : renderWorkspaceEmpty(
                  "Shortlist vazia",
                  "Use o mercado ou o deal center para salvar alvos em fluxo real.",
                )
          }
        </div>
      `,
    );
  },

  renderCompareBoard(form = document.getElementById("transferForm")) {
    const target = document.getElementById("transferCompareBoard");
    if (!target) return;

    const buyer = form?.elements?.buyer?.value || App.auth?.getSession?.()?.managerName || "";
    const candidates = App.transfers.getCompareCandidates();

    if (!candidates.length) {
      App.dom.setHtml(
        target,
        `
          <div class="home-panel-header">
            <div>
              <h2>Comparador</h2>
              <p class="coach-card-subtitle">Selecione ate tres nomes para comparar valor, folha, encaixe e concorrencia.</p>
            </div>
          </div>
          ${renderWorkspaceEmpty(
            "Comparador vazio",
            "Adicione nomes do mercado ou da shortlist para colocar lado a lado.",
          )}
        `,
      );
      return;
    }

    App.dom.setHtml(
      target,
      `
        <div class="home-panel-header">
          <div>
            <h2>Comparador</h2>
            <p class="coach-card-subtitle">Leitura lado a lado para decidir entre nomes parecidos.</p>
          </div>
          <button type="button" class="secondary-button" data-transfer-compare-clear>Limpar</button>
        </div>
        <div class="transfer-compare-grid">
          ${candidates
            .map((candidate) => {
              const fit = App.transfers.evaluateCandidateFit(candidate, buyer);
              const competition = App.transfers.estimateCompetition(
                candidate,
                buyer,
                null,
              );
              const encoded = App.utils.escapeHtml(
                App.transfers.serializeCandidate(candidate),
              );
              return `
                <article class="transfer-compare-card">
                  <div class="transfer-compare-top">
                    <strong>${App.utils.escapeHtml(candidate.player)}</strong>
                    <span>${App.utils.escapeHtml(candidate.club || "-")}</span>
                  </div>
                  <div class="transfer-compare-stats">
                    <div><span>OVR</span><strong>${candidate.overall || "-"}</strong></div>
                    <div><span>Valor</span><strong>${candidate.marketValue ? App.utils.formatCurrency(candidate.marketValue) : "-"}</strong></div>
                    <div><span>Folha</span><strong>${candidate.weeklySalary ? `${App.utils.formatCurrency(candidate.weeklySalary)}/sem` : "Pendente"}</strong></div>
                    <div><span>Encaixe</span><strong>${App.utils.escapeHtml(fit.label)}</strong></div>
                    <div><span>Concorrencia</span><strong>${App.utils.escapeHtml(competition.label)}</strong></div>
                    <div><span>Posicao</span><strong>${App.utils.escapeHtml(candidate.position || "-")}</strong></div>
                  </div>
                  <p class="transfer-compare-detail">${App.utils.escapeHtml(`${fit.detail} ${competition.detail}`.trim())}</p>
                  <div class="transfer-inline-actions">
                    <button type="button" class="secondary-button" data-transfer-load-candidate="${encoded}">Carregar</button>
                    <button type="button" class="secondary-button" data-transfer-shortlist-save="${encoded}" data-transfer-shortlist-stage="Proposta pronta">Shortlist</button>
                    <button type="button" class="secondary-button" data-transfer-compare-remove="${App.utils.escapeHtml(candidate.key)}">Remover</button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `,
    );
  },

  renderNegotiationHub() {
    const target = document.getElementById("transferNegotiationHub");
    if (!target) return;

    const session = App.auth?.getSession?.();
    if (!session || App.auth?.isCommissioner?.()) {
      App.dom.setHtml(
        target,
        renderWorkspaceEmpty(
          "Hub privado",
          "Faca login como tecnico para abrir propostas recebidas, enviadas e vitrine.",
        ),
      );
      return;
    }

    const proposals = Array.isArray(App.auth?.myTransferProposals)
      ? App.auth.myTransferProposals
      : [];
    const receivedPending = proposals.filter(
      (item) => item.proposal_role !== "sent" && item.status === "pending",
    );
    const sentPending = proposals.filter(
      (item) => item.proposal_role === "sent" && item.status === "pending",
    );
    const resolved = proposals
      .filter((item) => item.status && item.status !== "pending")
      .slice(0, 6);
    const listings = Array.isArray(App.auth?.myTransferSaleListings?.listings)
      ? App.auth.myTransferSaleListings.listings
      : [];

    App.dom.setHtml(
      target,
      `
        <div class="home-panel-header">
          <div>
            <h2>Hub de negociacao</h2>
            <p class="coach-card-subtitle">Tudo que esta vivo em transferencias: caixa de entrada, propostas enviadas, respostas e vitrine.</p>
          </div>
          <span>${receivedPending.length + sentPending.length} aberto(s)</span>
        </div>

        <div class="transfer-hub-grid">
          <article class="transfer-hub-card">
            <div class="transfer-hub-card-head">
              <strong>Recebidas</strong>
              ${renderWorkspacePill(String(receivedPending.length), receivedPending.length ? "hot" : "cold")}
            </div>
            <div class="transfer-hub-card-body">
              ${
                receivedPending.length
                  ? receivedPending
                      .slice(0, 4)
                      .map((item) => App.auth.renderTransferProposalCard(item))
                      .join("")
                  : `<div class="transfer-shortlist-empty">Nenhuma oferta pendente para responder.</div>`
              }
            </div>
          </article>

          <article class="transfer-hub-card">
            <div class="transfer-hub-card-head">
              <strong>Enviadas</strong>
              ${renderWorkspacePill(String(sentPending.length), sentPending.length ? "watch" : "cold")}
            </div>
            <div class="transfer-hub-card-body transfer-summary-stack">
              ${
                sentPending.length
                  ? sentPending
                      .slice(0, 6)
                      .map((item) => App.auth.renderTransferProposalSummary(item))
                      .join("")
                  : `<div class="transfer-shortlist-empty">Nenhuma proposta em aberto do seu lado.</div>`
              }
            </div>
          </article>

          <article class="transfer-hub-card">
            <div class="transfer-hub-card-head">
              <strong>Resolvidas</strong>
              ${renderWorkspacePill(String(resolved.length), resolved.length ? "live" : "cold")}
            </div>
            <div class="transfer-hub-card-body transfer-timeline-list">
              ${
                resolved.length
                  ? resolved
                      .map(
                        (item) => `
                          <div class="transfer-timeline-item compact">
                            <span>${App.utils.escapeHtml(item.answered_at ? App.utils.formatDateTime(item.answered_at) : item.created_at ? App.utils.formatDateTime(item.created_at) : "Sem data")}</span>
                            <strong>${App.utils.escapeHtml(item.player)}</strong>
                            <p>${App.utils.escapeHtml(item.response_message || `${item.status} - ${App.utils.formatCurrency(Number(item.proposed_value || 0))}`)}</p>
                          </div>
                        `,
                      )
                      .join("")
                  : `<div class="transfer-shortlist-empty">Ainda nao houve respostas fechadas neste login.</div>`
              }
            </div>
          </article>

          <article class="transfer-hub-card">
            <div class="transfer-hub-card-head">
              <strong>Lista de venda</strong>
              ${renderWorkspacePill(String(listings.length), listings.length ? "ready" : "cold")}
            </div>
            <div class="transfer-hub-card-body transfer-summary-stack">
              ${
                listings.length
                  ? listings
                      .slice(0, 6)
                      .map((item) => {
                        const offerCount = Number(item.offerCount || item.offer_count || 0);
                        const asking = Number(item.askingPrice || item.asking_price || 0);
                        return `
                          <article class="proposal-summary-item">
                            <span>${offerCount ? `${offerCount} oferta(s)` : "Na vitrine"}</span>
                            <strong>${App.utils.escapeHtml(item.player || item.playerName || "-")}</strong>
                            <small>${App.utils.escapeHtml([item.fromClub || item.from_club || "", asking ? App.utils.formatCurrency(asking) : "", item.note || ""].filter(Boolean).join(" - "))}</small>
                          </article>
                        `;
                      })
                      .join("")
                  : `<div class="transfer-shortlist-empty">Nenhum jogador listado para venda.</div>`
              }
            </div>
          </article>
        </div>
      `,
    );

    App.auth.bindTransferProposalButtons(target);
  },

  renderWorkspace(form = document.getElementById("transferForm")) {
    App.transfers.renderOpsBoard(form);
    App.transfers.renderDealCenter(form);
    App.transfers.renderShortlistBoard();
    App.transfers.renderCompareBoard(form);
    App.transfers.renderNegotiationHub();
  },

  refreshWorkspace(form = document.getElementById("transferForm")) {
    if (form) App.transfers.renderTransferPreview(form);
    App.transfers.renderWorkspace(form);
  },

  async renderMarketPlayerResults() {
    const target = document.getElementById("marketPlayerResults");
    const input = document.getElementById("marketPlayerSearch");
    if (!target) return;

    const query = input?.value || "";
    const normalized = App.utils.normalizeText(query);
    if (normalized.length < 2) {
      App.transfers.marketSearchRequestId = "";
      target.dataset.marketRenderKey = `empty:${normalized}`;
      target.dataset.marketRenderReady = "true";
      App.dom.setHtml(
        target,
        `
          <div class="market-empty">
            Digite pelo menos 2 letras para buscar jogadores no mercado.
          </div>
        `,
      );
      return;
    }

    const showContracted = Boolean(
      document.getElementById("showContractedPlayers")?.checked,
    );
    const renderKey = `${normalized}|${showContracted ? "all" : "available"}`;
    if (
      target.dataset.marketRenderKey === renderKey &&
      target.dataset.marketRenderReady === "true"
    ) {
      return;
    }

    const activeRender = App.transfers.marketResultsPending;
    if (activeRender?.key === renderKey) return activeRender.promise;

    const requestId = `${Date.now()}-${Math.random()}`;
    App.transfers.marketSearchRequestId = requestId;
    target.dataset.marketRenderKey = renderKey;
    target.dataset.marketRenderReady = "false";
    App.dom.setHtml(
      target,
      `<div class="market-empty">Buscando jogadores no mercado...</div>`,
    );

    const renderRequest = (async () => {
      const players = await App.transfers.searchMarketPlayers(query);
      if (App.transfers.marketSearchRequestId !== requestId) return;

      const ratingRows = await Promise.all(
        players
          .slice(0, 6)
          .map((player) =>
            App.transfers.searchEaRatingsCached(player.name || "", 2),
          ),
      );
      if (App.transfers.marketSearchRequestId !== requestId) return;
      App.api.mergeEaRatings?.(ratingRows.flat());

      if (!players.length) {
        App.dom.setHtml(
          target,
          `
            <div class="market-empty">
              Nenhum jogador disponivel encontrado. Tente buscar por nome, clube, liga ou posicao.
              ${document.getElementById("showContractedPlayers")?.checked ? "" : " Jogadores ja contratados ficam escondidos por padrao."}
            </div>
          `,
        );
        target.dataset.marketRenderReady = "true";
        return;
      }

      App.dom.setHtml(
        target,
        players
          .map((player) => {
            const isContracted = App.transfers.isMarketPlayerContracted(player);
            const candidate = App.transfers.buildCandidateFromMarketPlayer(player);
            const salaryReference = App.transfers.getSalaryReferenceFromItem({
              ...player,
              overall: candidate.overall,
              marketValue: candidate.marketValue,
            });
            const shortlist = App.transfers.findShortlistTarget(candidate);
            const compareActive = App.transfers
              .getCompareCandidates()
              .some((item) => item.key === candidate.key);
            const fit = App.transfers.evaluateCandidateFit(
              candidate,
              document.getElementById("transferForm")?.elements?.buyer?.value ||
                App.auth?.getSession?.()?.managerName ||
                "",
            );
            const encoded = App.utils.escapeHtml(
              App.transfers.serializeCandidate(candidate),
            );
            return `
              <article class="market-player-option market-player-shell ${isContracted ? "is-contracted" : ""}">
                ${App.transfers.renderPlayerPhoto(player, App.transfers.findEaRatingForMarketPlayer(player))}
                <span class="market-player-main">
                  <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
                  <small>${App.utils.escapeHtml([candidate.position || "", player.age ? `${player.age} anos` : "", player.league, player.club].filter(Boolean).join(" - "))}</small>
                </span>
                <span class="market-player-side">
                  ${candidate.overall ? `<span class="market-player-overall">OVR ${candidate.overall}</span>` : ""}
                  <span class="market-player-value">${App.utils.formatCurrency(candidate.marketValue)}</span>
                  ${salaryReference.ok ? `<span class="market-player-status">${App.utils.escapeHtml(App.transfers.getSalaryReferenceLabel(salaryReference))} ${App.utils.formatCurrency(salaryReference.weeklySalary)}/sem</span>` : `<span class="market-player-status">Folha pendente</span>`}
                  <span class="market-player-status">${App.utils.escapeHtml(fit.label)}</span>
                  ${shortlist ? `<span class="market-player-status">Shortlist: ${App.utils.escapeHtml(normalizeStage(shortlist.priority))}</span>` : ""}
                  ${isContracted ? `<span class="market-player-status">Ja contratado</span>` : ""}
                </span>
                <div class="market-player-actions">
                  <button type="button" class="secondary-button" data-market-player-select="${player.id}" ${isContracted ? "disabled" : ""}>Selecionar</button>
                  <button type="button" class="secondary-button" data-transfer-shortlist-save="${encoded}" data-transfer-shortlist-stage="${App.utils.escapeHtml(shortlist?.priority || "Monitorando")}">${shortlist ? "Atualizar shortlist" : "Shortlist"}</button>
                  <button type="button" class="secondary-button" data-transfer-compare-add="${encoded}">${compareActive ? "Remover comparacao" : "Comparar"}</button>
                </div>
              </article>
            `;
          })
          .join(""),
      );

      target.querySelectorAll("[data-market-player-select]").forEach((button) => {
        button.addEventListener("click", () =>
          App.transfers.selectMarketPlayer(button.dataset.marketPlayerSelect),
        );
      });
      target.dataset.marketRenderReady = "true";
    })().finally(() => {
      if (App.transfers.marketResultsPending?.key === renderKey) {
        App.transfers.marketResultsPending = null;
      }
    });

    App.transfers.marketResultsPending = {
      key: renderKey,
      promise: renderRequest,
    };
    return renderRequest;
  },

  loadCandidateIntoForm(candidate = {}, options = {}) {
    const form = document.getElementById("transferForm");
    const clean = sanitizeCandidate(candidate);
    if (!form || !clean) return;

    if (clean.source !== "internal") {
      const marketRadio = form.querySelector('input[name="transferType"][value="market"]');
      if (marketRadio) {
        marketRadio.checked = true;
      }
    }

    if (form.elements.player) form.elements.player.value = clean.player || "";
    if (form.elements.fromClub) {
      form.elements.fromClub.value = clean.fromClub || clean.club || "";
    }
    if (form.elements.overall && clean.overall) {
      form.elements.overall.value = Number(clean.overall);
    }
    if (form.elements.marketValue && clean.marketValue) {
      form.elements.marketValue.value = Math.round(Number(clean.marketValue));
    }
    if (form.elements.weeklySalary && clean.weeklySalary) {
      form.elements.weeklySalary.value = Math.round(Number(clean.weeklySalary));
    }
    if (form.elements.salarySourceName) {
      form.elements.salarySourceName.value = clean.salarySourceName || "";
    }
    if (form.elements.salarySourceUrl) {
      form.elements.salarySourceUrl.value = clean.salarySourceUrl || "";
    }

    const search = document.getElementById("marketPlayerSearch");
    if (search) {
      search.value = clean.player;
    }

    App.transfers.syncInternalTransferFields(form);
    App.transfers.refreshWorkspace(form);
    if (!options.skipSalaryRefresh) {
      App.transfers.refreshSalaryQuoteForForm(form, clean);
    }
  },

  selectMarketPlayer(playerId) {
    const player = App.transfers
      .getMarketPlayers()
      .find((item) => String(item.id) === String(playerId));
    if (!player || App.transfers.isMarketPlayerContracted(player)) return;
    App.transfers.loadCandidateIntoForm(
      App.transfers.buildCandidateFromMarketPlayer(player),
    );
  },

  bindWorkspaceEvents() {
    const root = document.getElementById("transfersView");
    if (!root || root.dataset.workspaceBound === "true") return;
    root.dataset.workspaceBound = "true";

    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const message = document.getElementById("transferMessage");

      if (button.hasAttribute("data-transfer-load-candidate")) {
        const candidate = App.transfers.parseCandidateData(
          button.dataset.transferLoadCandidate,
        );
        App.transfers.loadCandidateIntoForm(candidate);
        return;
      }

      if (button.hasAttribute("data-transfer-compare-add")) {
        const candidate = App.transfers.parseCandidateData(
          button.dataset.transferCompareAdd,
        );
        const before = App.transfers
          .getCompareCandidates()
          .some((item) => item.key === App.transfers.getCandidateKey(candidate));
        App.transfers.addCompareCandidate(candidate);
        App.transfers.renderCompareBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderShortlistBoard();
        App.transfers.renderMarketPlayerResults();
        App.utils.setMessage(
          message,
          before ? "Jogador removido da comparacao." : "Jogador adicionado ao comparador.",
          "success",
        );
        return;
      }

      if (button.hasAttribute("data-transfer-compare-remove")) {
        App.transfers.removeCompareCandidate(
          button.dataset.transferCompareRemove,
        );
        App.transfers.renderCompareBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderMarketPlayerResults();
        return;
      }

      if (button.hasAttribute("data-transfer-compare-clear")) {
        App.transfers.clearCompareCandidates();
        App.transfers.renderCompareBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderMarketPlayerResults();
        return;
      }

      if (button.hasAttribute("data-transfer-shortlist-save")) {
        const candidate = App.transfers.parseCandidateData(
          button.dataset.transferShortlistSave,
        );
        const stage = button.dataset.transferShortlistStage || "Monitorando";
        try {
          button.disabled = true;
          await App.transfers.pinCandidate(candidate, stage);
          App.utils.setMessage(
            message,
            `Shortlist atualizada: ${candidate?.player || "alvo"}.`,
            "success",
          );
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          button.disabled = false;
        }
        App.transfers.renderShortlistBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderOpsBoard();
        App.transfers.renderMarketPlayerResults();
        return;
      }

      if (button.hasAttribute("data-transfer-shortlist-remove")) {
        try {
          button.disabled = true;
          await App.transfers.removeShortlistTarget(
            button.dataset.transferShortlistRemove,
          );
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          button.disabled = false;
        }
        App.transfers.renderShortlistBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderOpsBoard();
        App.transfers.renderMarketPlayerResults();
        return;
      }

      if (button.hasAttribute("data-transfer-apply-exchange")) {
        const form = document.getElementById("transferForm");
        if (!form?.elements?.exchangePlayer) return;
        form.elements.exchangePlayer.value = button.dataset.transferApplyExchange;
        App.transfers.refreshWorkspace(form);
      }
    });

    root.addEventListener("change", async (event) => {
      const field = event.target;
      if (
        field instanceof HTMLSelectElement &&
        field.hasAttribute("data-transfer-shortlist-status")
      ) {
        const message = document.getElementById("transferMessage");
        try {
          field.disabled = true;
          await App.transfers.updateShortlistStage(
            field.dataset.transferShortlistStatus,
            field.value,
          );
          App.utils.setMessage(
            message,
            `Shortlist movida para ${field.value}.`,
            "success",
          );
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          field.disabled = false;
        }
        App.transfers.renderShortlistBoard();
        App.transfers.renderDealCenter();
        App.transfers.renderOpsBoard();
        App.transfers.renderMarketPlayerResults();
      }
    });
  },
});
