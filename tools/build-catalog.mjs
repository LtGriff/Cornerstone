// Cornerstone catalog builder. Run on your own computer (Node 18+), not in the browser:
//   MB_CONTACT=you@example.com node tools/build-catalog.mjs
// Reads tools/catalog-seed.json, looks every album up on MusicBrainz (1 request/second, as they ask),
// downloads a small front cover for each from the Cover Art Archive, and writes:
//   docs/covers/<mbid>.jpg   small thumbnails, served from your own GitHub Pages
//   docs/catalog.json        what the Browse tab loads (instant, no lookups in the browser)
//   tools/report.txt         anything that did not match or has no cover, so you can fix the seed
// Safe to stop and re-run: finished lookups and downloaded covers are skipped.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contact = process.env.MB_CONTACT;
if (!contact) {
  console.error('Set MB_CONTACT to your email so MusicBrainz can reach you, e.g.\n  MB_CONTACT=you@example.com node tools/build-catalog.mjs');
  process.exit(1);
}
const UA = `Cornerstone/0.1 ( ${contact} )`;
const seed = JSON.parse(await readFile(join(here, 'catalog-seed.json'), 'utf8'));
const cachePath = join(here, '.cache.json');
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first run */ }
await mkdir(join(root, 'docs', 'covers'), { recursive: true });

const wait = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function polite(url, gap, headers = {}) {
  const elapsed = Date.now() - lastCall;
  if (elapsed < gap) await wait(gap - elapsed);
  lastCall = Date.now();
  // network hiccups (timeouts, resets) are retried a few times, then treated as a failed request instead of crashing the run
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { return await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); }
    catch (error) { console.log(`network error (try ${attempt}): ${error?.cause?.code || error?.name || error}`); if (attempt < 4) await wait(15000 * attempt); }
  }
  return new Response('{}', { status: 599 });
}

const norm = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const plain = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const firstArtist = a => a.split(/\s*(?:&| and |,|feat\.)\s*/i)[0];
const same = (a, b) => { const x = norm(a), y = norm(b); if (!x || !y) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

async function search(query, limit = 8) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await polite(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`, 1100, { Accept: 'application/json' });
    if (r.ok) return (await r.json())['release-groups'] || [];
    if (r.status === 429 || r.status === 503) { await wait(8000 * (attempt + 1)); continue; }
    return [];
  }
  return [];
}

function pick(results, artist, title) {
  const good = results.filter(g => {
    const credit = (g['artist-credit'] || []).map(c => c.name).join(' ');
    return same(g.title, title) && same(credit, firstArtist(artist));
  });
  // Prefer plain studio albums over live / compilation / remix releases, then higher score.
  good.sort((a, b) => ((a['secondary-types'] || []).length - (b['secondary-types'] || []).length) || (b.score - a.score));
  return good[0] || null;
}

async function lookup(artist, title) {
  const clean = s => s.replace(/["\\]/g, '');
  let hit = pick(await search(`releasegroup:"${clean(title)}" AND artist:"${clean(artist)}"`), artist, title);
  if (!hit) hit = pick(await search(`releasegroup:"${clean(title)}"`), artist, title);
  // Last tries: accents and symbols can trip the exact search, so look by artist alone and match the title ourselves.
  if (!hit) hit = pick(await search(`artist:"${clean(plain(firstArtist(artist)))}" AND releasegroup:${clean(plain(title)).split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).join(' AND releasegroup:') || 'x'}`, 25), artist, title);
  if (!hit) hit = pick(await search(`artist:"${clean(plain(firstArtist(artist)))}" AND type:album`, 100), artist, title);
  if (!hit) return { miss: true };
  return { mbid: hit.id, mbTitle: hit.title, mbArtist: (hit['artist-credit'] || []).map(c => c.name).join(''), score: hit.score };
}

async function getCover(mbid) {
  const file = join(root, 'docs', 'covers', `${mbid}.jpg`);
  try { await access(file); return true; } catch { /* not downloaded yet */ }
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await polite(`https://coverartarchive.org/release-group/${mbid}/front-250`, 400, { Accept: 'image/jpeg,image/*' });
    if (r.ok) { await writeFile(file, Buffer.from(await r.arrayBuffer())); return true; }
    if (r.status === 404) return false;
    await wait(2000);
  }
  return false;
}

const catalog = { built: new Date().toISOString(), genres: {} };
const report = [];
const total = Object.values(seed.genres).reduce((n, g) => n + Object.values(g.years).flat().length, 0);
let done = 0;

for (const [key, genre] of Object.entries(seed.genres)) {
  catalog.genres[key] = { label: genre.label, years: {} };
  for (const [year, albums] of Object.entries(genre.years)) {
    const out = [];
    for (const [artist, title, altArtist, altTitle] of albums) { // optional 3rd/4th items: the spelling MusicBrainz uses
      const id = `${artist}|${title}`;
      if (!cache[id] || cache[id].miss) cache[id] = await lookup(altArtist || artist, altTitle || title); // misses are retried on every run
      const hit = cache[id];
      done++;
      if (done % 10 === 0) { await writeFile(cachePath, JSON.stringify(cache)); console.log(`${done}/${total}`); }
      if (hit.miss) { report.push(`NO MATCH   ${genre.label} ${year}: ${artist} - ${title}`); continue; }
      if (hit.score < 95) report.push(`CHECK      ${genre.label} ${year}: ${artist} - ${title}  ->  matched "${hit.mbArtist} - ${hit.mbTitle}" (score ${hit.score})`);
      const hasCover = await getCover(hit.mbid);
      if (!hasCover) report.push(`NO COVER   ${genre.label} ${year}: ${artist} - ${title}  (the app will show a generated cover)`);
      out.push({ artist, title, mbid: hit.mbid, thumb: hasCover ? `covers/${hit.mbid}.jpg` : null });
    }
    catalog.genres[key].years[year] = out;
  }
}

await writeFile(cachePath, JSON.stringify(cache));
await writeFile(join(root, 'docs', 'catalog.json'), JSON.stringify(catalog));
await writeFile(join(here, 'report.txt'), report.length ? report.join('\n') + '\n' : 'Everything matched and has a cover.\n');
console.log(`Done. ${total - report.filter(l => l.startsWith('NO MATCH')).length}/${total} albums in docs/catalog.json. See tools/report.txt for ${report.length} item(s) to review.`);
