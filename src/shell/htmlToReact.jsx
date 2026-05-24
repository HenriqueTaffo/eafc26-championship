import React from "react";

const ATTRIBUTE_ALIASES = {
  autocomplete: "autoComplete",
  class: "className",
  colspan: "colSpan",
  for: "htmlFor",
  inputmode: "inputMode",
  maxlength: "maxLength",
  minlength: "minLength",
  readonly: "readOnly",
  referrerpolicy: "referrerPolicy",
  rowspan: "rowSpan",
  tabindex: "tabIndex"
};

const BOOLEAN_ATTRIBUTES = new Set([
  "autofocus",
  "disabled",
  "hidden",
  "multiple",
  "open",
  "required"
]);

function getSelectedOptionValue(element) {
  const selectedOption = element.querySelector("option[selected]");
  if (!selectedOption) return undefined;

  return selectedOption.getAttribute("value") ?? selectedOption.textContent;
}

function getElementProps(element, key) {
  const tagName = element.tagName.toLowerCase();
  const props = { key };

  Array.from(element.attributes).forEach(attribute => {
    const attributeName = attribute.name;

    if (attributeName === "selected") return;

    if (attributeName === "checked") {
      props.defaultChecked = true;
      return;
    }

    const propName = ATTRIBUTE_ALIASES[attributeName] || attributeName;

    if (BOOLEAN_ATTRIBUTES.has(attributeName)) {
      props[propName] = true;
      return;
    }

    props[propName] = attribute.value;
  });

  if (tagName === "select") {
    const defaultValue = getSelectedOptionValue(element);
    if (defaultValue !== undefined) props.defaultValue = defaultValue;
  }

  return props;
}

function nodeToReact(node, key) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  const props = getElementProps(node, key);
  const children = Array.from(node.childNodes)
    .map((childNode, childIndex) => nodeToReact(childNode, childIndex))
    .filter(child => child !== null);

  return React.createElement(tagName, props, ...children);
}

export function htmlToReact(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();

  return Array.from(template.content.childNodes)
    .map((node, index) => nodeToReact(node, index))
    .filter(node => node !== null);
}
