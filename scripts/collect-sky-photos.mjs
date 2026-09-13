import { mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../photo-library/sky/', import.meta.url);
await mkdir(directory, { recursive: true });
const candidates = new Map();
for (const term of ['sky clouds', 'sunrise sky', 'sunset sky', 'blue sky clouds', 'night sky moon']) {
  const parameters = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${term} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '40', prop: 'imageinfo', iiprop: 'url|metadata|extmetadata|size', iiurlwidth: '1600' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${parameters}`, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Commons: ${response.status}`);
  const data = await response.json();
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const metadata = Object.fromEntries(info.metadata.map(item => [item.name, item.value]));
    const timestamp = metadata.DateTimeOriginal;
    const license = info.extmetadata.LicenseShortName?.value ?? '';
    if (!/^20\d\d:\d\d:\d\d \d\d:\d\d:\d\d$/.test(timestamp ?? '') || !/^(CC BY|CC0|Public domain)/.test(license) || info.width < 1000 || info.height < 650) continue;
    candidates.set(page.pageid, { pageid: page.pageid, title: page.title, timestamp, metadata, ...info });
  }
  console.log(`${term}: ${candidates.size} candidates with capture timestamps`);
}
await writeFile(new URL('candidates.json', directory), JSON.stringify([...candidates.values()], null, 2));
