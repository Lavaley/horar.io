import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogDirectory = path.join(root, "photo-library/sky");
const catalog = JSON.parse(await readFile(path.join(catalogDirectory, "catalog.json"), "utf8"));
const locations = JSON.parse(await readFile(path.join(catalogDirectory, "locations.json"), "utf8"));
const entries = catalog.map(entry => ({
  creditUrl: entry.creditUrl,
  capturedDate: entry.capturedAt.slice(0, 10).replaceAll(":", "-"),
  ...(locations[String(entry.sourcePageId)] ?? {}),
}));
const production = process.argv.includes("--prod");
const output = execFileSync(process.execPath, [
  path.join(root, "node_modules/convex/bin/main.js"),
  "run",
  "admin:backfillPhotoInfo",
  JSON.stringify({ entries }),
  ...(production ? ["--prod"] : []),
], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const result = JSON.parse(output);
console.log(`${result.updated} fotografias atualizadas; ${result.missing.length} não encontradas.`);
if (result.missing.length) console.log(result.missing.join("\n"));
