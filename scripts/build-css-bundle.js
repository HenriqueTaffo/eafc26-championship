const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const modulesDir = path.join(root, "css", "modules");
const outputFile = path.join(root, "css", "app.css");

const files = fs
  .readdirSync(modulesDir)
  .filter((file) => file.endsWith(".css"))
  .sort();

const chunks = [
  "/* Generated from css/modules/*.css. Edit modules, then run npm run build:css. */",
];

for (const file of files) {
  const fullPath = path.join(modulesDir, file);
  const source = fs
    .readFileSync(fullPath, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("@import "))
    .join("\n");

  chunks.push(`\n/* css/modules/${file} */\n${source}`);
}

fs.writeFileSync(outputFile, `${chunks.join("\n")}\n`);
console.log(`Wrote ${path.relative(root, outputFile)} from ${files.length} module(s).`);
