import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportsDir = path.join(rootDir, "reports");
const htmlPath = path.join(reportsDir, "transfer-negotiation-preview.html");
const pdfPath = path.join(reportsDir, "transfer-negotiation-preview.pdf");
const jsonPath = path.join(reportsDir, "transfer-negotiation-preview.json");

function roundMoney(value, minimum = 100000) {
  const amount = Math.max(Number(value || 0), Number(minimum || 0));
  return Math.max(Number(minimum || 0), Math.round(amount / 100000) * 100000);
}

function roundSalary(value) {
  return Math.max(1500, Math.round(Number(value || 0) / 500) * 500);
}

function stableHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value || "").toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function clubResponse({
  referenceValue,
  offerValue,
  overall,
  round = 0,
  fromClub = "Clube vendedor",
  tradeInPlayer = "",
  tradeInCredit = 0,
  tradeInValue = 0,
  tradeInOverall = 0,
}) {
  const reference = roundMoney(referenceValue);
  const offer = roundMoney(offerValue);
  const seed = stableHash(fromClub);
  const personality = 1 + (((seed % 17) - 8) / 100);
  const multiplier =
    overall >= 90
      ? 1.38
      : overall >= 87
        ? 1.31
        : overall >= 84
          ? 1.24
          : overall >= 81
            ? 1.18
            : overall >= 78
              ? 1.13
              : overall >= 74
                ? 1.08
                : 1.04;
  const floor = roundMoney(reference * multiplier * personality);

  const credit = Math.max(0, tradeInCredit || 0);
  const tradeValue = Math.max(0, tradeInValue || 0);
  const tradeGap = Number(tradeInOverall || 0) - Number(overall || 0);
  let tradeFactor = 0;
  if (tradeInPlayer && credit > 0) {
    tradeFactor =
      tradeInOverall <= 0
        ? 0.25
        : tradeGap >= 2
          ? 0.9
          : tradeGap >= -1
            ? 0.78
            : tradeGap >= -4
              ? 0.6
              : tradeGap >= -8
                ? 0.4
                : 0.22;
    if (overall >= 86 && tradeGap < -3) tradeFactor *= 0.72;
    else if (overall >= 82 && tradeGap < -5) tradeFactor *= 0.82;
  }

  const tradeCap =
    floor *
    (overall >= 86 && tradeGap < -3
      ? 0.18
      : tradeGap < -6
        ? 0.24
        : tradeGap < -3
          ? 0.32
          : 0.45);
  const tradeUtility = tradeInPlayer
    ? roundMoney(Math.min(credit, tradeValue * tradeFactor, tradeCap), 0)
    : 0;
  const tradePenalty = Math.max(0, credit - tradeUtility);
  const cashOffer = Math.max(0, offer - credit);
  const effectiveOffer = cashOffer + tradeUtility;
  const requiredGross = roundMoney(floor + credit - tradeUtility);
  const score = Math.round((effectiveOffer / floor) * 100);
  const rejectBand = 0.68 + Math.min(round, 3) * 0.04;

  let tradeMessage = "";
  if (tradeInPlayer) {
    tradeMessage =
      tradeUtility <= 0
        ? "Troca sem utilidade para o vendedor."
        : tradeUtility < credit * 0.55
          ? "Troca aceita parcialmente; exige caixa extra."
          : tradeUtility < credit * 0.8
            ? "Troca ajuda, mas nao vale o abatimento integral."
            : "Troca com encaixe esportivo razoavel.";
  }

  if (effectiveOffer >= floor) {
    return {
      status: "player_terms",
      sellerDecision: "accepted",
      sellerValue: Math.max(offer, requiredGross),
      sellerFloor: floor,
      effectiveOffer,
      tradeUtility,
      tradePenalty,
      clubScore: score,
      message: `Clube aprovou a venda. ${tradeMessage}`.trim(),
    };
  }

  if (round >= 3 || effectiveOffer < floor * rejectBand) {
    return {
      status: "rejected",
      sellerDecision: "rejected",
      sellerValue: offer,
      sellerFloor: floor,
      effectiveOffer,
      tradeUtility,
      tradePenalty,
      clubScore: score,
      message: `Clube recusou por distancia de valor. ${tradeMessage}`.trim(),
    };
  }

  return {
    status: "buyer_review",
    sellerDecision: "counter",
    sellerValue: roundMoney(Math.max(offer * 1.04, requiredGross * (1 - Math.min(round, 3) * 0.025))),
    sellerFloor: floor,
    effectiveOffer,
    tradeUtility,
    tradePenalty,
    clubScore: score,
    message: `Clube fez contraproposta pelo pacote completo. ${tradeMessage}`.trim(),
  };
}

