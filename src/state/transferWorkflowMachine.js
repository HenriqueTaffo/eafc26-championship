import { createMachine } from "xstate";

export const transferWorkflowMachine = createMachine({
  id: "transferWorkflow",
  initial: "idle",
  states: {
    idle: {
      on: {
        SCOUT: "scouting",
        BLOCK: "blocked",
      },
    },
    scouting: {
      on: {
        SHORTLIST: "shortlisted",
        PROPOSE: "proposal",
        BLOCK: "blocked",
      },
    },
    shortlisted: {
      on: {
        PROPOSE: "proposal",
        LOSE: "blocked",
        BLOCK: "blocked",
      },
    },
    proposal: {
      on: {
        SELLER_REVIEW: "sellerReview",
        BUYER_REVIEW: "buyerReview",
        SIGN: "signature",
        REJECT: "blocked",
      },
    },
    sellerReview: {
      on: {
        BUYER_REVIEW: "buyerReview",
        SIGN: "signature",
        REJECT: "blocked",
      },
    },
    buyerReview: {
      on: {
        SIGN: "signature",
        REJECT: "blocked",
      },
    },
    signature: {
      on: {
        COMPLETE: "completed",
        REJECT: "blocked",
      },
    },
    completed: {
      type: "final",
    },
    blocked: {},
  },
  on: {
    RESET: ".idle",
  },
});

export const workflowLabels = {
  idle: "Sem alvo",
  scouting: "Scout ativo",
  shortlisted: "Shortlist",
  proposal: "Proposta",
  sellerReview: "Vendedor",
  buyerReview: "Comprador",
  signature: "Assinatura",
  completed: "Concluida",
  blocked: "Bloqueada",
};

export const workflowEventPaths = {
  idle: [],
  scouting: ["SCOUT"],
  shortlisted: ["SCOUT", "SHORTLIST"],
  proposal: ["SCOUT", "PROPOSE"],
  sellerReview: ["SCOUT", "PROPOSE", "SELLER_REVIEW"],
  buyerReview: ["SCOUT", "PROPOSE", "BUYER_REVIEW"],
  signature: ["SCOUT", "PROPOSE", "SIGN"],
  completed: ["SCOUT", "PROPOSE", "SIGN", "COMPLETE"],
  blocked: ["BLOCK"],
};

export function resolveTransferWorkflowState({
  candidate,
  shortlist,
  proposals = [],
  locked = false,
} = {}) {
  if (locked) return "blocked";
  const pending = proposals.find((item) => {
    const status = String(item.status || item.state || "").toLowerCase();
    return !["accepted", "approved", "completed", "rejected", "cancelled"].some(
      (closed) => status.includes(closed),
    );
  });
  if (pending) {
    const status = String(pending.status || pending.state || "").toLowerCase();
    if (status.includes("buyer") || status.includes("signature")) {
      return "buyerReview";
    }
    if (status.includes("seller") || status.includes("pending")) {
      return "sellerReview";
    }
    return "proposal";
  }
  if (shortlist) return "shortlisted";
  if (candidate?.player) return "scouting";
  return "idle";
}
