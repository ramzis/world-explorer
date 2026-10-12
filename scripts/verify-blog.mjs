// Static checks for the blog article. Usage: node scripts/verify-blog.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = 'blog/best-geoguessr-alternatives';
const URL = `https://explorer.tadget.net/${SLUG}/`;
const html = readFileSync(join(root, SLUG, 'index.html'), 'utf8');

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const title = (html.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
const desc = (html.match(/<meta name="description" content="(.*?)"/s) || [])[1] || '';
check(title.length > 0 && title.length <= 65, `title length ${title.length} (want 1-65)`);
check(desc.length >= 100 && desc.length <= 170, `description length ${desc.length} (want 100-170)`);
check(html.includes(`<link rel="canonical" href="${URL}">`), 'canonical missing/wrong');
check((html.match(/<h1[\s>]/g) || []).length === 1, 'need exactly one <h1>');
check(/property="og:image"/.test(html) && /name="twitter:card"/.test(html), 'OG/Twitter tags missing');

// JSON-LD parses and FAQ answers match the visible FAQ.
const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
check(ld.length > 0, 'no JSON-LD');
for (const m of ld) {
  try {
    const data = JSON.parse(m[1]);
    for (const node of data['@graph'] || [data]) {
      if (node['@type'] !== 'FAQPage') continue;
      for (const q of node.mainEntity) {
        const text = q.acceptedAnswer.text;
        check(html.includes(`<p>${text}</p>`), `FAQ answer not visible on page: "${q.name}"`);
      }
    }
  } catch (e) {
    fails.push(`JSON-LD parse error: ${e.message}`);
  }
}

// Every root-absolute asset/link exists on disk.
for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)/g)) {
  const p = m[1];
  if (p === '/') continue;
  const file = join(root, p.endsWith('/') ? p + 'index.html' : p);
  check(existsSync(file), `missing file for ${p}`);
}
for (const m of html.matchAll(/url\("(\/[^"]+)"\)/g)) {
  check(existsSync(join(root, m[1])), `missing CSS asset ${m[1]}`);
}

// Sitemap + discoverability + .env safety.
check(readFileSync(join(root, 'sitemap.xml'), 'utf8').includes(`<loc>${URL}</loc>`), 'sitemap entry missing');
check(readFileSync(join(root, 'index.html'), 'utf8').includes(`href="/${SLUG}/"`), 'no link from index.html');
check(readFileSync(join(root, 'index.html'), 'utf8').includes('href="/blog/"'), 'no /blog/ link on the homepage');
check(/^\.env$/m.test(readFileSync(join(root, '.gitignore'), 'utf8')), '.env not in .gitignore');

// Blog index: same basics, and every @id reference in either JSON-LD graph resolves.
const idx = readFileSync(join(root, 'blog', 'index.html'), 'utf8');
check(idx.includes('<link rel="canonical" href="https://explorer.tadget.net/blog/">'), 'blog index canonical missing');
check((idx.match(/<h1[\s>]/g) || []).length === 1, 'blog index needs exactly one <h1>');
check(idx.includes('href="/blog/best-geoguessr-alternatives/"'), 'blog index does not link to the article');
for (const [name, doc] of [['article', html], ['index', idx]]) {
  const m = doc.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try {
    const nodes = JSON.parse(m[1])['@graph'];
    const ids = new Set(nodes.map((n) => n['@id']).filter(Boolean));
    const refs = [];
    const walk = (o) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === 'object') {
        const keys = Object.keys(o);
        if (keys.length === 1 && keys[0] === '@id') refs.push(o['@id']);
        else keys.forEach((k) => walk(o[k]));
      }
    };
    nodes.forEach(walk);
    for (const r of refs) check(ids.has(r), `${name}: JSON-LD @id reference not defined: ${r}`);
  } catch (e) {
    fails.push(`${name}: JSON-LD error ${e.message}`);
  }
}
check(readFileSync(join(root, 'sitemap.xml'), 'utf8').includes('<loc>https://explorer.tadget.net/blog/</loc>'), 'sitemap missing /blog/');
check(existsSync(join(root, 'llms.txt')), 'llms.txt missing');

if (fails.length) {
  console.error('FAIL\n- ' + fails.join('\n- '));
  process.exit(1);
}
console.log(`OK  title=${title.length}ch  description=${desc.length}ch  jsonld=${ld.length}`);
