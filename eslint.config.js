const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
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
        sessionStorage: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }]
    }
  }
];
