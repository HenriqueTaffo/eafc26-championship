const js = require("@eslint/js");

const browserGlobals = {
  AbortController: "readonly",
  App: "readonly",
  alert: "readonly",
  caches: "readonly",
  confirm: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  FormData: "readonly",
  Intl: "readonly",
  localStorage: "readonly",
  MutationObserver: "readonly",
  Node: "readonly",
  sessionStorage: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  URLSearchParams: "readonly",
  window: "readonly",
};

module.exports = [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "no-unused-vars": [
        "error",
        { caughtErrors: "none", varsIgnorePattern: "^[A-Z]" },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    rules: {
      "no-unused-vars": [
        "error",
        { caughtErrors: "none", varsIgnorePattern: "^[A-Z]" },
      ],
    },
  },
  {
    files: ["scripts/**/*.cjs", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
];
