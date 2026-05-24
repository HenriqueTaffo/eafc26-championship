window.App = window.App || {};

App.utils = {
  normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  normalizeTeamName(value) {
    const normalized = App.utils.normalizeText(value);
    const aliases = {
      "southampton fc": "southampton",
      "blackburn": "blackburn rovers",
      "blackburn rovers fc": "blackburn rovers",
      "coventry": "coventry city",
      "coventry city fc": "coventry city",
      "birmingham": "birmingham city",
      "birmingham city fc": "birmingham city",
      "middlesbrough fc": "middlesbrough",
      "qpr": "queens park rangers",
      "queens park rangers fc": "queens park rangers",
      "west brom": "west bromwich albion",
      "west bromwich": "west bromwich albion",
      "sheffield utd": "sheffield united",
      "sheffield wed": "sheffield wednesday",
      "bristol city fc": "bristol city",
      "hull city fc": "hull city",
      "leicester city fc": "leicester city",
      "swansea city fc": "swansea city",
      "norwich city fc": "norwich city",
      "stoke city fc": "stoke city",
      "watford fc": "watford",
      "portsmouth fc": "portsmouth",
      "wrexham afc": "wrexham"
    };
    return aliases[normalized] || normalized;
  },

  matchDisplayCase(match, replacement) {
    const hasUppercase = /[A-ZÀ-Ý]/.test(match);
    const hasLowercase = /[a-zà-ÿ]/.test(match);

    if (hasUppercase && !hasLowercase) return replacement.toLocaleUpperCase("pt-BR");
    if (!hasUppercase && hasLowercase) return replacement.toLocaleLowerCase("pt-BR");
    if (/^[A-ZÀ-Ý]/.test(match)) {
      return `${replacement.charAt(0).toLocaleUpperCase("pt-BR")}${replacement.slice(1)}`;
    }

    return replacement;
  },

  polishUiText(value) {
    if (value === null || value === undefined) return "";

    const replacements = [
      [/\bColecao campea\b/gi, "Coleção campeã"],
      [/\bCamisa de colecao\b/gi, "Camisa de coleção"],
      [/\bNaming Rights de Estadio\b/gi, "Naming Rights de Estádio"],
      [/\bMidia e conteudo\b/gi, "Mídia e conteúdo"],
      [/\bLogistica e viagens\b/gi, "Logística e viagens"],
      [/\bMilhas da delegacao\b/gi, "Milhas da delegação"],
      [/\bSerie de bastidores\b/gi, "Série de bastidores"],
      [/\bCamisa retro premium\b/gi, "Camisa retrô premium"],
      [/\bNao sofrer gols\b/gi, "Não sofrer gols"],
      [/\bAlta exigencia\b/gi, "Alta exigência"],
      [/\bMedia exigencia\b/gi, "Média exigência"],
      [/\bBaixa exigencia\b/gi, "Baixa exigência"],
      [/\bPremio agressivo\b/gi, "Prêmio agressivo"],
      [/\bPagamento semanal fixo de patrocinio\b/gi, "Pagamento semanal fixo de patrocínio"],
      [/\bPagamento mensal fixo de patrocinio\b/gi, "Pagamento mensal fixo de patrocínio"],
      [/\bBonus de patrocinio\b/gi, "Bônus de patrocínio"],
      [/\bParcela de patrocinio\b/gi, "Parcela de patrocínio"],
      [/\bLuva de patrocinio\b/gi, "Luva de patrocínio"],
      [/\bRescisao de patrocinio\b/gi, "Rescisão de patrocínio"],
      [/\bPatrocinio assinado\b/gi, "Patrocínio assinado"],
      [/\bPatrocinio substituido\b/gi, "Patrocínio substituído"],
      [/\bLogin do tecnico invalido\b/gi, "Login do técnico inválido"],
      [/\bLimite comercial atingido: cada tecnico pode manter ate\b/gi, "Limite comercial atingido: cada técnico pode manter até"],
      [/\bVoce ja tem um patrocinio ativo\b/gi, "Você já tem um patrocínio ativo"],
      [/\bEste patrocinio ja esta ativo\b/gi, "Este patrocínio já está ativo"],
      [/\bPropostas automaticas externas ja foram avaliadas hoje\b/gi, "Propostas automáticas externas já foram avaliadas hoje"],
      [/\bDisputa por jogador ja contratado\b/gi, "Disputa por jogador já contratado"],
      [/\bSessao temporaria indisponivel\b/gi, "Sessão temporária indisponível"],
      [/\bRevogacao de sessao indisponivel\b/gi, "Revogação de sessão indisponível"],
      [/\bPropostas de transferencia indisponiveis\b/gi, "Propostas de transferência indisponíveis"],
      [/\btransferencias\b/gi, "transferências"],
      [/\bTransferencias\b/g, "Transferências"],
      [/\btransferencia\b/gi, "transferência"],
      [/\bTransferencia\b/g, "Transferência"],
      [/\bpatrocinios\b/gi, "patrocínios"],
      [/\bPatrocinios\b/g, "Patrocínios"],
      [/\bpatrocinio\b/gi, "patrocínio"],
      [/\bPatrocinio\b/g, "Patrocínio"],
      [/\btecnicos\b/gi, "técnicos"],
      [/\bTecnicos\b/g, "Técnicos"],
      [/\btecnico\b/gi, "técnico"],
      [/\bTecnico\b/g, "Técnico"],
      [/\bcomissario\b/gi, "comissário"],
      [/\bComissario\b/g, "Comissário"],
      [/\borcamento\b/gi, "orçamento"],
      [/\bOrcamento\b/g, "Orçamento"],
      [/\bhistorico\b/gi, "histórico"],
      [/\bHistorico\b/g, "Histórico"],
      [/\bacoes\b/gi, "ações"],
      [/\bAcoes\b/g, "Ações"],
      [/\bcodigo\b/gi, "código"],
      [/\bCodigo\b/g, "Código"],
      [/\barea\b/gi, "área"],
      [/\bArea\b/g, "Área"],
      [/\bdecisao\b/gi, "decisão"],
      [/\bDecisao\b/g, "Decisão"],
      [/\brescisao\b/gi, "rescisão"],
      [/\bRescisao\b/g, "Rescisão"],
      [/\bexigencia\b/gi, "exigência"],
      [/\bExigencia\b/g, "Exigência"],
      [/\bpremio\b/gi, "prêmio"],
      [/\bPremio\b/g, "Prêmio"],
      [/\bbonus\b/gi, "bônus"],
      [/\bBonus\b/g, "Bônus"],
      [/\bvitorias\b/gi, "vitórias"],
      [/\bVitorias\b/g, "Vitórias"],
      [/\bvitoria\b/gi, "vitória"],
      [/\bVitoria\b/g, "Vitória"],
      [/\bconfiavel\b/gi, "confiável"],
      [/\bConfiavel\b/g, "Confiável"],
      [/\bconsistencia\b/gi, "consistência"],
      [/\bConsistencia\b/g, "Consistência"],
      [/\bcalendario\b/gi, "calendário"],
      [/\bCalendario\b/g, "Calendário"],
      [/\bprevisivel\b/gi, "previsível"],
      [/\bPrevisivel\b/g, "Previsível"],
      [/\bpressao\b/gi, "pressão"],
      [/\bPressao\b/g, "Pressão"],
      [/\bativacao\b/gi, "ativação"],
      [/\bAtivacao\b/g, "Ativação"],
      [/\bconstancia\b/gi, "constância"],
      [/\bConstancia\b/g, "Constância"],
      [/\bexposicao\b/gi, "exposição"],
      [/\bExposicao\b/g, "Exposição"],
      [/\bvalida\b/gi, "válida"],
      [/\bValida\b/g, "Válida"],
      [/\bsessao\b/gi, "sessão"],
      [/\bSessao\b/g, "Sessão"],
      [/\binvalido\b/gi, "inválido"],
      [/\bInvalido\b/g, "Inválido"],
      [/\bautomaticas\b/gi, "automáticas"],
      [/\bAutomaticas\b/g, "Automáticas"],
      [/\bsubstituido\b/gi, "substituído"],
      [/\bSubstituido\b/g, "Substituído"],
      [/\bJa\b/g, "Já"],
      [/\bja\b/gi, "já"],
      [/\bNao\b/g, "Não"],
      [/\bnao\b/gi, "não"],
      [/\bVoce\b/g, "Você"],
      [/\bvoce\b/gi, "você"],
      [/\bate\b/gi, "até"],
      [/\bAte\b/g, "Até"]
    ];

    return replacements.reduce(
      (text, [pattern, replacement]) =>
        text.replace(pattern, match => App.utils.matchDisplayCase(match, replacement)),
      String(value)
    );
  },

  sameTeamName(a, b) {
    return App.utils.normalizeTeamName(a) === App.utils.normalizeTeamName(b);
  },

  resolveTeamName(value) {
    const normalized = App.utils.normalizeTeamName(value);
    const found = App.data.teams.find(team => App.utils.normalizeTeamName(team.team) === normalized);
    return found ? found.team : String(value || "").trim();
  },

  getTeamByName(teamName) {
    return App.data.teams.find(team => App.utils.sameTeamName(team.team, teamName));
  },

  getHumanBuyers() {
    return [...new Set(App.data.teams.filter(team => team.status === "Nosso").map(team => team.owner))];
  },

  formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  },

  formatGoalDifference(value) {
    const number = Number(value || 0);
    return number > 0 ? `+${number}` : String(number);
  },

  addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  },

  getBaseStartDate() {
    return new Date(`${App.config.calendarConfig.startDate}T12:00:00`);
  },

  formatDate(value) {
    if (!value) return "A definir";
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  },

  formatDateTime(value) {
    if (!value) return "A definir";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  },

  getChampionshipDate(roundNumber) {
    const config = App.config.calendarConfig;
    const weekIndex = Math.ceil(roundNumber / config.championshipRoundsPerWeek) - 1;
    const slotIndex = (roundNumber - 1) % config.championshipRoundsPerWeek;
    return App.utils.addDays(App.utils.getBaseStartDate(), (weekIndex * 7) + config.championshipDayOffsets[slotIndex]);
  },

  getCupDate(week) {
    const config = App.config.calendarConfig;
    return App.utils.addDays(App.utils.getBaseStartDate(), ((week - 1) * 7) + config.cupDayOffset);
  },

  setMessage(element, text, type = "") {
    if (!element) return;
    element.textContent = App.utils.polishUiText(text);
    element.className = `app-message ${type}`.trim();
  },

  escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  },

  escapeDisplay(value) {
    return App.utils.escapeHtml(App.utils.polishUiText(value));
  }
};
