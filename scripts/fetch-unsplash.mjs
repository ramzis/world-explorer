// Fetches themed Unsplash photos for the blog into blog/assets/ and writes credits.json.
// Reads ACCESS_KEY from .env (never printed). Usage: node scripts/fetch-unsplash.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const KEY = env.ACCESS_KEY;
if (!KEY) throw new Error('ACCESS_KEY missing in .env');

const out = join(root, 'blog', 'assets');
mkdirSync(out, { recursive: true });

const SHOTS = [
  { name: 'explorer', query: 'traveler looking at map mountains', alt: 'A traveler studying the landscape with a map' },
];

const headers = { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' };
const credits = {};

for (const s of SHOTS) {
  const q = new URLSearchParams({ query: s.query, per_page: '1', orientation: 'landscape', content_filter: 'high' });
  const res = await fetch(`https://api.unsplash.com/search/photos?${q}`, { headers });
  if (!res.ok) throw new Error(`search ${s.name}: ${res.status}`);
  const photo = (await res.json()).results?.[0];
  if (!photo) throw new Error(`no result for ${s.name}`);

  const img = await fetch(`${photo.urls.raw}&w=1200&q=75&fm=jpg&fit=max`);
  if (!img.ok) throw new Error(`download ${s.name}: ${img.status}`);
  writeFileSync(join(out, `${s.name}.jpg`), Buffer.from(await img.arrayBuffer()));

  // Unsplash API guideline: report the download.
  await fetch(photo.links.download_location, { headers }).catch(() => {});

  credits[s.name] = {
    alt: s.alt,
    photographer: photo.user.name,
    photographerUrl: `${photo.user.links.html}?utm_source=world_explorer&utm_medium=referral`,
    photoUrl: `${photo.links.html}?utm_source=world_explorer&utm_medium=referral`,
    width: photo.width,
    height: photo.height,
  };
  console.log(`ok ${s.name} — ${photo.user.name}`);
}

writeFileSync(join(out, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
