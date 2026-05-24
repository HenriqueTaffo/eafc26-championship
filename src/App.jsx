import { useEffect, useMemo } from "react";
import staticShellMarkup from "./legacyShell";
import { htmlToReact } from "./shell/htmlToReact.jsx";

const ACCORDION_SELECTOR = [
  "#submitView .submit-card",
  ".transfer-workbench .submit-card",
  "#eventsView .events-intro-card",
  "#cupsView .cup-prize-card",
  "#transfersView .rule-card",
  ".legend-block"
].join(",");

function getAccordionHeader(card) {
  return (
    card.querySelector(":scope > .submit-card-header") ||
    card.querySelector(":scope > .home-panel-header") ||
    card.querySelector(":scope > h2") ||
    card.querySelector(":scope > h3") ||
    card.firstElementChild
  );
}

function enhanceAccordionCards(root = document) {
  root.querySelectorAll(ACCORDION_SELECTOR).forEach(card => {
    if (card.dataset.reactAccordion === "true") return;

    const header = getAccordionHeader(card);
    if (!header) return;

    card.dataset.reactAccordion = "true";
    card.classList.add("react-accordion-card");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "react-accordion-toggle";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Alternar painel");
    button.innerHTML = "<span></span>";
    button.addEventListener("click", event => {
      event.preventDefault();
      const isCollapsed = card.classList.toggle("is-collapsed");
      button.setAttribute("aria-expanded", String(!isCollapsed));
    });

    header.classList.add("react-accordion-header");
    header.appendChild(button);
  });
}

function useAccordionEnhancement() {
  useEffect(() => {
    enhanceAccordionCards();

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            enhanceAccordionCards(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

export default function App() {
  useAccordionEnhancement();
  const shell = useMemo(() => htmlToReact(staticShellMarkup), []);

  return <div className="react-shell">{shell}</div>;
}
