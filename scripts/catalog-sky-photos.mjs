import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../photo-library/sky/', import.meta.url);
const selection = JSON.parse(await readFile(new URL('selection.json',root)));
const rejected = new Set([15,24,38,39,49,65,67,85,101,124]);
const clean = value => value.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#160;|&nbsp;/g,' ').trim();
const photos = selection.filter(p=>!rejected.has(p.index)).map(p=>({
  file:p.file, correctTime:p.timestamp.slice(11,16),
  alt:{pt:'Fotografia do céu e da paisagem.',en:'Photograph of the sky and landscape.'},
  credit:`${clean(p.extmetadata.Artist?.value ?? 'Wikimedia Commons')} · ${p.extmetadata.LicenseShortName.value} · redimensionada, metadados removidos`,
  creditUrl:p.descriptionurl,
  sourceTitle:p.title, sourceUrl:p.url, sourcePageId:p.pageid,
  capturedAt:p.timestamp, timeEvidence:'EXIF DateTimeOriginal; horário registrado pela câmera, sem conversão de fuso. Não é uma certificação independente do relógio.',
  license:p.extmetadata.LicenseShortName.value,licenseUrl:p.extmetadata.LicenseUrl?.value ?? 'https://creativecommons.org/publicdomain/mark/1.0/',
  originalMetadata:p.metadata,
}));
if(photos.length!==50) throw new Error('Expected 50');
// Interleave morning, daytime, evening and night rather than grouping subjects.
const ordered = Array.from({length:50},(_,i)=>photos[(i*17)%50]);
await writeFile(new URL('catalog.json',root),JSON.stringify(ordered,null,2)+'\n');
await writeFile(new URL('CATALOGO.md',root),'# Catálogo de 50 fotografias reais\n\nHorários conferidos no campo EXIF DateTimeOriginal publicado pela Wikimedia Commons. São os horários registrados pelas câmeras, sem inferir fusos ou usar datas de upload. Não representam uma certificação independente da precisão do relógio. Fotos revisadas visualmente, com predominância do céu. Cópias JPEG redimensionadas, sem metadados; cada imagem mantém a licença indicada na fonte.\n\n'+ordered.map((p,i)=>`${i+1}. [${p.sourceTitle.slice(5)}](${p.creditUrl}) — **${p.correctTime}**, captura ${p.capturedAt.slice(0,10)}. ${p.credit}. [Licença](${p.licenseUrl}).`).join('\n\n')+'\n');
console.log('50 photographs catalogued');