function playerSalaryFloor({ overall, referenceValue, currentWeeklySalary = 0 }) {
  const model = Math.max(
    overall >= 90
      ? 220000
      : overall >= 87
        ? 150000
        : overall >= 84
          ? 95000
          : overall >= 81
            ? 62000
            : overall >= 78
              ? 38000
              : overall >= 75
                ? 24000
                : overall >= 72
                  ? 15000
                  : 8000,
    Number(referenceValue || 0) *
      (overall >= 88 ? 0.0016 : overall >= 84 ? 0.0012 : overall >= 80 ? 0.0009 : 0.00065),
  );
  const premium =
    overall >= 88 ? 1.18 : overall >= 84 ? 1.14 : overall >= 80 ? 1.1 : overall >= 76 ? 1.06 : 1.03;
  return roundSalary(Math.max(Number(currentWeeklySalary || 0) * premium, model));
}

function playerResponse({ salaryOffer, salaryFloor, round = 0 }) {
  const offer = roundSalary(salaryOffer);
  if (offer >= salaryFloor) {
    return {
      status: "signature_pending",
      playerDecision: "accepted",
      weeklySalary: offer,
      message: "Jogador aceitou os termos e segue para assinatura.",
    };
  }
  if (round >= 2 && offer < salaryFloor * 0.88) {
    return {
      status: "rejected",
      playerDecision: "rejected",
      weeklySalary: offer,
      message: "Jogador recusou depois de nova oferta baixa.",
    };
  }
  return {
    status: "player_terms",
    playerDecision: "counter",
    weeklySalary: Math.max(salaryFloor, roundSalary(Math.max(offer * 1.12, salaryFloor))),
    message: offer < salaryFloor * 0.75 ? "Agente respondeu com pedido firme." : "Agente pediu ajuste salarial.",
  };
}

const scenarios = [
  {
    name: "Oferta justa sem troca",
    player: "Meia 82 OVR",
    fromClub: "Real Betis",
    overall: 82,
    referenceValue: 18000000,
    offerValue: 20500000,
    salaryOffer: 52000,
    currentWeeklySalary: 42000,
    buyerAction: "accept_counter",
  },
  {
    name: "Lowball com jogador pouco util",
    player: "Atacante 84 OVR",
    fromClub: "Lyon",
    overall: 84,
    referenceValue: 26000000,
    offerValue: 23000000,
    tradeInPlayer: "Reserva 73 OVR",
    tradeInCredit: 9000000,
    tradeInValue: 10500000,
    tradeInOverall: 73,
    salaryOffer: 48000,
    currentWeeklySalary: 65000,
    buyerAction: "low_salary_counter",
  },
  {
    name: "Troca com encaixe esportivo",
    player: "Volante 80 OVR",
    fromClub: "Fiorentina",
    overall: 80,
    referenceValue: 14000000,
    offerValue: 15800000,
    tradeInPlayer: "Lateral 79 OVR",
    tradeInCredit: 5500000,
    tradeInValue: 7000000,
    tradeInOverall: 79,
    salaryOffer: 36000,
    currentWeeklySalary: 30000,
    buyerAction: "accept_player_terms",
  },
  {
    name: "Jogador estrela protegido",
    player: "Ponta 89 OVR",
    fromClub: "Napoli",
    overall: 89,
    referenceValue: 90000000,
    offerValue: 98000000,
    tradeInPlayer: "Meia 80 OVR",
    tradeInCredit: 25000000,
    tradeInValue: 30000000,
    tradeInOverall: 80,
    salaryOffer: 110000,
    currentWeeklySalary: 180000,
    buyerAction: "meet_club_then_salary",
  },
  {
    name: "Clube rejeita pacote distante",
    player: "Zagueiro 86 OVR",
    fromClub: "Sevilla",
    overall: 86,
    referenceValue: 52000000,
    offerValue: 36000000,
    tradeInPlayer: "Ponta 74 OVR",
    tradeInCredit: 12000000,
    tradeInValue: 15000000,
    tradeInOverall: 74,
    salaryOffer: 80000,
    currentWeeklySalary: 90000,
    buyerAction: "stop",
  },
];

