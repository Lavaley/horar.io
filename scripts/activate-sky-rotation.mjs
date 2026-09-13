import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url));
const startDate = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '')) throw new Error('Provide the imported catalog start date (YYYY-MM-DD).');
const production = process.argv.includes('--prod') ? ['--prod'] : [];
const run = args => {
  const output = execFileSync(process.execPath,[cli,...args,...production],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','inherit']}).trim();
  return output ? JSON.parse(output) : null;
};
const catalog = JSON.parse(await readFile(new URL('../photo-library/sky/catalog.json',import.meta.url)));
assert.equal(catalog.length,50);
const rows = run(['data','photographs','--limit','1000','--format','json']);
const photographIds = catalog.map((entry,index)=>{
  const date = new Date(Date.parse(`${startDate}T12:00:00Z`)+index*86400000).toISOString().slice(0,10);
  const matches = rows.filter(row=>row.challengeDate===date);
  assert.equal(matches.length,1,`Missing or duplicate ${date}`);
  const photo = matches[0];
  const [hour,minute] = entry.correctTime.split(':').map(Number);
  assert.equal(photo.correctMinutes,hour*60+minute);
  assert.equal(photo.creditUrl,entry.creditUrl);
  assert.equal(photo.image.provider,'convex');
  return photo._id;
});
run(['run','admin:activateRotation',JSON.stringify({startDate,photographIds})]);
console.log(`Activated 50-photo perpetual rotation starting ${startDate}.`);
