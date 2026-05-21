const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        App: "readonly",
        document: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        Intl: "readonly",
        localStorage: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
        window: "readonly"
      }
    }
  }
];
