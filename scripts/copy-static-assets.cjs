const { cpSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const sourceDir = join(process.cwd(), "assets");
const outputDir = join(process.cwd(), "dist", "assets");

if (!existsSync(sourceDir)) process.exit(0);

mkdirSync(outputDir, { recursive: true });
cpSync(sourceDir, outputDir, { recursive: true });

