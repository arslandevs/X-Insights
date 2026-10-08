// Bundles each entry on its own. Content scripts are classic scripts, so they must be self-contained (no imports).
import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");
const common = { bundle: true, target: "chrome114", sourcemap: false, logLevel: "info" };
const jobs = [
  { entryPoints: ["src/inject.ts"], outfile: "dist/inject.js", format: "iife" },
  { entryPoints: ["src/bridge.ts"], outfile: "dist/bridge.js", format: "iife" },
  { entryPoints: ["src/background.ts"], outfile: "dist/background.js", format: "esm" },
  { entryPoints: ["src/ui/main.tsx"], outfile: "dist/sidepanel.js", format: "iife", jsx: "automatic", jsxImportSource: "preact" },
];

mkdirSync("dist", { recursive: true });
const copyStatic = () => {
  cpSync("manifest.json", "dist/manifest.json");
  cpSync("src/ui/sidepanel.html", "dist/sidepanel.html");
  cpSync("src/ui/sidepanel.css", "dist/sidepanel.css");
};

if (watch) {
  for (const j of jobs) (await context({ ...common, ...j })).watch();
  copyStatic();
  console.log("watching…");
} else {
  await Promise.all(jobs.map((j) => build({ ...common, ...j })));
  copyStatic();
}
