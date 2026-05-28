const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const { VitePWA } = require("vite-plugin-pwa");

module.exports = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "assets/4linhas-icon.png",
        "assets/4linhas-icon-light.png",
        "assets/4linhas-wordmark-light.png",
      ],
      manifest: {
        name: "4 Linhas",
        short_name: "4 Linhas",
        description: "Painel operacional da liga EAFC 26.",
        theme_color: "#070909",
        background_color: "#070909",
        lang: "pt-BR",
        display: "standalone",
        start_url: "./index.html",
        scope: "./",
        icons: [
          {
            src: "assets/4linhas-icon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "assets/4linhas-icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fdippspwpugnxwxmjnqf\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "eafc26-supabase-runtime",
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  base: "./",
  build: {
    target: "es2019",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = String(id).replace(/\\/g, "/");
          if (id.includes("node_modules")) {
            if (normalizedId.includes("/node_modules/@sentry/")) {
              return "sentry";
            }
            if (
              normalizedId.includes("/node_modules/@tanstack/") ||
              normalizedId.includes("/node_modules/@dnd-kit/") ||
              normalizedId.includes("/node_modules/cmdk/") ||
              normalizedId.includes("/node_modules/react-hook-form/") ||
              normalizedId.includes("/node_modules/@hookform/") ||
              normalizedId.includes("/node_modules/xstate/") ||
              normalizedId.includes("/node_modules/@xstate/") ||
              normalizedId.includes("/node_modules/zod/") ||
              normalizedId.includes("/node_modules/fuse.js/") ||
              normalizedId.includes("/node_modules/rrule/") ||
              normalizedId.includes("/node_modules/date-fns")
            ) {
              return "workspace-tools";
            }
            return "vendor";
          }
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
