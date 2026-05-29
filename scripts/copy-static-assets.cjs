const { copyFileSync, cpSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const sourceDir = join(process.cwd(), "assets");
const outputDir = join(process.cwd(), "dist", "assets");
const lazyModuleOutputDir = join(process.cwd(), "dist", "js");
const htmlOutputDir = join(process.cwd(), "dist");
const lazyModules = ["app.js", "market-avatars.js"];
const htmlRoutes = [
  "standings",
  "league/standings",
  "league/calendar",
  "league/cups",
  "league/events",
  "club/inbox",
  "club/commercial",
  "club/squad",
  "club/transfers",
  "ops/commissioner",
  "ops/intelligence",
  "ops/results",
];

if (existsSync(sourceDir)) {
  mkdirSync(outputDir, { recursive: true });
  cpSync(sourceDir, outputDir, { recursive: true });
}

mkdirSync(lazyModuleOutputDir, { recursive: true });
lazyModules.forEach((file) => {
  const sourceFile = join(process.cwd(), "js", file);
  if (existsSync(sourceFile)) {
    copyFileSync(sourceFile, join(lazyModuleOutputDir, file));
  }
});

const builtIndexFile = join(htmlOutputDir, "index.html");
const spaFallbackFile = join(htmlOutputDir, "404.html");
if (existsSync(builtIndexFile)) {
  copyFileSync(builtIndexFile, spaFallbackFile);
  htmlRoutes.forEach((route) => {
    const routeDir = join(htmlOutputDir, route);
    mkdirSync(routeDir, { recursive: true });
    copyFileSync(builtIndexFile, join(routeDir, "index.html"));
  });
}