function simulateScenario(input) {
  const steps = [];
  let club = clubResponse(input);
  steps.push({
    phase: "Clube vendedor",
    status: club.status,
    decision: club.sellerDecision,
    message: club.message,
    value: club.sellerValue,
    score: club.clubScore,
    tradeUtility: club.tradeUtility,
    tradePenalty: club.tradePenalty,
  });

  if (club.status === "buyer_review" && input.buyerAction !== "stop") {
    const nextOffer =
      input.buyerAction === "accept_counter"
        ? club.sellerValue
        : input.buyerAction === "meet_club_then_salary"
          ? club.sellerValue
          : Math.round((club.sellerValue * 0.96) / 100000) * 100000;
    club = clubResponse({ ...input, offerValue: nextOffer, round: 1 });
    steps.push({
      phase: "Resposta do comprador ao clube",
      status: club.status,
      decision: club.sellerDecision,
      message: club.message,
      value: club.sellerValue,
      score: club.clubScore,
      tradeUtility: club.tradeUtility,
      tradePenalty: club.tradePenalty,
    });
  }

  let playerTerms = null;
  let finalStatus = club.status;
  if (club.status === "player_terms") {
    const salaryFloor = playerSalaryFloor(input);
    steps.push({
      phase: "Agente do jogador",
      status: "player_terms",
      decision: "counter",
      message: `Pedido salarial inicial: ${formatCurrency(salaryFloor)}/sem.`,
      salary: salaryFloor,
    });

    const salaryOffer =
      input.buyerAction === "low_salary_counter"
        ? Math.round((salaryFloor * 0.72) / 500) * 500
        : input.buyerAction === "meet_club_then_salary"
          ? Math.round((salaryFloor * 0.94) / 500) * 500
          : salaryFloor;
    playerTerms = playerResponse({ salaryOffer, salaryFloor, round: 1 });
    steps.push({
      phase: "Resposta do comprador ao jogador",
      status: playerTerms.status,
      decision: playerTerms.playerDecision,
      message: playerTerms.message,
      salary: playerTerms.weeklySalary,
    });
    finalStatus = playerTerms.status;
  }

  return {
    ...input,
    finalStatus,
    club,
    playerTerms,
    steps,
  };
}

function statusTone(status) {
  if (status === "signature_pending") return "success";
  if (status === "player_terms" || status === "buyer_review") return "warn";
  if (status === "rejected") return "danger";
  return "neutral";
}

