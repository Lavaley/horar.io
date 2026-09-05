import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.resolve(process.argv[2] ?? path.join(root, "photo-library/catalog.json"));
const startDate = process.argv[3] ?? new Date(Date.now() - 10_800_000).toISOString().slice(0, 10);
const production = process.argv.includes("--prod");
const entries = JSON.parse(await readFile(manifestPath, "utf8"));
function run(name, args) {
  // No shell interpolation and no admin credential printed or passed to the browser.
  const response = execFileSync(process.execPath, [path.join(root, "node_modules/convex/bin/main.js"), "run", name, JSON.stringify(args), ...(production ? ["--prod"] : [])], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(response);
}
for (const [index, entry] of entries.entries()) {
  const challengeDate = entry.challengeDate ?? new Date(Date.parse(`${startDate}T12:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.correctTime)) throw new Error(`Invalid time at entry ${index + 1}`);
  if (run("admin:hasDate", { challengeDate })) { console.log(`${challengeDate}: already scheduled; preserved.`); continue; }
  const input = path.resolve(path.dirname(manifestPath), entry.file);
  // Re-encoding removes EXIF, XMP, IPTC, GPS, filenames and embedded timestamps.
  const image = await sharp(input).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const metadata = await sharp(image).metadata();
  if (metadata.exif || metadata.xmp || metadata.iptc) throw new Error("Image still contains metadata");
  const uploadUrl = run("admin:uploadUrl", {});
  const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: image });
  if (!uploaded.ok) throw new Error(`Upload failed (${uploaded.status})`);
  const { storageId } = await uploaded.json();
  const [hour, minute] = entry.correctTime.split(":").map(Number);
  run("admin:schedule", { image: { provider: "convex", storageId }, challengeDate, correctMinutes: hour * 60 + minute, ...(entry.alt ? { alt: entry.alt } : {}), ...(entry.objectPosition ? { objectPosition: entry.objectPosition } : {}), ...(entry.credit ? { credit: entry.credit } : {}), ...(entry.creditUrl ? { creditUrl: entry.creditUrl } : {}) });
  console.log(`${challengeDate}: photograph uploaded and scheduled.`);
}
