import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root = new URL('../photo-library/sky/', import.meta.url);
const candidates = JSON.parse(await readFile(new URL('candidates.json', root)));
const indices = [4,5,6,9,10,12,14,15,16,18,20,24,26,27,28,30,38,39,40,41,46,49,50,52,53,59,60,62,64,65,66,67,69,75,76,77,85,86,89,91,94,95,96,100,101,102,109,113,119,120,122,123,124,127,129,134,135,136,139,143];
await mkdir(new URL('images/', root), {recursive:true});
const selected = [];
for (const index of indices) {
  const p = candidates[index];
  const file = `images/${p.pageid}.jpg`;
  try {
    await readFile(new URL(file, root));
  } catch {
    const response = await fetch(p.thumburl ?? p.url, {signal:AbortSignal.timeout(45000)});
    if (!response.ok) throw new Error(`${index}: ${response.status}`);
    await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({width:1600,withoutEnlargement:true}).jpeg({quality:88}).toFile(fileURLToPath(new URL(file, root)));
  }
  selected.push({...p,index,file});
  console.log(`Prepared ${index}`);
}
await writeFile(new URL('selection.json',root),JSON.stringify(selected,null,2));
for(let page=0;page<3;page++) {
  const cells = [];
  for (const [i,p] of selected.slice(page*20,page*20+20).entries()) {
    const img = await sharp(await readFile(new URL(p.file,root))).resize(250,150,{fit:'contain',background:'#222'}).toBuffer();
    const label = Buffer.from(`<svg width="250" height="25"><rect width="250" height="25" fill="white"/><text x="8" y="18" font-size="16">${p.index} | ${p.timestamp.slice(11,16)}</text></svg>`);
    cells.push({input:img,left:(i%4)*250,top:Math.floor(i/4)*175},{input:label,left:(i%4)*250,top:Math.floor(i/4)*175+150});
  }
  await sharp({create:{width:1000,height:875,channels:3,background:'#222'}}).composite(cells).jpeg().toFile(fileURLToPath(new URL(`contact-${page}.jpg`,root)));
}

