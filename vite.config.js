const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2019",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = String(id).replace(/\\/g, "/");
          if (id.includes("node_modules")) return "vendor";
          if (normalizedId.includes("/src/views/SharedClubComponents.jsx")) {
            return "shared-club-view";
          }
          if (normalizedId.includes("/js/")) {
            if (/(\/js\/)(app|api|auth|config|main|ui|utils)\.js$/.test(normalizedId)) {
              return "app-core";
            }
            if (normalizedId.includes("/js/transfers")) return "transfers-runtime";
            if (
              normalizedId.includes("/js/players") ||
              normalizedId.includes("/js/events") ||
              normalizedId.includes("/js/calendar")
            ) {
              return "club-runtime";
            }
            if (
              normalizedId.includes("/js/governance") ||
              normalizedId.includes("/js/forms")
            ) {
              return "league-runtime";
            }
            return "app-runtime";
          }
        },
      },
    },
  },
});
