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
          if (id.includes("node_modules")) return "vendor";
          if (id.includes("/js/") || id.includes("\\js\\"))
            return "app-runtime";
        },
      },
    },
  },
});
