const { readFileSync, readdirSync, statSync } = require("fs");
const { join, sep } = require("path");
const { spawnSync } = require("child_process");

const roots = ["js", "scripts"];
const extensions = new Set([".js", ".cjs"]);
const files = [];

function collect(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collect(fullPath);
      continue;
    }

    const ext = fullPath.slice(fullPath.lastIndexOf("."));
    if (extensions.has(ext)) files.push(fullPath);
  }
}

roots.forEach((root) => {
  try {
    collect(root);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
});

let failed = false;

for (const file of files) {
  const isBrowserModule = file.startsWith(`js${sep}`) && file.endsWith(".js");
  const result = isBrowserModule
    ? spawnSync(process.execPath, ["--input-type=module", "--check"], {
        input: readFileSync(file, "utf8"),
        stdio: ["pipe", "inherit", "inherit"],
      })
    : spawnSync(process.execPath, ["--check", file], {
        stdio: "inherit",
      });

  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
