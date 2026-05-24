const { copyFileSync, cpSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const sourceDir = join(process.cwd(), "assets");
const outputDir = join(process.cwd(), "dist", "assets");
const lazyModuleOutputDir = join(process.cwd(), "dist", "js");
const lazyModules = ["app.js", "market-avatars.js"];

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