function renderHtml(results) {
  const generatedAt = new Date().toLocaleString("pt-BR");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Preview - Inteligencia de negociacao externa</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #15202b; background: #f6f8fb; }
    header { padding: 22px 24px; background: #12202f; color: #fff; border-radius: 10px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    header p { margin: 0; color: #d6e3ee; }
    section { margin-top: 18px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .metric, .scenario { background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; padding: 14px; }
    .metric span, .scenario small { color: #607086; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .metric strong { display: block; font-size: 22px; margin-top: 4px; }
    .scenario { page-break-inside: avoid; margin-bottom: 14px; }
    .scenario h2 { display: flex; justify-content: space-between; gap: 12px; margin: 0 0 6px; font-size: 18px; }
    .pill { border-radius: 999px; padding: 4px 9px; font-size: 11px; text-transform: uppercase; }
    .success { background: #dff7ea; color: #176b3a; }
    .warn { background: #fff1cc; color: #8a5a00; }
    .danger { background: #fde0df; color: #9a2720; }
    .neutral { background: #edf2f7; color: #52616f; }
    .terms { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .term { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px; }
    .term b { display: block; margin-top: 4px; font-size: 13px; }
    .steps { display: grid; gap: 8px; }
    .step { border-left: 4px solid #7c8aa5; background: #fbfdff; padding: 10px 12px; border-radius: 6px; }
    .step strong { display: block; margin-bottom: 4px; }
    .step p { margin: 0; color: #344255; font-size: 13px; }
    footer { margin-top: 18px; color: #68788f; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Preview - inteligencia de clubes externos e etapa do jogador</h1>
    <p>Gerado em ${generatedAt}. Esta simulacao nao altera Supabase nem janela de transferencias.</p>
  </header>

  <section class="summary">
    <div class="metric"><span>Cenarios</span><strong>${results.length}</strong></div>
    <div class="metric"><span>Assinatura</span><strong>${results.filter((item) => item.finalStatus === "signature_pending").length}</strong></div>
    <div class="metric"><span>Termos jogador</span><strong>${results.filter((item) => item.finalStatus === "player_terms").length}</strong></div>
    <div class="metric"><span>Recusadas</span><strong>${results.filter((item) => item.finalStatus === "rejected").length}</strong></div>
  </section>

  <section>
    ${results
      .map(
        (item) => `
    <article class="scenario">
      <h2>${item.name}<span class="pill ${statusTone(item.finalStatus)}">${item.finalStatus}</span></h2>
      <small>${item.player} - ${item.fromClub}</small>
      <div class="terms">
        <div class="term"><span>Referencia</span><b>${formatCurrency(item.referenceValue)}</b></div>
        <div class="term"><span>Oferta inicial</span><b>${formatCurrency(item.offerValue)}</b></div>
        <div class="term"><span>Troca</span><b>${item.tradeInPlayer ? `${item.tradeInPlayer} (${formatCurrency(item.tradeInCredit)})` : "Sem troca"}</b></div>
        <div class="term"><span>Salario inicial</span><b>${formatCurrency(item.salaryOffer)}/sem</b></div>
      </div>
      <div class="steps">
        ${item.steps
          .map(
            (step) => `
        <div class="step">
          <strong>${step.phase} - ${step.decision || step.status}</strong>
          <p>${step.message}</p>
          <p>${step.value ? `Valor: ${formatCurrency(step.value)}. ` : ""}${step.salary ? `Salario: ${formatCurrency(step.salary)}/sem. ` : ""}${Number.isFinite(step.score) ? `Score clube: ${step.score}%. ` : ""}${step.tradePenalty ? `Penalidade troca: ${formatCurrency(step.tradePenalty)}.` : ""}</p>
        </div>`,
          )
          .join("")}
      </div>
    </article>`,
      )
      .join("")}
  </section>

  <footer>
    Modelo proposto: clube avalia valor/pacote primeiro; jogador negocia salario somente depois da aprovacao de venda.
  </footer>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(reportsDir, { recursive: true });
  const results = scenarios.map(simulateScenario);
  const html = renderHtml(results);
  await fs.writeFile(htmlPath, html, "utf8");
  await fs.writeFile(jsonPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }

  console.log(`Preview HTML: ${htmlPath}`);
  console.log(`Preview PDF: ${pdfPath}`);
  console.log(`Preview JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
